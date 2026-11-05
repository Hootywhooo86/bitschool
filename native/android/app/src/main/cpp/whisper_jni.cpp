// JNI bridge for com.bitschool.reading.WhisperPlugin.
#include <jni.h>
#include <string>

#include "whisper_engine.h"

static wsp::Stream g_stream;

static std::string str(JNIEnv * env, jstring s) {
    if (!s) return "";
    const char * c = env->GetStringUTFChars(s, nullptr);
    std::string out(c);
    env->ReleaseStringUTFChars(s, c);
    return out;
}

static std::string json(const std::vector<wsp::Event> & ev) {
    std::string o = "[";
    for (size_t i = 0; i < ev.size(); i++) {
        if (i) o += ',';
        o += "{\"utterance\":" + std::to_string(ev[i].utterance) + ",\"final\":" + (ev[i].final ? "true" : "false") + ",\"text\":\"";
        for (char c : ev[i].text) {
            if (c == '"' || c == '\\') { o += '\\'; o += c; }
            else if (c == '\n' || c == '\r' || c == '\t') o += ' ';
            else if ((unsigned char) c >= 0x20) o += c;
        }
        o += "\"}";
    }
    return o + "]";
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_bitschool_reading_WhisperPlugin_nLoad(JNIEnv * env, jclass, jstring path) {
    return env->NewStringUTF(wsp::load(str(env, path)).c_str());
}

extern "C" JNIEXPORT void JNICALL
Java_com_bitschool_reading_WhisperPlugin_nBegin(JNIEnv * env, jclass, jstring story, jint threads) {
    g_stream.begin(str(env, story), threads);
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_bitschool_reading_WhisperPlugin_nFeed(JNIEnv * env, jclass, jshortArray pcm, jint n) {
    std::vector<float> f(n);
    jshort * s = env->GetShortArrayElements(pcm, nullptr);
    for (int i = 0; i < n; i++) f[i] = s[i] / 32768.0f;
    env->ReleaseShortArrayElements(pcm, s, JNI_ABORT);
    return env->NewStringUTF(json(g_stream.feed(f.data(), n)).c_str());
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_bitschool_reading_WhisperPlugin_nFlush(JNIEnv * env, jclass) {
    return env->NewStringUTF(json(g_stream.flush()).c_str());
}

extern "C" JNIEXPORT void JNICALL
Java_com_bitschool_reading_WhisperPlugin_nUnload(JNIEnv *, jclass) { wsp::unload(); }
