# The on-device story writer: llama.cpp plus a small JNI bridge.
# llama.cpp comes from the node-llama-cpp npm package; `npm run prepare-llama` unpacks it to native/.llama.cpp.
cmake_minimum_required(VERSION 3.22)
project(bitschool_llm C CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(LLAMA_SRC ${CMAKE_CURRENT_LIST_DIR}/../../../../../.llama.cpp)
if(NOT EXISTS ${LLAMA_SRC}/CMakeLists.txt)
    message(FATAL_ERROR "llama.cpp source missing. Run `npm run prepare-llama` in native/ first.")
endif()

# Several CPU variants are built and the best one for the phone is picked at startup.
set(BUILD_SHARED_LIBS ON CACHE BOOL "" FORCE)
set(GGML_NATIVE OFF CACHE BOOL "" FORCE)
set(GGML_BACKEND_DL ON CACHE BOOL "" FORCE)
set(GGML_CPU_ALL_VARIANTS ON CACHE BOOL "" FORCE)
set(GGML_LLAMAFILE OFF CACHE BOOL "" FORCE)
set(GGML_OPENMP OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_COMMON ON CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TOOLS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_SERVER OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_APP OFF CACHE BOOL "" FORCE)
set(LLAMA_CURL OFF CACHE BOOL "" FORCE)
set(LLAMA_OPENSSL OFF CACHE BOOL "" FORCE)
add_subdirectory(${LLAMA_SRC} llama)

add_library(bitschool_llm SHARED llm_jni.cpp llm_engine.cpp)
target_link_libraries(bitschool_llm llama llama-common android log)

# The Whisper listener: whisper.cpp from the whisper.rn npm package (its ggml is renamed wsp_ggml, so it
# doesn't clash with llama.cpp's). `npm run prepare-whisper` unpacks it to native/.whisper.
# Two builds like whisper.rn: plain ARMv8, and ARMv8.2 with fp16 for newer phones (picked at runtime).
set(WHISPER_SRC ${CMAKE_CURRENT_LIST_DIR}/../../../../../.whisper)
if(NOT EXISTS ${WHISPER_SRC}/whisper.cpp)
    message(FATAL_ERROR "whisper.cpp source missing. Run `npm run prepare-whisper` in native/ first.")
endif()
set(WHISPER_FILES
    ${WHISPER_SRC}/ggml.c ${WHISPER_SRC}/ggml.cpp ${WHISPER_SRC}/ggml-alloc.c ${WHISPER_SRC}/ggml-backend.cpp
    ${WHISPER_SRC}/ggml-backend-meta.cpp ${WHISPER_SRC}/ggml-backend-reg.cpp ${WHISPER_SRC}/ggml-backend-dl.cpp
    ${WHISPER_SRC}/ggml-cpu/amx/amx.cpp ${WHISPER_SRC}/ggml-cpu/amx/mmq.cpp ${WHISPER_SRC}/ggml-cpu/ggml-cpu.c
    ${WHISPER_SRC}/ggml-cpu/ggml-cpu.cpp ${WHISPER_SRC}/ggml-cpu/quants.c ${WHISPER_SRC}/ggml-cpu/traits.cpp
    ${WHISPER_SRC}/ggml-cpu/repack.cpp ${WHISPER_SRC}/ggml-cpu/unary-ops.cpp ${WHISPER_SRC}/ggml-cpu/binary-ops.cpp
    ${WHISPER_SRC}/ggml-cpu/vec.cpp ${WHISPER_SRC}/ggml-cpu/ops.cpp ${WHISPER_SRC}/ggml-opt.cpp
    ${WHISPER_SRC}/ggml-threading.cpp ${WHISPER_SRC}/ggml-quants.c ${WHISPER_SRC}/gguf.cpp
    ${WHISPER_SRC}/whisper.cpp ${WHISPER_SRC}/parakeet.cpp
    ${WHISPER_SRC}/ggml-cpu/arch/arm/quants.c ${WHISPER_SRC}/ggml-cpu/arch/arm/repack.cpp
    whisper_engine.cpp whisper_jni.cpp)
function(whisper_library name flags)
    add_library(${name} SHARED ${WHISPER_FILES})
    target_include_directories(${name} PRIVATE ${WHISPER_SRC} ${WHISPER_SRC}/ggml-cpu)
    target_compile_definitions(${name} PRIVATE WSP_GGML_USE_CPU WSP_GGML_USE_CPU_REPACK _GNU_SOURCE)
    target_compile_options(${name} PRIVATE -O3 -DNDEBUG -pthread -fvisibility=hidden -fvisibility-inlines-hidden ${flags})
    target_link_options(${name} PRIVATE -Wl,--exclude-libs,ALL)
    target_link_libraries(${name} log)
endfunction()
whisper_library(bitschool_whisper "-march=armv8-a")
whisper_library(bitschool_whisper_fp16 "-march=armv8.2-a+fp16")
