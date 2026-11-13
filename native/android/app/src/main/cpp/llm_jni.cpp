// JNI bridge for com.bitschool.reading.LlmService (the story writer, in its own process).
#include <jni.h>
#include <android/log.h>
#include <stdexcept>
#include <string>

#include "llama.h"
#include "llm_engine.h"

static std::string str(JNIEnv * env, jstring s) {
    if (!s) return "";
    const char * c = env->GetStringUTFChars(s, nullptr);
    std::string out(c);
    env->ReleaseStringUTFChars(s, c);
    return out;
}

// While the engine starts and a model loads, llama.cpp's own progress lines go to the log too, so a
// crash report shows how far it got. After that only warnings.
static bool g_verbose = true;
static void log_to_android(ggml_log_level level, const char * text, void *) {
    if (level >= GGML_LOG_LEVEL_WARN) __android_log_print(ANDROID_LOG_WARN, "bitschool-llm", "%s", text);
    else if (g_verbose && level >= GGML_LOG_LEVEL_INFO) __android_log_print(ANDROID_LOG_INFO, "bitschool-llm", "%s", text);
}

extern "C" JNIEXPORT void JNICALL
Java_com_bitschool_reading_LlmService_nInit(JNIEnv * env, jclass, jstring lib_dir) {
    llama_log_set(log_to_android, nullptr);
    try { llm::init(str(env, lib_dir)); }
    catch (const std::exception & e) { __android_log_print(ANDROID_LOG_ERROR, "bitschool-llm", "init failed: %s", e.what()); }
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_bitschool_reading_LlmService_nLoad(JNIEnv * env, jclass, jstring path, jint n_ctx, jint n_threads) {
    std::string err;
    g_verbose = true;
    try { err = llm::load(str(env, path), n_ctx, n_threads); }
    catch (const std::exception & e) { err = std::string("Could not load the model: ") + e.what(); }
    g_verbose = false;
    if (!err.empty()) __android_log_print(ANDROID_LOG_ERROR, "bitschool-llm", "load failed: %s", err.c_str());
    return env->NewStringUTF(err.c_str());
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_bitschool_reading_LlmService_nGenerate(JNIEnv * env, jclass, jstring system, jstring history, jstring user, jstring schema,
                                                     jint max_tokens, jfloat temperature, jobject progress) {
    jclass cls = progress ? env->GetObjectClass(progress) : nullptr;
    jmethodID on_tokens = cls ? env->GetMethodID(cls, "onTokens", "(I)Z") : nullptr;
    __android_log_print(ANDROID_LOG_INFO, "bitschool-llm", "writing (up to %d tokens)", (int) max_tokens);
    try {
        std::string out = llm::generate(str(env, system), str(env, history), str(env, user), str(env, schema), max_tokens, temperature,
            [&](int n) { return on_tokens ? (bool) env->CallBooleanMethod(progress, on_tokens, n) : true; });
        return env->NewStringUTF(out.c_str());
    } catch (const std::exception & e) {
        env->ThrowNew(env->FindClass("java/lang/RuntimeException"), e.what());
        return nullptr;
    }
}

extern "C" JNIEXPORT void JNICALL
Java_com_bitschool_reading_LlmService_nStop(JNIEnv *, jclass) { llm::stop(); }

extern "C" JNIEXPORT void JNICALL
Java_com_bitschool_reading_LlmService_nPause(JNIEnv *, jclass, jboolean on) { llm::pause(on); }

extern "C" JNIEXPORT void JNICALL
Java_com_bitschool_reading_LlmService_nUnload(JNIEnv *, jclass) { llm::unload(); }
