// The story writer and answer checker: a model on this device, Qwen (or any model) through Ollama,
// any OpenAI-compatible server such as LM Studio or llama.cpp, or a cloud AI (Claude, or any
// OpenAI-compatible service) with the grown-up's own key.
const Model = {
  online: false,
  models: [],
  cfg() { return Store.state.settings.model; },
  base() { return this.cfg().endpoint.replace(/\/+$/, ''); },

  async ping() {
    const c = this.cfg();
    if (c.api === 'cloud') {
      // No test call here (it would cost a little each time): the key is checked when saved.
      // Without internet the phone's own story writer takes over, if one is downloaded.
      await Device.refresh();
      this.models = [];
      return (this.online = (!!Cloud.cfg().key && navigator.onLine !== false) || Device.ready());
    }
    if (c.api === 'device') {
      await Device.refresh();
      this.models = [];
      return (this.online = Device.ready());
    }
    try {
      const url = c.api === 'ollama' ? this.base() + '/api/tags' : this.base() + '/v1/models';
      const r = await fetch(url, { signal: AbortSignal.timeout(2500) });
      const j = await r.json();
      this.models = c.api === 'ollama' ? (j.models || []).map(m => m.name) : (j.data || []).map(m => m.id);
      this.online = r.ok;
    } catch (e) { this.online = false; this.models = []; }
    return this.online;
  },

  // history: earlier turns of the same job, [{role: 'user' | 'assistant', content}].
  async chat(system, user, { images, timeout = 180000, model, schema, onProgress, history = [], maxTokens } = {}) {
    const c = this.cfg();
    if (c.api === 'device') return this.raw(await Device.chat(system, user, { schema, onProgress, history, maxTokens }));
    if (c.api === 'cloud') {
      const cc = Cloud.cfg();
      // No internet (or no key): the phone's own story writer, when there is one.
      const offline = !cc.key || navigator.onLine === false;
      if (offline && Device.ready() && !images) return this.raw(await Device.chat(system, user, { schema, onProgress, history, maxTokens }));
      try {
        return this.raw(cc.provider === 'claude'
          ? await Cloud.claude(cc, system, user, { images, timeout, schema, history })
          : await openaiChat(cc.endpoint, cc.name, system, user, { images, timeout, schema, history, key: cc.key }));
      } catch (e) {
        if (e.network && Device.ready() && !images) return this.raw(await Device.chat(system, user, { schema, onProgress, history, maxTokens }));
        throw e;
      }
    }
    const name = model || c.name;
    let text;
    if (c.api === 'ollama') {
      const msg = { role: 'user', content: user };
      if (images) msg.images = images;
      const r = await fetch(this.base() + '/api/chat', {
        method: 'POST', signal: AbortSignal.timeout(timeout), headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: name, stream: false, format: schema || 'json', think: false, options: { temperature: 0.8 },
          messages: [{ role: 'system', content: system }, ...history, msg] }),
      });
      if (!r.ok) throw new Error('Model error ' + r.status + ': ' + (await r.text()).slice(0, 200));
      text = (await r.json()).message.content;
    } else text = await openaiChat(this.base(), images && c.vision ? c.vision : name, system, user, { images, timeout, schema, history });
    return this.raw(text);
  },

  // The reply exactly as the model wrote it is kept, so a follow-up turn can show it back unchanged
  // (a model on this device then carries straight on from it).
  raw(text) { this.lastRaw = text; return parseJSON(text); },

  // Stops a story being written on this device (another one is needed first).
  stopWriting() { if (this.cfg().api === 'device' || (this.cfg().api === 'cloud' && !Cloud.cfg().key)) Device.stop(); },

  // Writes a story in two steps: the story itself, then (as a follow-up turn, so the story is not read
  // again) its questions. opts.onText(passage) is called as soon as the story is ready, with
  // passage.pending: a promise of the whole sheet, so he can start reading while the questions are written.
  // opts.base + opts.note: rewrite that story as asked. opts.keepText: write the questions for the
  // grown-up's own text and keep it word for word.
  async writeStory(level, onProgress, chosen, opts = {}) {
    const s = storySpec(level);
    const st = Store.state.settings, name = Store.state.child.name;
    const wishes = [
      st.storyStyle ? `- The grown-up asks: ${st.storyStyle}` : '',
      st.useName && name ? `- The main character is named ${name}.` : '',
      st.practiceWords && st.practiceWords.length ? `- Use these words in the story: ${st.practiceWords.join(', ')}.` : '',
    ].filter(Boolean).join('\n');
    const n = Store.state.sessions.length;
    const genre = level >= 30 && n % 3 === 2 ? 'nonfiction (true facts, explained simply)' : 'story';
    const recent = Store.state.sessions.slice(-8).map(x => x.topic).filter(Boolean);
    const topic = chosen || shuffle(TOPICS.filter(t => !recent.includes(t)))[0];
    const sentences = Math.max(4, Math.round(s.words / s.sentenceWords));
    const paras = s.words < 70 ? 'one paragraph' : s.words < 160 ? 'two or three paragraphs' : s.words < 260 ? 'three or four paragraphs' : 'four or five paragraphs';
    // The same instructions start every request, so a model on this device reads them only once.
    const user = `Write an original ${chosen ? 'story' : genre} for a child reading at level ${s.name} (${s.grade}). Topic: ${topic}.${chosen ? `
The child picked this topic. If it names a hero, game, movie or show, use its characters and world.` : ''}
- About ${sentences} sentences in ${paras}. That is about ${s.words} words (never fewer than ${s.minWords} or more than ${s.maxWords}).
- Sentences average about ${s.sentenceWords} words.
- Word choice: ${s.vocab}.${genre.startsWith('nonfiction') ? '\n- Only state facts you are certain are true.' : ''}
${wishes ? '\nWhat the grown-up wants (follow it, but keep the rules):\n' + wishes + '\n' : ''}${opts.base && opts.keepText ? `\nUse exactly this passage as "text", word for word:\n"""${opts.base}"""\n` : opts.base ? `\nRewrite this story:\n"""${opts.base}"""\nChange it like this: ${opts.note || 'make it better'}\n` : ''}
Reply {"title": "a short title", "text": "the passage"}.`;
    const maxTokens = Math.round(s.maxWords * 1.6) + 120;

    // Step 1: the story. A rejected story is written again with the reason, so the next try fixes it.
    let story, why = '';
    const halted = () => { if (opts.cancel && opts.cancel.stop) { const e = new Error('Stopped'); e.fatal = true; throw e; } };
    if (opts.keepText) story = { title: 'A Story From Home', text: opts.base };
    for (let attempt = 0; !story && attempt < 3; attempt++) {
      halted();
      try {
        const j = await this.chat(STORY_SYSTEM, user + why, { schema: TEXT_SCHEMA, onProgress, maxTokens });
        story = checkText(j, level);
      } catch (e) {
        halted();
        if (e.fatal || e.network || attempt === 2) throw e;
        why = `\n\nYour last try was not used: ${e.message}. Fix that.`;
      }
    }
    // The story turn as the model wrote it (unless it was trimmed or is the grown-up's own).
    const reply = !opts.keepText && this.lastRaw && (() => { try { return words(String(parseJSON(this.lastRaw).text)).join(' ') === words(story.text).join(' '); } catch (e) { return false; } })()
      ? this.lastRaw : JSON.stringify({ title: story.title, text: story.text });
    const history = [{ role: 'user', content: user + why }, { role: 'assistant', content: reply }];
    const base = { id: 'm-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), level, source: 'model', style: styleKey(), topic, ...story };

    // Step 2: questions, words to learn and the circle task, about that story. If this fails the story
    // is still used, with a question that needs no model.
    const tasks = (async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        if (opts.cancel && opts.cancel.stop) break;
        try { return { ...base, ...checkTasks(await this.chat(STORY_SYSTEM, tasksPrompt(level), { schema: TASKS_SCHEMA, history, maxTokens: 900 }), story.text) }; }
        catch (e) { if (e.fatal || e.network) break; }
      }
      return { ...base, ...simpleTasks(story.text) };
    })();
    if (opts.onText) opts.onText({ ...base, questions: [], vocab: [], circle: null, mainIdea: '', pending: tasks });
    return tasks;
  },

  // The device runs one job at a time; while it writes a story, quick jobs use the fallbacks instead.
  busy() { return Device.busy && (this.cfg().api === 'device' || (this.cfg().api === 'cloud' && !Cloud.cfg().key)); },

  async judge(passage, q, answer) {
    if (this.busy()) throw new Error('Story writer is busy');
    const j = await this.chat('You check a child\'s reading comprehension answers kindly and fairly. Reply with JSON only.',
      `Passage (level ${levelName(passage.level)}):\n"""${passage.text}"""\n\nQuestion: ${q.q}\nA good answer includes: ${q.idea}\nChild's answer: "${answer}"\n\nSpelling and grammar mistakes do not matter. Did the child get the main idea? Reply {"correct": true or false, "feedback": "one short, kind sentence to the child"}`, { timeout: 60000 });
    return { correct: j.correct === true || j.correct === 'true', feedback: String(j.feedback || '') };
  },

  async define(word, sentence) {
    if (this.busy()) throw new Error('Story writer is busy');
    const j = await this.chat('You explain words to young children. Reply with JSON only.',
      `Explain the word "${word}" as used in: "${sentence}". Use under 15 easy words. Reply {"meaning": "..."}`, { timeout: 30000 });
    return String(j.meaning || '');
  },

  async readHandwriting(base64) {
    const j = await this.chat('You read children\'s handwriting. Reply with JSON only.',
      'Write out exactly what this child wrote, keeping their words. Reply {"text": "..."}', { images: [base64], model: this.cfg().vision, timeout: 90000 });
    return String(j.text || '');
  },
};

function parseJSON(text) {
  text = String(text).replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```(json)?/g, '');
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  return JSON.parse(text.slice(a, b + 1));
}

// The rules every story follows; first in every request, so a model on this device keeps them read.
const STORY_SYSTEM = `You write original reading-practice passages for children, like the stories in graded readers, and the questions about them. You reply with JSON only.

Every passage:
- Is kid-safe, like a cartoon: action and adventure are fine, but no blood, nobody dies or is badly hurt (bad guys and monsters run away, get caught or give up), no swearing, nothing too scary.
- Has exactly the length, sentence length and word choice asked for. Short, common words for young readers.
- Separates paragraphs with a blank line.`;

function tasksPrompt(level) {
  const s = storySpec(level);
  return `Now, about that passage:
- "mc": two multiple-choice questions that practice ${s.skills}. Each has "q" (a real question about this passage, ending with ?), "right" (the correct answer, exactly as the passage says) and "wrong" (two answers the passage shows are wrong but that sound believable).
- "open": one question about the main idea or why something happened ("q"), and "idea": one sentence saying what a good answer must include.
- "vocab": two to four harder words copied from the passage itself, each with a "meaning" a child understands.
- "circle": a "sentence" copied exactly from the passage, a "prompt" telling the child what to circle in it (${level < 20 ? 'an animal, a thing or a color' : level < 40 ? 'the verb' : 'the describing word'}), and "targets": the word or words from that sentence to circle.
- "mainIdea": the one sentence copied exactly from the passage that best states its main idea.`;
}

const STR = { type: 'string' };
const TEXT_SCHEMA = { type: 'object', required: ['title', 'text'], properties: { title: STR, text: STR } };
const TASKS_SCHEMA = {
  type: 'object', required: ['mc', 'open', 'vocab', 'circle', 'mainIdea'],
  properties: {
    mc: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'object', required: ['q', 'right', 'wrong'], properties: { q: STR, right: STR, wrong: { type: 'array', minItems: 2, maxItems: 2, items: STR } } } },
    open: { type: 'object', required: ['q', 'idea'], properties: { q: STR, idea: STR } },
    vocab: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'object', required: ['word', 'meaning'], properties: { word: STR, meaning: STR } } },
    circle: { type: 'object', required: ['sentence', 'prompt', 'targets'], properties: { sentence: STR, prompt: STR, targets: { type: 'array', minItems: 1, maxItems: 3, items: STR } } },
    mainIdea: STR,
  },
};
// The whole sheet in one reply (older single-step replies, and tests).
const STORY_SCHEMA = {
  type: 'object', required: ['title', 'text', 'mc', 'open', 'vocab', 'circle', 'mainIdea'],
  properties: {
    title: STR, text: STR,
    mc: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'object', required: ['q', 'right', 'wrong'], properties: { q: STR, right: STR, wrong: { type: 'array', minItems: 2, maxItems: 2, items: STR } } } },
    open: { type: 'object', required: ['q', 'idea'], properties: { q: STR, idea: STR } },
    vocab: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'object', required: ['word', 'meaning'], properties: { word: STR, meaning: STR } } },
    circle: { type: 'object', required: ['sentence', 'prompt', 'targets'], properties: { sentence: STR, prompt: STR, targets: { type: 'array', minItems: 1, maxItems: 3, items: STR } } },
    mainIdea: STR,
  },
};
// The grown-up's story instructions at the time a story is written; stories written ahead under
// older instructions aren't used.
function styleKey() {
  const st = Store.state.settings;
  return JSON.stringify([st.storyStyle, st.useName && Store.state.child.name, st.storyLength, st.practiceWords]);
}

// Words that don't belong in a story for a young reader, even an action one.
const NOT_KID_SAFE = /\b(stopped breathing|never (woke|moved|got) up( again)?|never (woke|moved|breathed) again|lifeless|passed away|blood\w*|kill(s|ed|er|ing)?|murder\w*|dead|death|die[ds]?|dying|corpses?|gore|guts|stab\w*|behead\w*|suicide|bomb(s|ed|ing)?|shit|fuck\w*)\b/i;

// Words a model writes when it copies instructions instead of answering them.
const PLACEHOLDER = /\b(a question|correct answer|wrong answer|question about|one sentence|copied exactly|child-friendly|harder word|short title|the word\(s\))\b/i;

// Model output is checked before a child sees it. Small problems are fixed here instead of writing the
// story again: a story that runs long is cut at the end of a sentence, and questions or words that don't
// fit are dropped.
function checkText(j, level) {
  const s = storySpec(level);
  let text = String(j.text || '').replace(/\\n/g, '\n').replace(/[\s{}\[\]]+$/, '').replace(/^[\s>-]+(?=["“A-Z])/, '').trim();
  if (words(text).length > s.maxWords * 1.15) text = trimToWords(text, s.maxWords);
  const count = words(text).length;
  if (count < s.minWords * 0.75) throw new Error(`the story was ${count} words, it must be about ${s.words}`);
  if (PLACEHOLDER.test(text)) throw new Error('the story copied the instructions instead of telling a story');
  if (NOT_KID_SAFE.test(text + ' ' + (j.title || ''))) throw new Error('the story had something not right for a young child (like someone dying or getting hurt)');
  const grade = readingGrade(text), maxGrade = BAND_MAX_GRADE[Math.floor(level / 10)];
  if (grade > maxGrade) throw new Error(`the story was too hard to read: use shorter sentences and easier words`);
  const title = String(j.title || '').replace(/^["“]|["”]$/g, '').trim().slice(0, 80);
  return { title: title && !PLACEHOLDER.test(title) ? title : 'A New Story', text };
}

// Cuts a story to at most `max` words, at the end of a sentence (keeping paragraphs).
function trimToWords(text, max) {
  const out = [];
  let n = 0;
  for (const para of text.split(/\n\s*\n/)) {
    const keep = [];
    for (const sen of splitSentences(para)) {
      const w = words(sen).length;
      if (n + w > max && n > 0) break;
      keep.push(sen); n += w;
    }
    if (keep.length) out.push(keep.join(' '));
    if (keep.length < splitSentences(para).length) break;
  }
  return out.join('\n\n') || text;
}

function checkTasks(j, text) {
  const inText = w => words(text).some(x => norm(x) === norm(w));
  const flat = ' ' + words(text).map(norm).join(' ') + ' ';
  const inStory = sen => !!sen && words(sen).length > 2 && flat.includes(' ' + words(sen).map(norm).join(' ') + ' ');
  const real = q => q && String(q).trim().length > 8 && /\?\s*$/.test(q) && !PLACEHOLDER.test(q);
  // Older replies use "questions"; schema replies use "mc" and "open".
  const mcIn = j.mc || (j.questions || []).filter(q => q.type !== 'open').map(q => ({ q: q.q, right: (q.choices || [])[typeof q.answer === 'number' ? q.answer : 0], wrong: (q.choices || []).filter((c, i) => i !== (typeof q.answer === 'number' ? q.answer : 0)) }));
  const openIn = j.open || (j.questions || []).find(q => q.type === 'open');
  const qs = (mcIn || []).map(q => {
    const right = String(q.right || '').trim(), wrong = (q.wrong || []).map(String).map(x => x.trim()).filter(x => x && norm(x) !== norm(right));
    if (!real(q.q) || !right || wrong.length < 2 || PLACEHOLDER.test(right + ' ' + wrong.join(' '))) return null;
    const mixed = shuffle([right, ...wrong.slice(0, 2)]);
    return { type: 'mc', q: String(q.q).trim(), choices: mixed, answer: mixed.indexOf(right) };
  }).filter(Boolean);
  if (openIn && real(openIn.q) && openIn.idea && !PLACEHOLDER.test(openIn.idea)) qs.push({ type: 'open', q: String(openIn.q).trim(), idea: String(openIn.idea) });
  if (!qs.some(q => q.type === 'mc')) throw new Error('the questions were not real questions about the story');
  return {
    questions: qs.slice(0, 4),
    vocab: (Array.isArray(j.vocab) ? j.vocab : []).filter(v => v && v.word && v.meaning && inText(v.word) && !PLACEHOLDER.test(v.meaning)),
    // The circle sentence must really be in the story (small models sometimes make one up).
    circle: j.circle && !PLACEHOLDER.test(j.circle.prompt || '') && inStory(j.circle.sentence) ? { kind: 'word', ...j.circle } : null,
    mainIdea: j.mainIdea && !PLACEHOLDER.test(j.mainIdea) && inStory(j.mainIdea) ? String(j.mainIdea) : '',
  };
}

// When the questions can't be written: one question that needs no model.
function simpleTasks(text) {
  return { questions: [{ type: 'open', q: 'What happened in this story?', idea: splitSentences(text)[0] || text }], vocab: [], circle: null, mainIdea: '' };
}

// The whole sheet from one reply (older replies and tests). trusted: a grown-up wrote the text.
function checkStory(j, level, trusted) {
  const t = trusted ? { title: String(j.title || 'A New Story').slice(0, 80), text: String(j.text || '').trim() } : checkText(j, level);
  const tasks = checkTasks(j, t.text);
  if (tasks.questions.filter(q => q.type === 'mc').length < 2) throw new Error('Story came back without real questions');
  return { id: 'm-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), level, source: 'model', ...t, ...tasks };
}

// Without the model, an open answer passes when it shares enough key words with the expected idea.
function keywordJudge(q, answer) {
  const stem = w => w.replace(/(ing|ed|es|s|ly)$/, '');
  const key = new Set(words(q.idea).map(norm).filter(w => w.length > 2 && !STOPWORDS.has(w)).map(stem));
  const got = new Set(words(answer).map(norm).filter(w => w.length > 2 && !STOPWORDS.has(w)).map(stem));
  const hits = [...got].filter(w => key.has(w)).length;
  const need = Math.min(2, Math.max(1, Math.round(key.size * 0.2)));
  const correct = hits >= need;
  return { correct, feedback: correct ? 'Nice thinking — you got the main idea!' : 'Good try! A strong answer says: ' + q.idea + '.' };
}

// Web requests for the story writers. In the Android app they go through the app itself (Capacitor's
// native HTTP), so a cloud service never blocks them the way it can block a web page (CORS).
async function http(url, { method = 'POST', headers = {}, body, timeout = 120000 } = {}) {
  const native = nativePlugin('CapacitorHttp');
  try {
    if (native) {
      const r = await native.request({ url, method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
        data: body, responseType: 'text', connectTimeout: 20000, readTimeout: timeout });
      const text = typeof r.data === 'string' ? r.data : JSON.stringify(r.data);
      return { status: r.status, ok: r.status >= 200 && r.status < 300, text };
    }
    const r = await fetch(url, { method, signal: AbortSignal.timeout(timeout), headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, ok: r.ok, text: await r.text() };
  } catch (e) {
    const err = new Error("Couldn't reach " + new URL(url).host + ' — check the internet and the address (' + ((e && e.message) || e) + ')');
    err.network = true; throw err;
  }
}
// The service's own error message, if it sent one.
function errorText(text) {
  try { const j = JSON.parse(text); return (j.error && (j.error.message || j.error)) || j.message || text; } catch (e) { return String(text || '').slice(0, 200); }
}

// An OpenAI-style address, however it was typed: "https://api.groq.com/openai/v1",
// "…/v1/chat/completions" or "http://localhost:1234" all become the base that /chat/completions follows.
function apiBase(base) {
  let b = String(base || '').trim().replace(/\/+$/, '').replace(/\/chat\/completions$/, '').replace(/\/models$/, '');
  if (b && !/^https?:\/\//.test(b)) b = 'https://' + b;
  try { if (!/\/v\d+[a-z0-9]*(\/|$)/i.test(new URL(b).pathname)) b += '/v1'; } catch (e) {}
  return b;
}

// Models that turned down a JSON schema: ask them for plain JSON instead (the prompt describes the shape).
const NO_SCHEMA = new Set();

// An OpenAI-style chat: LM Studio, llama.cpp's server, or a cloud service with a key (Groq, OpenAI,
// OpenRouter, Google Gemini…).
async function openaiChat(base, name, system, user, { images, timeout = 180000, schema, history = [], key } = {}) {
  const url = apiBase(base) + '/chat/completions', tag = url + '|' + name;
  const content = images ? [{ type: 'text', text: user }, ...images.map(b => ({ type: 'image_url', image_url: { url: 'data:image/png;base64,' + b } }))] : user;
  const ask = withSchema => http(url, {
    headers: key ? { Authorization: 'Bearer ' + key } : {}, timeout,
    body: { model: name, temperature: 0.8, response_format: withSchema ? { type: 'json_schema', json_schema: { name: 'answer', schema } } : { type: 'json_object' },
      messages: [{ role: 'system', content: system }, ...history, { role: 'user', content }] },
  });
  let r = await ask(schema && !NO_SCHEMA.has(tag));
  if (!r.ok && r.status === 400 && schema && !NO_SCHEMA.has(tag) && /response_format|json_schema|schema|structured|not support/i.test(r.text)) {
    NO_SCHEMA.add(tag);
    r = await ask(false);
  }
  if (!r.ok) {
    const msg = errorText(r.text);
    const err = new Error(r.status === 401 || r.status === 403 ? 'The key was not accepted (' + msg + ')'
      : r.status === 404 ? 'Not found — check the address and model name (' + msg + ')'
      : r.status === 429 ? 'The service is busy or out of free requests — try again in a minute (' + msg + ')'
      : 'Error ' + r.status + ': ' + msg);
    if ([400, 401, 403, 404].includes(r.status)) err.fatal = true;
    if (r.status >= 500) err.network = true;
    throw err;
  }
  let j;
  try { j = JSON.parse(r.text); } catch (e) { throw new Error('The service sent something that isn\'t JSON'); }
  const m = j.choices && j.choices[0] && j.choices[0].message;
  if (!m || !m.content) throw new Error('The service sent an empty answer');
  return m.content;
}

// The cloud story writer. The key a grown-up enters stays on this device: it is not part of the
// progress saved to the 128bit account, and it is left out of exported data.
const CLOUD_MODELS = [
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', note: 'The best stories. About 5¢ a story.' },
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', note: 'Great stories, about 2¢ a story.' },
  { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', note: 'The fastest, and well under 1¢ a story.' },
];
// Cloud services with an OpenAI-style API: the address is filled in, and the model list comes from
// the service itself once the key is in.
const CLOUD_SERVICES = [
  { id: 'groq', name: 'Groq', endpoint: 'https://api.groq.com/openai/v1', keys: 'console.groq.com/keys', note: 'Very fast, with a free tier.' },
  { id: 'openai', name: 'OpenAI', endpoint: 'https://api.openai.com/v1', keys: 'platform.openai.com/api-keys' },
  { id: 'openrouter', name: 'OpenRouter', endpoint: 'https://openrouter.ai/api/v1', keys: 'openrouter.ai/keys' },
  { id: 'gemini', name: 'Google Gemini', endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai', keys: 'aistudio.google.com/apikey' },
  { id: 'other', name: 'Other', endpoint: '' },
];
const Cloud = {
  cfg() {
    const m = Store.state.settings.model;
    return (m.cloud = { provider: 'claude', key: '', name: 'claude-opus-5-5', endpoint: '', service: 'groq', ...(m.cloud || {}) });
  },
  // The models this key can use (OpenAI-style services list them at /models).
  async models(c) {
    const r = await http(apiBase(c.endpoint) + '/models', { method: 'GET', headers: { Authorization: 'Bearer ' + c.key }, timeout: 20000 });
    if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? 'The key was not accepted' : r.status === 404 ? 'Nothing at that address — check it' : 'Error ' + r.status + ': ' + errorText(r.text));
    const j = JSON.parse(r.text);
    return (j.data || j.models || []).map(m => String(m.id || m.name || '').replace(/^models\//, '')).filter(Boolean).sort();
  },
  // Claude's Messages API, called straight from the app with the grown-up's key.
  async claude(c, system, user, { images, timeout = 120000, schema, history = [] } = {}) {
    const last = images ? [{ type: 'text', text: user }, ...images.map(b => ({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: b } }))] : user;
    const body = {
      model: c.name || 'claude-opus-5-5', max_tokens: 8000, system,
      messages: [...history, { role: 'user', content: last }],
      // Low effort: a children's story doesn't need long thinking, and it comes back faster.
      output_config: { effort: 'low', ...(schema ? { format: { type: 'json_schema', schema: strictSchema(schema) } } : {}) },
    };
    const headers = {
      'x-api-key': c.key, 'anthropic-version': '2026-10-21',
      'anthropic-dangerous-direct-browser-access': 'true',
    };
    // If a request is declined, the server tries it again on a fitting model instead of failing.
    if (/^claude-(opus-5-5|sonnet-5-5|fable)/.test(body.model)) { body.fallbacks = 'default'; headers['anthropic-beta'] = 'server-side-fallback-2026-07-01'; }
    const r = await http('https://api.anthropic.com/v1/messages', { headers, body, timeout });
    let j = {};
    try { j = JSON.parse(r.text); } catch (e) {}
    if (!r.ok) {
      const msg = (j.error && j.error.message) || ('error ' + r.status);
      const err = new Error(r.status === 401 ? 'The cloud AI key was not accepted — check it in Grown-ups → Settings'
        : r.status === 429 || r.status === 529 ? 'The cloud AI is busy — try again in a minute' : 'Cloud AI: ' + msg);
      if (r.status === 401 || r.status === 403 || r.status === 400) err.fatal = true;
      if (r.status >= 500) err.network = true;
      throw err;
    }
    if (j.stop_reason === 'refusal') throw new Error('The cloud AI would not write that one');
    return (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  },
  // A tiny request to check the key and model.
  async test() {
    const j = await Model.chat('Reply with JSON only.', 'Reply {"ok": true}', { timeout: 30000 });
    if (!j || j.ok !== true) throw new Error('Unexpected reply');
  },
};

// Structured outputs need every object closed (additionalProperties: false) and no array size limits;
// the app checks the sizes itself.
function strictSchema(x) {
  if (Array.isArray(x)) return x.map(strictSchema);
  if (!x || typeof x !== 'object') return x;
  const out = {};
  for (const [k, v] of Object.entries(x)) if (k !== 'minItems' && k !== 'maxItems') out[k] = strictSchema(v);
  if (out.type === 'object') out.additionalProperties = false;
  return out;
}
