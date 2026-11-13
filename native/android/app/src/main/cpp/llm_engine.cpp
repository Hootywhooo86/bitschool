#include "llm_engine.h"

#include <algorithm>
#include <atomic>
#include <chrono>
#include <mutex>
#include <thread>
#include <stdexcept>
#include <vector>

#include "chat.h"
#include "common.h"
#include "json-schema-to-grammar.h"
#include "llama.h"

namespace {
llama_model *             g_model = nullptr;
llama_context *           g_ctx   = nullptr;
common_chat_templates_ptr g_templates;
std::atomic<bool>         g_stop{false};
std::atomic<bool>         g_pause{false};
// The tokens now in the model's memory, so the next prompt only reads what changed.
std::vector<llama_token>  g_past;
// The last reply, so a follow-up turn about it can carry straight on from it.
std::string               g_last_out;
std::mutex                g_mutex;
bool                      g_backend = false;
}

namespace llm {

bool loaded() { return g_model && g_ctx; }

void init(const std::string & backend_dir) {
    std::lock_guard<std::mutex> lock(g_mutex);
    if (g_backend) return;
    if (backend_dir.empty()) ggml_backend_load_all();
    else ggml_backend_load_all_from_path(backend_dir.c_str());
    llama_backend_init();
    g_backend = true;
}

void unload() {
    std::lock_guard<std::mutex> lock(g_mutex);
    g_templates.reset();
    g_past.clear(); g_last_out.clear();
    if (g_ctx) { llama_free(g_ctx); g_ctx = nullptr; }
    if (g_model) { llama_model_free(g_model); g_model = nullptr; }
}

std::string load(const std::string & path, int n_ctx, int n_threads) {
    if (!g_backend) init("");
    unload();
    std::lock_guard<std::mutex> lock(g_mutex);
    if (!g_backend) return "Engine not started";
    llama_model_params mp = llama_model_default_params();
    g_model = llama_model_load_from_file(path.c_str(), mp);
    if (!g_model) return "Could not open the model file";
    llama_context_params cp = llama_context_default_params();
    cp.n_ctx = n_ctx;
    // Small compute batches: the buffer for the model's word scores is (vocabulary × batch), which for
    // Qwen3.5's 248k-word vocabulary at 512 was about 500 MB. At 128 it is a quarter of that, which
    // matters on a tablet with 3–4 GB of memory.
    cp.n_batch = 512;
    cp.n_ubatch = 128;
    cp.n_threads = n_threads;
    cp.n_threads_batch = n_threads;
    g_ctx = llama_init_from_model(g_model, cp);
    if (!g_ctx) { llama_model_free(g_model); g_model = nullptr; return "Not enough memory for this model"; }
    g_templates = common_chat_templates_init(g_model, "");
    return "";
}

void stop() { g_stop = true; }
void pause(bool on) { g_pause = on; }

// While paused (the app is listening to him read with Whisper) the writer waits, so both don't fight
// over the phone's processor.
static void wait_while_paused() {
    while (g_pause && !g_stop) std::this_thread::sleep_for(std::chrono::milliseconds(50));
}

std::string generate(const std::string & system, const std::string & history, const std::string & user, const std::string & schema,
                     int max_tokens, float temperature, const std::function<bool(int)> & on_progress) {
    std::lock_guard<std::mutex> lock(g_mutex);
    if (!g_model || !g_ctx) throw std::runtime_error("No model loaded");
    g_stop = false;
    const llama_vocab * vocab = llama_model_get_vocab(g_model);

    // The model's own chat template, with thinking turned off (Qwen3.5 would otherwise reason first).
    common_chat_templates_inputs in;
    common_chat_msg sys; sys.role = "system"; sys.content = system;
    common_chat_msg usr; usr.role = "user";   usr.content = user;
    in.messages = { sys };
    // Earlier turns of the same job (e.g. the story, then its questions), as a JSON array of {role, content}.
    if (!history.empty()) {
        for (const auto & h : common_json::parse(history)) {
            common_chat_msg m; m.role = h.at("role").get<std::string>(); m.content = h.at("content").get<std::string>();
            in.messages.push_back(m);
        }
    }
    in.messages.push_back(usr);
    in.use_jinja = true;
    in.enable_thinking = false;
    in.add_generation_prompt = true;
    const std::string prompt = common_chat_templates_apply(g_templates.get(), in).prompt.str();

    const int n_ctx = (int) llama_n_ctx(g_ctx);
    llama_memory_t mem = llama_get_memory(g_ctx);
    std::vector<llama_token> todo; // tokens still to read

    // A follow-up about the reply just written (the story, then its questions): the model's memory already
    // holds that turn, so carry on from it instead of reading everything again. Chat templates rewrite
    // earlier turns (Qwen drops the empty thinking block), and models with recurrent layers (Qwen3.5) can't
    // drop the end of their memory, so this is the only way to reuse it there.
    const std::string gen_marker = "<|im_start|>assistant\n";
    const size_t gen_at = prompt.rfind(gen_marker);
    bool follow_up = false;
    if (!history.empty() && !g_past.empty() && !g_last_out.empty() && gen_at != std::string::npos &&
        prompt.find("<|im_start|>user\n" + user + "<|im_end|>\n") != std::string::npos) {
        const auto h = common_json::parse(history);
        if (!h.empty() && h.back().at("role") == "assistant" && h.back().at("content") == g_last_out) {
            const std::string more = "<|im_end|>\n<|im_start|>user\n" + user + "<|im_end|>\n" + prompt.substr(gen_at);
            todo = common_tokenize(g_ctx, more, false, true);
            follow_up = (int) (g_past.size() + todo.size()) + 64 < n_ctx;
        }
    }
    if (!follow_up) {
        std::vector<llama_token> tokens = common_tokenize(g_ctx, prompt, true, true);
        if ((int) tokens.size() >= n_ctx) throw std::runtime_error("Prompt is too long");
        // Keep the part of the last prompt this one starts with (the instructions); only the rest is read
        // again. One token is always re-read so there is something to sample from. Models that can't drop
        // the end of their memory start over.
        size_t keep = 0;
        while (keep < g_past.size() && keep + 1 < tokens.size() && g_past[keep] == tokens[keep]) keep++;
        if (keep == 0 || !llama_memory_seq_rm(mem, 0, (llama_pos) keep, -1)) { llama_memory_clear(mem, true); keep = 0; }
        g_past.assign(tokens.begin(), tokens.begin() + keep);
        todo.assign(tokens.begin() + keep, tokens.end());
    }
    g_last_out.clear();
    const int used = (int) (g_past.size() + todo.size());
    if (used + max_tokens > n_ctx) max_tokens = std::max(64, n_ctx - used);

    for (size_t i = 0; i < todo.size(); i += 512) {
        wait_while_paused();
        if (g_stop) throw std::runtime_error("Stopped");
        const int n = (int) std::min<size_t>(512, todo.size() - i);
        if (llama_decode(g_ctx, llama_batch_get_one(todo.data() + i, n))) { g_past.clear(); llama_memory_clear(mem, true); throw std::runtime_error("Could not read the prompt"); }
        g_past.insert(g_past.end(), todo.begin() + i, todo.begin() + i + n);
    }

    llama_sampler * smpl = llama_sampler_chain_init(llama_sampler_chain_default_params());
    if (!schema.empty()) {
        std::string gbnf = json_schema_to_grammar(common_json::parse(schema));
        // JSON on one line: no newlines or indenting between values. A small model on a phone writes
        // about a third fewer tokens that way, so the story and its questions come back sooner.
        const size_t sp = gbnf.find("\nspace ::=");
        if (sp != std::string::npos) {
            const size_t end = gbnf.find('\n', sp + 1);
            gbnf.replace(sp, (end == std::string::npos ? gbnf.size() : end) - sp, "\nspace ::= | \" \"");
        }
        llama_sampler * grammar = llama_sampler_init_grammar(vocab, gbnf.c_str(), "root");
        if (!grammar) { llama_sampler_free(smpl); throw std::runtime_error("Bad JSON schema"); }
        llama_sampler_chain_add(smpl, grammar);
    }
    // Qwen's recommended non-thinking settings; the presence penalty stops small models repeating themselves.
    llama_sampler_chain_add(smpl, llama_sampler_init_top_k(20));
    llama_sampler_chain_add(smpl, llama_sampler_init_penalties(llama_vocab_n_tokens(vocab), 256, 1.0f, 0.0f, 1.5f));
    llama_sampler_chain_add(smpl, llama_sampler_init_top_p(0.8f, 1));
    llama_sampler_chain_add(smpl, llama_sampler_init_temp(temperature));
    llama_sampler_chain_add(smpl, llama_sampler_init_dist(LLAMA_DEFAULT_SEED));

    std::string out;
    int n = 0;
    try {
        for (; n < max_tokens && !g_stop; n++) {
            wait_while_paused();
            llama_token tok = llama_sampler_sample(smpl, g_ctx, -1);
            if (llama_vocab_is_eog(vocab, tok)) break;
            out += common_token_to_piece(g_ctx, tok, false);
            if (llama_decode(g_ctx, llama_batch_get_one(&tok, 1))) { g_past.clear(); llama_memory_clear(mem, true); throw std::runtime_error("Generation failed"); }
            g_past.push_back(tok);
            if (on_progress && n % 8 == 0 && !on_progress(n)) break;
        }
    } catch (...) { llama_sampler_free(smpl); throw; }
    llama_sampler_free(smpl);
    if (!g_stop) g_last_out = out;
    return out;
}

}
