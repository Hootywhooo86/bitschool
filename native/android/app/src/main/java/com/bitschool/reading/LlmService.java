package com.bitschool.reading;

import android.app.Service;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.Message;
import android.os.Messenger;
import android.os.RemoteException;
import android.system.Os;
import android.util.Log;
import java.io.File;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

// The story writer (llama.cpp) runs here, in its own process (":llm" in the manifest). If the model
// crashes or the system stops it for memory, only this process ends: the app stays open, is told, and
// carries on with the built-in stories. LocalLlmPlugin talks to it with messages.
public class LlmService extends Service {

    static { System.loadLibrary("bitschool_llm"); }

    static final int LOAD = 1, GENERATE = 2, STOP = 3, PAUSE = 4, UNLOAD = 5;
    static final int R_OK = 10, R_ERROR = 11, R_PROGRESS = 12, R_TEXT = 13;
    // The plain ARMv8.0 build of llama.cpp's CPU code, for "safe mode" after a crash.
    static final String SAFE_CPU_LIB = "libggml-cpu-android_armv8.0_1.so";

    interface Progress { boolean onTokens(int n); }

    static native void nInit(String libDir);
    static native String nLoad(String path, int nCtx, int nThreads);
    static native void nPause(boolean on);
    static native String nGenerate(String system, String history, String user, String schema, int maxTokens, float temperature, Progress p);
    static native void nStop();
    static native void nUnload();

    private final ExecutorService runner = Executors.newSingleThreadExecutor();
    private boolean started = false;
    private String loaded = null;

    private final Messenger messenger = new Messenger(new Handler(Looper.getMainLooper()) {
        @Override
        public void handleMessage(Message msg) {
            final int what = msg.what, id = msg.arg1, arg2 = msg.arg2;
            final Bundle b = msg.getData() == null ? new Bundle() : new Bundle(msg.getData());
            final Messenger to = msg.replyTo;
            switch (what) {
                case STOP: nStop(); break;          // straight away, while a story is being written
                case PAUSE: nPause(arg2 == 1); break;
                case LOAD: runner.execute(() -> load(to, id, b)); break;
                case GENERATE: runner.execute(() -> generate(to, id, b)); break;
                case UNLOAD: runner.execute(() -> { nUnload(); loaded = null; reply(to, R_OK, id, 0, null); }); break;
                default: break;
            }
        }
    });

    @Override
    public IBinder onBind(Intent intent) { return messenger.getBinder(); }

    private void load(Messenger to, int id, Bundle b) {
        String path = b.getString("path");
        try {
            if (!started) {
                String libDir = getApplicationInfo().nativeLibraryDir;
                String dir = b.getBoolean("safe") ? safeDir(libDir) : libDir;
                Log.i("bitschool-llm", "starting the engine from " + dir + (b.getBoolean("safe") ? " (safe mode)" : ""));
                nInit(dir);
                started = true;
            }
            if (path != null && path.equals(loaded)) { reply(to, R_OK, id, 0, null); return; }
            Log.i("bitschool-llm", "loading " + path + " ctx=" + b.getInt("nCtx") + " threads=" + b.getInt("threads"));
            String err = nLoad(path, b.getInt("nCtx", 4096), b.getInt("threads", 2));
            if (!err.isEmpty()) { loaded = null; replyError(to, id, err); return; }
            loaded = path;
            Log.i("bitschool-llm", "loaded");
            reply(to, R_OK, id, 0, null);
        } catch (Throwable e) {
            replyError(to, id, String.valueOf(e.getMessage()));
        }
    }

    private void generate(Messenger to, int id, Bundle b) {
        if (loaded == null) { replyError(to, id, "No model loaded"); return; }
        try {
            String text = nGenerate(b.getString("system", ""), b.getString("history", ""), b.getString("user", ""), b.getString("schema", ""),
                b.getInt("maxTokens", 1500), b.getFloat("temperature", 0.8f), n -> { reply(to, R_PROGRESS, id, n, null); return true; });
            Bundle out = new Bundle();
            out.putString("text", text);
            reply(to, R_TEXT, id, 0, out);
        } catch (Throwable e) {
            replyError(to, id, String.valueOf(e.getMessage()));
        }
    }

    // A folder holding only the plain ARMv8.0 CPU build, so llama.cpp can't pick a faster one that this
    // processor might not really support.
    private String safeDir(String libDir) {
        File d = new File(getFilesDir(), "ggml-safe");
        d.mkdirs();
        File[] old = d.listFiles();
        if (old != null) for (File f : old) f.delete();
        try { Os.symlink(new File(libDir, SAFE_CPU_LIB).getPath(), new File(d, SAFE_CPU_LIB).getPath()); }
        catch (Exception e) { Log.w("bitschool-llm", "safe mode not available: " + e); return libDir; }
        return d.getPath();
    }

    private static void replyError(Messenger to, int id, String message) {
        Bundle out = new Bundle();
        out.putString("error", message);
        reply(to, R_ERROR, id, 0, out);
    }

    private static void reply(Messenger to, int what, int id, int arg2, Bundle data) {
        if (to == null) return;
        Message m = Message.obtain(null, what, id, arg2);
        if (data != null) m.setData(data);
        try { to.send(m); } catch (RemoteException ignored) {}
    }
}
