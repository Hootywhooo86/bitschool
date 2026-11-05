#include "whisper_engine.h"

#include <algorithm>
#include <cmath>
#include <cctype>
#include <mutex>
#include <sstream>

#include "whisper.h"

namespace {
whisper_context * g_ctx = nullptr;
std::mutex        g_mutex;
}

namespace wsp {

bool loaded() { return g_ctx != nullptr; }

void unload() {
    std::lock_guard<std::mutex> lock(g_mutex);
    if (g_ctx) { whisper_free(g_ctx); g_ctx = nullptr; }
}

std::string load(const std::string & path) {
    unload();
    std::lock_guard<std::mutex> lock(g_mutex);
    whisper_context_params cp = whisper_context_default_params();
    cp.use_gpu = false;
    g_ctx = whisper_init_from_file_with_params(path.c_str(), cp);
    return g_ctx ? "" : "Could not open the listening model";
}

std::string transcribe(const float * pcm, int n, const std::string & prompt, int threads) {
    std::lock_guard<std::mutex> lock(g_mutex);
    if (!g_ctx || n < WHISPER_SAMPLE_RATE / 4) return "";
    whisper_full_params wp = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
    wp.n_threads        = threads;
    wp.language         = "en";
    wp.translate        = false;
    wp.no_context       = true;
    wp.no_timestamps    = true;
    wp.single_segment   = false;
    wp.print_progress   = false;
    wp.print_realtime   = false;
    wp.print_special    = false;
    wp.print_timestamps = false;
    wp.suppress_blank   = true;
    wp.temperature      = 0.0f;
    // The story text: Whisper then expects these words and spells names the story's way.
    wp.initial_prompt   = prompt.empty() ? nullptr : prompt.c_str();
    // Short windows: shrink the audio context to the window (plus margin) instead of a full 30 s.
    const float secs = (float) n / WHISPER_SAMPLE_RATE;
    wp.audio_ctx = std::min(1500, (int) std::ceil(secs * 50.0f * 1.25f) + 64);
    if (whisper_full(g_ctx, wp, pcm, n) != 0) return "";
    std::string out;
    const int segs = whisper_full_n_segments(g_ctx);
    for (int i = 0; i < segs; i++) out += whisper_full_get_segment_text(g_ctx, i);
    return out;
}


// ---- Stream ----
namespace {
const int   SR       = WHISPER_SAMPLE_RATE;
const int   STEP     = SR;            // re-read the current stretch after each new second of audio
const int   MAX_LEN  = SR * 10;       // never let a stretch grow past 10 s
const int   TAIL     = SR * 6 / 10;   // a 0.6 s quiet tail counts as a pause
std::string norm_word(const std::string & w) {
    std::string o;
    for (char ch : w) if (std::isalnum((unsigned char) ch)) o += (char) std::tolower((unsigned char) ch);
    return o;
}
float rms(const float * p, int n) {
    double s = 0; for (int i = 0; i < n; i++) s += (double) p[i] * p[i];
    return n ? (float) std::sqrt(s / n) : 0.f;
}
}

void Stream::begin(const std::string & story, int t) {
    audio.clear(); committed = last_run = position = 0; utterance = 1; threads = t; heard.clear();
    story_words.clear(); story_norm.clear();
    std::istringstream in(story); std::string w;
    while (in >> w) { story_words.push_back(w); story_norm.push_back(norm_word(w)); }
}

// The story from a little before where he is to well past it: Whisper keeps only the last ~200
// tokens of its hint, so a whole long story would hint at the ending instead of his place.
std::string Stream::prompt() const {
    if (story_words.empty()) return "";
    size_t a = position > 8 ? position - 8 : 0, b = std::min(story_words.size(), a + 90);
    std::string p;
    for (size_t i = a; i < b; i++) { if (i > a) p += ' '; p += story_words[i]; }
    return p;
}

// Moves the story position to just after the last words heard (matching their last two words).
void Stream::track(const std::string & text) {
    std::vector<std::string> hw; std::istringstream in(text); std::string w;
    while (in >> w) { std::string n = norm_word(w); if (!n.empty()) hw.push_back(n); }
    if (hw.size() < 2 || story_norm.size() < 2) return;
    const std::string & x = hw[hw.size() - 2], & y = hw.back();
    const size_t from = position > 10 ? position - 10 : 0;
    for (size_t i = from; i + 1 < story_norm.size() && i < position + 120; i++)
        if (story_norm[i] == x && story_norm[i + 1] == y) { position = std::max(position, i + 2); break; }
}

static int count_words(const std::string & t) { std::istringstream in(t); std::string w; int n = 0; while (in >> w) n++; return n; }

Event Stream::run(bool final) {
    const int n = (int) (audio.size() - committed);
    std::string text = transcribe(audio.data() + committed, n, prompt(), threads);
    // Whisper sometimes answers silence with captions; those aren't his words.
    auto caption = [](const std::string & x) { const std::string t = norm_word(x);
        return t == "blankaudio" || t == "music" || t == "silence" || t == "inaudible" || t == "thankyou" || t == "thanksforwatching"; };
    if (caption(text)) text.clear();
    // With a hint, Whisper occasionally collapses a long stretch to a word or two. Several seconds of
    // reading hold more words than that, so read the stretch again without the hint and keep whichever
    // heard more.
    const float secs = (float) n / SR;
    if (final && secs >= 3.0f && count_words(text) < secs * 0.6f) {
        std::string plain = transcribe(audio.data() + committed, n, "", threads);
        if (!caption(plain) && count_words(plain) > count_words(text)) text = plain;
    }
    Event e{ utterance, text, final };
    if (final) { track(text); committed = audio.size(); utterance++; }
    last_run = audio.size();
    return e;
}

std::vector<Event> Stream::feed(const float * pcm, int n) {
    std::vector<Event> out;
    audio.insert(audio.end(), pcm, pcm + n);
    if (audio.size() - last_run < (size_t) STEP) return out;
    const int len = (int) (audio.size() - committed);
    if (len < SR / 2) return out;
    const float whole = rms(audio.data() + committed, len);
    const float tail  = len > TAIL ? rms(audio.data() + audio.size() - TAIL, TAIL) : whole;
    const bool spoke  = whole > 0.004f;
    const bool paused = len > TAIL + SR / 2 && (tail < 0.004f || tail < whole * 0.25f);
    if (!spoke) { committed = last_run = audio.size(); return out; } // only quiet so far: skip it
    out.push_back(run(paused || len >= MAX_LEN));
    return out;
}

std::vector<Event> Stream::flush() {
    std::vector<Event> out;
    if (audio.size() - committed >= (size_t) SR / 2 && rms(audio.data() + committed, (int) (audio.size() - committed)) > 0.004f) out.push_back(run(true));
    return out;
}

}
