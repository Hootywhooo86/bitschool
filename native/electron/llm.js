// The Windows app's on-device story writer: downloads a model into the user's app data folder and runs it
// with node-llama-cpp. Same calls as the Android LocalLlm plugin, so the web app treats both the same.
const { app, ipcMain } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');

let lib, jinja, llama, model, context, sequence, loadedFile = null, genAbort = null, dlAbort = null, lastOut = "";

const dir = () => { const d = path.join(app.getPath('userData'), 'models'); fs.mkdirSync(d, { recursive: true }); return d; };
// Only plain file names: models live in one folder.
const modelPath = f => (/^[A-Za-z0-9._-]+\.gguf$/.test(f || '') ? path.join(dir(), f) : null);

async function engine() {
  lib = lib || await import('node-llama-cpp');
  jinja = jinja || await import('@huggingface/jinja');
  llama = llama || await lib.getLlama({ gpu: 'auto' });
  return lib;
}

async function unload() {
  sequence = null;
  if (context) { await context.dispose(); context = null; }
  if (model) { await model.dispose(); model = null; }
  loadedFile = null; lastOut = "";
}

const handlers = {
  async info() {
    const files = fs.readdirSync(dir()).filter(f => f.endsWith('.gguf')).map(f => ({ file: f, size: fs.statSync(path.join(dir(), f)).size }));
    const st = fs.statfsSync(dir());
    return { files, ram: os.totalmem(), freeSpace: st.bavail * st.bsize, cores: os.cpus().length, loaded: loadedFile, gpu: llama ? llama.gpu : null };
  },

  async download(e, { url, file }) {
    const target = modelPath(file);
    if (!target || !/^https:\/\//.test(url || '')) throw new Error('Bad download');
    const part = target + '.part';
    let have = fs.existsSync(part) ? fs.statSync(part).size : 0;
    dlAbort = new AbortController();
    const res = await fetch(url, { headers: have ? { Range: `bytes=${have}-` } : {}, signal: dlAbort.signal });
    if (res.status === 200) have = 0; // the server ignored the range: start over
    else if (res.status !== 206) throw new Error(`Download failed (HTTP ${res.status})`);
    const total = have + Number(res.headers.get('content-length') || 0);
    const st = fs.statfsSync(dir());
    if (st.bavail * st.bsize < total - have + 200e6) throw new Error('Not enough free space on this computer');
    let loaded = have, last = 0;
    const body = Readable.fromWeb(res.body);
    body.on('data', chunk => {
      loaded += chunk.length;
      if (Date.now() - last > 400) { last = Date.now(); e.sender.send('llm-event', { event: 'download', data: { file, loaded, total } }); }
    });
    try { await pipeline(body, fs.createWriteStream(part, { flags: have ? 'a' : 'w' })); }
    catch (err) { throw new Error(dlAbort.signal.aborted ? 'Download stopped' : 'Download failed: ' + err.message); }
    fs.renameSync(part, target);
    return { file, size: fs.statSync(target).size };
  },

  async cancelDownload() { if (dlAbort) dlAbort.abort(); },

  async remove(e, { file }) {
    const p = modelPath(file);
    if (!p) throw new Error('Bad file');
    if (file === loadedFile) await unload();
    fs.rmSync(p, { force: true }); fs.rmSync(p + '.part', { force: true });
  },

  async loadModel(e, { file, nCtx = 4096 }) {
    const p = modelPath(file);
    if (!p || !fs.existsSync(p)) throw new Error('Model not downloaded');
    if (file === loadedFile) return;
    await unload();
    await engine();
    model = await llama.loadModel({ modelPath: p });
    context = await model.createContext({ contextSize: nCtx });
    sequence = context.getSequence();
    loadedFile = file;
  },

  async generate(e, { system, history, user, schema, maxTokens = 1500, temperature = 0.7 }) {
    if (!model) throw new Error('No model loaded');
    const { LlamaCompletion } = await engine();
    // The model's own chat template rendered the way llama.cpp does, with thinking turned off
    // (Qwen3.5 would otherwise reason first).
    const template = model.fileInfo.metadata.tokenizer.chat_template;
    const prompt = template
      ? new jinja.Template(template).render({
          messages: [{ role: 'system', content: system }, ...(history ? JSON.parse(history) : []), { role: 'user', content: user }],
          add_generation_prompt: true, enable_thinking: false,
          bos_token: model.tokens.bosString || '', eos_token: model.tokens.eosString || '',
        })
      : system + '\n\n' + user + '\n\n';
    const grammar = schema ? await llama.createGrammarForJsonSchema(JSON.parse(schema)) : undefined;
    // A follow-up about the reply just written (the story, then its questions): the sequence already holds
    // that turn, so carry on from it. The template rewrites earlier turns, and Qwen3.5's recurrent layers
    // can't drop the end of the sequence, so re-rendering would mean reading everything again.
    const turns = history ? JSON.parse(history) : [];
    const last = turns[turns.length - 1], genAt = prompt.lastIndexOf('<|im_start|>assistant\n');
    let tokens = null;
    if (last && last.role === 'assistant' && lastOut && last.content === lastOut && genAt >= 0 && sequence.contextTokens.length) {
      const more = model.tokenize('<|im_end|>\n<|im_start|>user\n' + user + '<|im_end|>\n' + prompt.slice(genAt), true);
      if (sequence.contextTokens.length + more.length + 64 < context.contextSize) tokens = [...sequence.contextTokens, ...more];
    }
    lastOut = '';
    // No clearHistory: LlamaCompletion keeps the part of the sequence this prompt starts with (the
    // instructions, and for a follow-up turn the story too) and only reads the rest.
    const completion = new LlamaCompletion({ contextSequence: sequence });
    genAbort = new AbortController();
    let n = 0;
    try {
      const text = await completion.generateCompletion(tokens || model.tokenize(prompt, true), {
        grammar, maxTokens, temperature, topK: 20, topP: 0.8,
        repeatPenalty: { lastTokens: 256, penalty: 1, presencePenalty: 1.5 },
        signal: genAbort.signal, stopOnAbortSignal: true,
        onTextChunk: () => { if (++n % 8 === 0) e.sender.send('llm-event', { event: 'progress', data: { tokens: n } }); },
      });
      if (!genAbort.signal.aborted) lastOut = text;
      return { text };
    } finally { completion.dispose({ disposeSequence: false }); }
  },

  async stop() { if (genAbort) genAbort.abort(); },
  async pause() {}, // Windows has no Whisper listening to make room for
  async unload() { await unload(); },
};

function registerLlm() {
  for (const [name, fn] of Object.entries(handlers)) ipcMain.handle('llm:' + name, (e, args) => fn(e, args || {}));
}

module.exports = { registerLlm };
