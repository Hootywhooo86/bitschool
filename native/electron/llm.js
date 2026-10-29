// The Windows app's on-device story writer: downloads a model into the user's app data folder and runs it
// with node-llama-cpp. Same calls as the Android LocalLlm plugin, so the web app treats both the same.
const { app, ipcMain } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');

let lib, llama, model, context, loadedFile = null, genAbort = null, dlAbort = null;

const dir = () => { const d = path.join(app.getPath('userData'), 'models'); fs.mkdirSync(d, { recursive: true }); return d; };
// Only plain file names: models live in one folder.
const modelPath = f => (/^[A-Za-z0-9._-]+\.gguf$/.test(f || '') ? path.join(dir(), f) : null);

async function engine() {
  lib = lib || await import('node-llama-cpp');
  llama = llama || await lib.getLlama({ gpu: 'auto' });
  return lib;
}

async function unload() {
  if (context) { await context.dispose(); context = null; }
  if (model) { await model.dispose(); model = null; }
  loadedFile = null;
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
    loadedFile = file;
  },

  async generate(e, { system, user, schema, maxTokens = 1500, temperature = 0.7 }) {
    if (!model) throw new Error('No model loaded');
    const { LlamaChatSession, JinjaTemplateChatWrapper } = await engine();
    // The model's own chat template, with thinking turned off (Qwen3.5 would otherwise reason first).
    const template = model.fileInfo.metadata && model.fileInfo.metadata.tokenizer && model.fileInfo.metadata.tokenizer.chat_template;
    const chatWrapper = template ? new JinjaTemplateChatWrapper({ template, additionalRenderParameters: { enable_thinking: false } }) : undefined;
    const sequence = context.getSequence();
    const session = new LlamaChatSession({ contextSequence: sequence, systemPrompt: system, chatWrapper });
    const grammar = schema ? await llama.createGrammarForJsonSchema(JSON.parse(schema)) : undefined;
    genAbort = new AbortController();
    let n = 0;
    try {
      const text = await session.prompt(user, {
        grammar, maxTokens, temperature, topK: 20, topP: 0.8,
        repeatPenalty: { lastTokens: 256, penalty: 1, presencePenalty: 1.5 },
        signal: genAbort.signal, stopOnAbortSignal: true,
        onTextChunk: () => { if (++n % 8 === 0) e.sender.send('llm-event', { event: 'progress', data: { tokens: n } }); },
      });
      return { text };
    } finally { session.dispose(); sequence.dispose(); }
  },

  async stop() { if (genAbort) genAbort.abort(); },
  async unload() { await unload(); },
};

function registerLlm() {
  for (const [name, fn] of Object.entries(handlers)) ipcMain.handle('llm:' + name, (e, args) => fn(e, args || {}));
}

module.exports = { registerLlm };
