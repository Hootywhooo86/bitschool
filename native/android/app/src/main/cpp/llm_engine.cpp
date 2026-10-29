#include "llm_engine.h"

#include <algorithm>
#include <atomic>
#include <mutex>
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
    cp.n_batch = 512;
    cp.n_ubatch = 512;
    cp.n_threads = n_threads;
    cp.n_threads_batch = n_threads;
    g_ctx = llama_init_from_model(g_model, cp);
    if (!g_ctx) { llama_model_free(g_model); g_model = nullptr; return "Not enough memory for this model"; }
    g_templates = common_chat_templates_init(g_model, "");
    return "";
}

void stop() { g_stop = true; }

std::string generate(const std::string & system, const std::string & user, const std::string & schema,
                     int max_tokens, float temperature, const std::function<bool(int)> & on_progress) {
    std::lock_guard<std::mutex> lock(g_mutex);
    if (!g_model || !g_ctx) throw std::runtime_error("No model loaded");
    g_stop = false;
    const llama_vocab * vocab = llama_model_get_vocab(g_model);

    // The model's own chat template, with thinking turned off (Qwen3.5 would otherwise reason first).
    common_chat_templates_inputs in;
    common_chat_msg sys; sys.role = "system"; sys.content = system;
    common_chat_msg usr; usr.role = "user";   usr.content = user;
    in.messages = { sys, usr };
    in.use_jinja = true;
    in.enable_thinking = false;
    in.add_generation_prompt = true;
    const std::string prompt = common_chat_templates_apply(g_templates.get(), in).prompt.str();

    std::vector<llama_token> tokens = common_tokenize(g_ctx, prompt, true, true);
    const int n_ctx = (int) llama_n_ctx(g_ctx);
    if ((int) tokens.size() + max_tokens > n_ctx) max_tokens = std::max(64, n_ctx - (int) tokens.size());
    if ((int) tokens.size() >= n_ctx) throw std::runtime_error("Prompt is too long");

    llama_memory_clear(llama_get_memory(g_ctx), true);
    for (size_t i = 0; i < tokens.size(); i += 512) {
        const int n = (int) std::min<size_t>(512, tokens.size() - i);
        if (llama_decode(g_ctx, llama_batch_get_one(tokens.data() + i, n))) throw std::runtime_error("Could not read the prompt");
    }

    llama_sampler * smpl = llama_sampler_chain_init(llama_sampler_chain_default_params());
    if (!schema.empty()) {
        const std::string gbnf = json_schema_to_grammar(common_json::parse(schema));
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
            llama_token tok = llama_sampler_sample(smpl, g_ctx, -1);
            if (llama_vocab_is_eog(vocab, tok)) break;
            out += common_token_to_piece(g_ctx, tok, false);
            if (llama_decode(g_ctx, llama_batch_get_one(&tok, 1))) throw std::runtime_error("Generation failed");
            if (on_progress && n % 8 == 0 && !on_progress(n)) break;
        }
    } catch (...) { llama_sampler_free(smpl); throw; }
    llama_sampler_free(smpl);
    return out;
}

}
