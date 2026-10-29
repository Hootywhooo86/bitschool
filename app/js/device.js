// The story writer that runs inside the app itself, with a model downloaded onto the device.
// Android: the LocalLlm plugin (llama.cpp). Windows: the desktop app's engine (node-llama-cpp).
// The website has neither; there the story writer runs on a computer through Ollama or LM Studio.
const HF = 'https://huggingface.co/unsloth/';
const DEVICE_MODELS = [
  { id: 'qwen3.5-2b', name: 'Qwen3.5 2B', file: 'Qwen3.5-2B-Q4_K_M.gguf', url: HF + 'Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-Q4_K_M.gguf',
    size: 1280835840, ramGB: 4, best: 'phone', note: 'Best for phones and tablets. Good stories at every level.' },
  { id: 'qwen3.5-4b', name: 'Qwen3.5 4B', file: 'Qwen3.5-4B-Q4_K_M.gguf', url: HF + 'Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-Q4_K_M.gguf',
    size: 2740937888, ramGB: 8, best: 'pc', note: 'Best stories. For computers and tablets with 8 GB of memory or more; slower.' },
];

const Device = {
  api: (window.bitschoolNative && window.bitschoolNative.llm) || nativePlugin('LocalLlm'),
  state: { files: [], ram: 0, freeSpace: 0, cores: 0, loaded: null },
  downloading: null, // { id, loaded, total }
  busy: false,
  available() { return !!this.api; },
  isPC() { return !!window.bitschoolNative; },
  model(id) { return DEVICE_MODELS.find(m => m.id === id); },
  selected() { return this.model(Store.state.settings.model.device) || null; },
  has(m) { return !!m && this.state.files.some(f => f.file === m.file && f.size >= m.size * 0.98); },
  ready() { return this.available() && this.has(this.selected()); },
  // Which model to suggest for this device.
  recommended() {
    if (this.isPC() || this.state.ram >= 7.5e9) return this.model('qwen3.5-4b');
    return this.model('qwen3.5-2b');
  },

  async refresh() {
    if (!this.available()) return this.state;
    try { this.state = await this.api.info(); } catch (e) {}
    return this.state;
  },

  async download(m, onProgress) {
    if (this.downloading) throw new Error('Another download is running');
    this.downloading = { id: m.id, loaded: 0, total: m.size };
    const h = await this.api.addListener('download', p => {
      if (p.file !== m.file) return;
      this.downloading = { id: m.id, loaded: p.loaded, total: p.total || m.size };
      onProgress && onProgress(this.downloading);
    });
    try { await this.api.download({ url: m.url, file: m.file }); }
    finally { this.downloading = null; h && h.remove(); await this.refresh(); }
  },
  cancel() { if (this.available()) this.api.cancelDownload().catch(() => {}); },
  async remove(m) { await this.api.remove({ file: m.file }); await this.refresh(); },

  // One system + user turn on the selected model. Loads it the first time.
  async chat(system, user, { schema, onProgress } = {}) {
    const m = this.selected();
    if (!this.has(m)) throw new Error('Download a story writer in Grown-ups → Settings first');
    if (this.state.loaded !== m.file) {
      await this.api.loadModel({ file: m.file, nCtx: 4096 });
      this.state.loaded = m.file;
    }
    const h = onProgress ? await this.api.addListener('progress', p => onProgress(p.tokens)) : null;
    this.busy = true;
    try {
      const r = await this.api.generate({ system, user, schema: schema ? JSON.stringify(schema) : '', maxTokens: 1500, temperature: 0.8 });
      return r.text;
    } finally { this.busy = false; h && h.remove(); }
  },
};
