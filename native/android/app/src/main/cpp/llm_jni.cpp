// JNI bridge for com.bitschool.reading.LocalLlmPlugin.
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

static void log_to_android(ggml_log_level level, const char * text, void *) {
    if (level >= GGML_LOG_LEVEL_WARN) __android_log_print(ANDROID_LOG_WARN, "bitschool-llm", "%s", text);
}

extern "C" JNIEXPORT void JNICALL
Java_com_bitschool_reading_LocalLlmPlugin_nInit(JNIEnv * env, jclass, jstring lib_dir) {
    llama_log_set(log_to_android, nullptr);
    llm::init(str(env, lib_dir));
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_bitschool_reading_LocalLlmPlugin_nLoad(JNIEnv * env, jclass, jstring path, jint n_ctx, jint n_threads) {
    return env->NewStringUTF(llm::load(str(env, path), n_ctx, n_threads).c_str());
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_bitschool_reading_LocalLlmPlugin_nGenerate(JNIEnv * env, jclass, jstring system, jstring user, jstring schema,
                                                     jint max_tokens, jfloat temperature, jobject progress) {
    jclass cls = progress ? env->GetObjectClass(progress) : nullptr;
    jmethodID on_tokens = cls ? env->GetMethodID(cls, "onTokens", "(I)Z") : nullptr;
    try {
        std::string out = llm::generate(str(env, system), str(env, user), str(env, schema), max_tokens, temperature,
            [&](int n) { return on_tokens ? (bool) env->CallBooleanMethod(progress, on_tokens, n) : true; });
        return env->NewStringUTF(out.c_str());
    } catch (const std::exception & e) {
        env->ThrowNew(env->FindClass("java/lang/RuntimeException"), e.what());
        return nullptr;
    }
}

extern "C" JNIEXPORT void JNICALL
Java_com_bitschool_reading_LocalLlmPlugin_nStop(JNIEnv *, jclass) { llm::stop(); }

extern "C" JNIEXPORT void JNICALL
Java_com_bitschool_reading_LocalLlmPlugin_nUnload(JNIEnv *, jclass) { llm::unload(); }
