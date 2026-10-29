// The local story writer and answer checker: Qwen (or any model) through Ollama,
// or any OpenAI-compatible server such as LM Studio or llama.cpp.
const Model = {
  online: false,
  models: [],
  cfg() { return Store.state.settings.model; },
  base() { return this.cfg().endpoint.replace(/\/+$/, ''); },

  async ping() {
    const c = this.cfg();
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

  async chat(system, user, { images, timeout = 180000, model, schema, onProgress } = {}) {
    const c = this.cfg(), name = model || c.name;
    if (c.api === 'device') return parseJSON(await Device.chat(system, user, { schema, onProgress }));
    let r, text;
    if (c.api === 'ollama') {
      const msg = { role: 'user', content: user };
      if (images) msg.images = images;
      r = await fetch(this.base() + '/api/chat', {
        method: 'POST', signal: AbortSignal.timeout(timeout), headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: name, stream: false, format: schema || 'json', think: false, options: { temperature: 0.8 },
          messages: [{ role: 'system', content: system }, msg] }),
      });
      if (!r.ok) throw new Error('Model error ' + r.status + ': ' + (await r.text()).slice(0, 200));
      text = (await r.json()).message.content;
    } else {
      const content = images ? [{ type: 'text', text: user }, ...images.map(b => ({ type: 'image_url', image_url: { url: 'data:image/png;base64,' + b } }))] : user;
      r = await fetch(this.base() + '/v1/chat/completions', {
        method: 'POST', signal: AbortSignal.timeout(timeout), headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: name, temperature: 0.8, response_format: schema ? { type: 'json_schema', json_schema: { name: 'answer', schema } } : { type: 'json_object' },
          messages: [{ role: 'system', content: system }, { role: 'user', content }] }),
      });
      if (!r.ok) throw new Error('Model error ' + r.status + ': ' + (await r.text()).slice(0, 200));
      text = (await r.json()).choices[0].message.content;
    }
    return parseJSON(text);
  },

  async writeStory(level, onProgress) {
    const s = levelSpec(level);
    const n = Store.state.sessions.length;
    const genre = level >= 30 && n % 3 === 2 ? 'nonfiction (true facts, explained simply)' : 'story';
    const recent = Store.state.sessions.slice(-8).map(x => x.topic).filter(Boolean);
    const topic = shuffle(TOPICS.filter(t => !recent.includes(t)))[0];
    const sentences = Math.max(4, Math.round(s.words / s.sentenceWords));
    const paras = s.words < 70 ? 'one paragraph' : s.words < 160 ? 'two or three paragraphs' : s.words < 260 ? 'three or four paragraphs' : 'four or five paragraphs';
    const system = 'You write original reading-practice passages for children, like the stories in graded readers. You reply with JSON only.';
    const user = `Write an original ${genre} for a child reading at level ${s.name} (${s.grade}). Topic: ${topic}.

The passage ("text"):
- About ${sentences} sentences in ${paras}. That is about ${s.words} words (never fewer than ${s.minWords} or more than ${s.maxWords}).
- Sentences average about ${s.sentenceWords} words.
- Word choice: ${s.vocab}.
- Warm, safe and fun. Nobody gets hurt, lost forever or scared. No brands.${genre.startsWith('nonfiction') ? '\n- Only state facts you are certain are true.' : ''}
- Separate paragraphs with a blank line.

Then, about that passage:
- "title": a short title.
- "mc": two multiple-choice questions that practice ${s.skills}. Each has "q" (a real question about this passage, ending with ?), "right" (the correct answer, exactly as the passage says) and "wrong" (two answers the passage shows are wrong but that sound believable).
- "open": one question about the main idea or why something happened ("q"), and "idea": one sentence saying what a good answer must include.
- "vocab": two to four harder words copied from the passage itself, each with a "meaning" a child understands.
- "circle": a "sentence" copied exactly from the passage, a "prompt" telling the child what to circle in it (${level < 20 ? 'an animal, a thing or a color' : level < 40 ? 'the verb' : 'the describing word'}), and "targets": the word or words from that sentence to circle.
- "mainIdea": the one sentence copied exactly from the passage that best states its main idea.`;
    let last;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const j = await this.chat(system, user, { schema: STORY_SCHEMA, onProgress });
        const p = checkStory(j, level);
        p.topic = topic;
        return p;
      } catch (e) { last = e; }
    }
    throw last;
  },

  // The device runs one job at a time; while it writes a story, quick jobs use the fallbacks instead.
  busy() { return this.cfg().api === 'device' && Device.busy; },

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

const STR = { type: 'string' };
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
// Words a model writes when it copies instructions instead of answering them.
const PLACEHOLDER = /\b(a question|correct answer|wrong answer|question about|one sentence|copied exactly|child-friendly|harder word|short title|the word\(s\))\b/i;

// Model output is checked before a child sees it: right length, real questions, answers shuffled.
function checkStory(j, level) {
  const s = levelSpec(level);
  const text = String(j.text || '').replace(/\\n/g, '\n').replace(/[\s{}\[\]]+$/, '').replace(/^[\s>-]+(?=["“A-Z])/, '').trim();
  const count = words(text).length;
  if (count < s.minWords * 0.75 || count > s.maxWords * 1.4) throw new Error(`Story was ${count} words, wanted about ${s.words}`);
  if (PLACEHOLDER.test(text)) throw new Error('Story text was copied from the instructions');
  const inText = w => words(text).some(x => norm(x) === norm(w));
  const real = q => q && String(q).trim().length > 8 && /\?\s*$/.test(q) && !PLACEHOLDER.test(q);
  // Older replies use "questions"; schema replies use "mc" and "open".
  const mcIn = j.mc || (j.questions || []).filter(q => q.type !== 'open').map(q => ({ q: q.q, right: (q.choices || [])[typeof q.answer === 'number' ? q.answer : 0], wrong: (q.choices || []).filter((c, i) => i !== (typeof q.answer === 'number' ? q.answer : 0)) }));
  const openIn = j.open || (j.questions || []).find(q => q.type === 'open');
  const qs = mcIn.map(q => {
    const right = String(q.right || '').trim(), wrong = (q.wrong || []).map(String).map(x => x.trim()).filter(x => x && norm(x) !== norm(right));
    if (!real(q.q) || !right || wrong.length < 2 || PLACEHOLDER.test(right + ' ' + wrong.join(' '))) return null;
    const mixed = shuffle([right, ...wrong.slice(0, 2)]);
    return { type: 'mc', q: String(q.q).trim(), choices: mixed, answer: mixed.indexOf(right) };
  }).filter(Boolean);
  if (qs.length < 2) throw new Error('Story came back without real questions');
  if (openIn && real(openIn.q) && openIn.idea && !PLACEHOLDER.test(openIn.idea)) qs.push({ type: 'open', q: String(openIn.q).trim(), idea: String(openIn.idea) });
  return {
    id: 'm-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), level, source: 'model',
    title: String(j.title || 'A New Story').slice(0, 80), text, questions: qs.slice(0, 4),
    vocab: (Array.isArray(j.vocab) ? j.vocab : []).filter(v => v && v.word && v.meaning && inText(v.word) && !PLACEHOLDER.test(v.meaning)),
    circle: j.circle && !PLACEHOLDER.test(j.circle.prompt || '') ? { kind: 'word', ...j.circle } : null,
    mainIdea: j.mainIdea && !PLACEHOLDER.test(j.mainIdea) ? String(j.mainIdea) : '',
  };
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
