// Listening with Whisper: one model, short windows of 16 kHz audio in, text out.
#pragma once
#include <string>
#include <vector>

namespace wsp {
// Loads the model; returns an empty string on success, else the reason it failed.
std::string load(const std::string & path);
// Transcribes mono 16 kHz samples. prompt: the story text he is reading, which steers Whisper
// toward the right words. Returns the words heard.
std::string transcribe(const float * pcm, int n, const std::string & prompt, int threads);
void unload();
bool loaded();

// Live listening: audio goes in as it is recorded; Whisper re-reads the current stretch about once a
// second ("partial"), and when he pauses (or the stretch reaches 10 s) the stretch is "final" and a
// new one starts. The hint given to Whisper is the part of the story around where he is reading.
struct Event { int utterance; std::string text; bool final; };
class Stream {
public:
    void begin(const std::string & story, int threads);
    std::vector<Event> feed(const float * pcm, int n);
    std::vector<Event> flush();
    size_t samples() const { return audio.size(); }
    const std::vector<float> & recording() const { return audio; }
private:
    std::vector<float> audio;
    std::vector<std::string> story_words, story_norm;
    size_t committed = 0, last_run = 0, position = 0;
    int utterance = 1, threads = 4;
    std::string heard;
    Event run(bool final);
    std::string prompt() const;
    void track(const std::string & text);
};
}
