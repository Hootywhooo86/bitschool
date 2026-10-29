// The local story writer and answer checker: Qwen (or any model) through Ollama,
// or any OpenAI-compatible server such as LM Studio or llama.cpp.
const Model = {
  online: false,
  models: [],
  cfg() { return Store.state.settings.model; },
  base() { return this.cfg().endpoint.replace(/\/+$/, ''); },

  async ping() {
    const c = this.cfg();
    try {
      const url = c.api === 'ollama' ? this.base() + '/api/tags' : this.base() + '/v1/models';
      const r = await fetch(url, { signal: AbortSignal.timeout(2500) });
      const j = await r.json();
      this.models = c.api === 'ollama' ? (j.models || []).map(m => m.name) : (j.data || []).map(m => m.id);
      this.online = r.ok;
    } catch (e) { this.online = false; this.models = []; }
    return this.online;
  },

  async chat(system, user, { images, timeout = 180000, model } = {}) {
    const c = this.cfg(), name = model || c.name;
    let r, text;
    if (c.api === 'ollama') {
      const msg = { role: 'user', content: user };
      if (images) msg.images = images;
      r = await fetch(this.base() + '/api/chat', {
        method: 'POST', signal: AbortSignal.timeout(timeout), headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: name, stream: false, format: 'json', think: false, options: { temperature: 0.8 },
          messages: [{ role: 'system', content: system }, msg] }),
      });
      if (!r.ok) throw new Error('Model error ' + r.status + ': ' + (await r.text()).slice(0, 200));
      text = (await r.json()).message.content;
    } else {
      const content = images ? [{ type: 'text', text: user }, ...images.map(b => ({ type: 'image_url', image_url: { url: 'data:image/png;base64,' + b } }))] : user;
      r = await fetch(this.base() + '/v1/chat/completions', {
        method: 'POST', signal: AbortSignal.timeout(timeout), headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: name, temperature: 0.8, response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: system }, { role: 'user', content }] }),
      });
      if (!r.ok) throw new Error('Model error ' + r.status + ': ' + (await r.text()).slice(0, 200));
      text = (await r.json()).choices[0].message.content;
    }
    return parseJSON(text);
  },

  async writeStory(level) {
    const s = levelSpec(level);
    const n = Store.state.sessions.length;
    const genre = level >= 30 && n % 3 === 2 ? 'nonfiction (true facts, explained simply)' : 'story';
    const recent = Store.state.sessions.slice(-8).map(x => x.topic).filter(Boolean);
    const topic = shuffle(TOPICS.filter(t => !recent.includes(t)))[0];
    const system = 'You write original reading-practice passages for a child, like graded readers. You reply with JSON only.';
    const user = `Write an original ${genre} for reading level ${s.name} (${s.grade}) about: ${topic}.
Rules:
- Between ${s.minWords} and ${s.maxWords} words in "text". Aim for ${s.words}.
- Sentences average about ${s.sentenceWords} words.
- Vocabulary: ${s.vocab}.
- Kind, safe and fun for a child. Nothing scary or violent, no brands.
- Questions practice: ${s.skills}.
Reply with this JSON:
{"title": "short title",
 "text": "the passage; separate paragraphs with \\n\\n",
 "questions": [
   {"type":"mc","q":"question","choices":["CORRECT answer first","wrong answer","wrong answer"]},
   {"type":"mc","q":"question","choices":["CORRECT answer first","wrong answer","wrong answer"]},
   {"type":"open","q":"a question about the main idea or why something happened","idea":"one sentence saying what a good answer must include"}],
 "vocab": [{"word":"a harder word from the text","meaning":"a child-friendly meaning"}],
 "circle": {"prompt":"${level < 20 ? 'Circle the word that names an animal (or a thing, or a color)' : level < 40 ? 'Circle the verb' : 'Circle the describing word'}", "sentence":"one sentence copied exactly from the text", "targets":["the word(s) from that sentence to circle"]},
 "mainIdea": "the one sentence copied exactly from the text that best states the main idea"}
Give 2 to 4 vocab words.`;
    let last;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const j = await this.chat(system, user);
        const p = checkStory(j, level);
        p.topic = topic;
        return p;
      } catch (e) { last = e; }
    }
    throw last;
  },

  async judge(passage, q, answer) {
    const j = await this.chat('You check a child\'s reading comprehension answers kindly and fairly. Reply with JSON only.',
      `Passage (level ${levelName(passage.level)}):\n"""${passage.text}"""\n\nQuestion: ${q.q}\nA good answer includes: ${q.idea}\nChild's answer: "${answer}"\n\nSpelling and grammar mistakes do not matter. Did the child get the main idea? Reply {"correct": true or false, "feedback": "one short, kind sentence to the child"}`, { timeout: 60000 });
    return { correct: j.correct === true || j.correct === 'true', feedback: String(j.feedback || '') };
  },

  async define(word, sentence) {
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

// Model output is checked before a child sees it: right length, real questions, answers shuffled.
function checkStory(j, level) {
  const s = levelSpec(level);
  const text = String(j.text || '').replace(/\\n/g, '\n').trim();
  const count = words(text).length;
  if (count < s.minWords * 0.6 || count > s.maxWords * 1.6) throw new Error(`Story was ${count} words, wanted about ${s.words}`);
  const qs = (j.questions || []).map(q => {
    if (q.type === 'open' && q.q && q.idea) return { type: 'open', q: String(q.q), idea: String(q.idea) };
    const choices = (q.choices || []).map(String).filter(Boolean);
    if (!q.q || choices.length < 2) return null;
    const right = choices[typeof q.answer === 'number' ? q.answer : 0];
    const mixed = shuffle(choices);
    return { type: 'mc', q: String(q.q), choices: mixed, answer: mixed.indexOf(right) };
  }).filter(Boolean);
  if (qs.filter(q => q.type === 'mc').length < 2) throw new Error('Story came back without questions');
  return {
    id: 'm-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), level, source: 'model',
    title: String(j.title || 'A New Story').slice(0, 80), text, questions: qs.slice(0, 4),
    vocab: Array.isArray(j.vocab) ? j.vocab : [], circle: j.circle ? { kind: 'word', ...j.circle } : null,
    mainIdea: j.mainIdea ? String(j.mainIdea) : '',
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
