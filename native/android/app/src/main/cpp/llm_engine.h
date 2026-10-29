// On-device story writer: one llama.cpp model, chat template from the model, JSON-schema grammar.
#pragma once
#include <functional>
#include <string>

namespace llm {
// Loads llama.cpp's CPU backends: from a folder of variants (Android), or the built-in one if empty.
void init(const std::string & backend_dir);
// Loads the model; returns an empty string on success, else the reason it failed.
std::string load(const std::string & path, int n_ctx, int n_threads);
// Runs one system + user turn with thinking off. A non-empty schema forces JSON of that shape.
// on_progress is called with the number of tokens written so far; returning false stops early.
std::string generate(const std::string & system, const std::string & user, const std::string & schema,
                     int max_tokens, float temperature, const std::function<bool(int)> & on_progress);
void stop();
void unload();
bool loaded();
}
