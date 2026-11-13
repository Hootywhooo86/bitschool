package com.bitschool.reading;

import android.app.ActivityManager;
import android.app.ApplicationExitInfo;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.Message;
import android.os.Messenger;
import android.os.RemoteException;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.text.DateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

// The on-device story writer: downloads a model into the app's private storage; LlmService runs it
// with llama.cpp in its own process, so a crash there never closes the app.
@CapacitorPlugin(name = "LocalLlm")
public class LocalLlmPlugin extends Plugin {

    private final ExecutorService runner = Executors.newSingleThreadExecutor();
    private final ExecutorService downloader = Executors.newSingleThreadExecutor();
    private volatile boolean cancelDownload = false;
    private String loadedFile = null;

    // The connection to LlmService. Calls wait in `queued` until it is connected.
    private Messenger service = null;
    private boolean bound = false;
    private final List<Runnable> queued = new ArrayList<>();
    private final Map<Integer, PluginCall> pending = new HashMap<>();
    private final Map<Integer, String> pendingKind = new HashMap<>();
    private int nextId = 1;
    private boolean generating = false;

    // After this many crashes in a row the story writer is turned off until a grown-up tries again.
    private static final int MAX_CRASHES = 3;

    private SharedPreferences prefs() { return getContext().getSharedPreferences("llm", Context.MODE_PRIVATE); }

    private final Messenger replies = new Messenger(new Handler(Looper.getMainLooper()) {
        @Override
        public void handleMessage(Message msg) {
            int id = msg.arg1;
            PluginCall call = pending.get(id);
            if (msg.what == LlmService.R_PROGRESS) {
                JSObject p = new JSObject();
                p.put("tokens", msg.arg2);
                notifyListeners("progress", p);
                return;
            }
            pending.remove(id);
            String kind = pendingKind.remove(id);
            if ("generate".equals(kind)) generating = false;
            if (call == null) return;
            Bundle b = msg.getData();
            if (msg.what == LlmService.R_ERROR) { call.reject(b == null ? "Story writer error" : b.getString("error", "Story writer error")); return; }
            if (msg.what == LlmService.R_TEXT) {
                // A story was written: the writer works on this device, so earlier crashes are forgotten.
                prefs().edit().putInt("crashes", 0).apply();
                JSObject ret = new JSObject();
                ret.put("text", b == null ? "" : b.getString("text", ""));
                call.resolve(ret);
                return;
            }
            if ("load".equals(kind)) loadedFile = pendingFile.remove(id);
            call.resolve();
        }
    });
    private final Map<Integer, String> pendingFile = new HashMap<>();

    private final ServiceConnection connection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder binder) {
            service = new Messenger(binder);
            List<Runnable> run = new ArrayList<>(queued);
            queued.clear();
            for (Runnable r : run) r.run();
        }

        // The story writer's process ended (a crash, or the system needed the memory). Every call
        // waiting on it fails with the reason; the system starts it again for the next call.
        @Override
        public void onServiceDisconnected(ComponentName name) {
            service = null;
            loadedFile = null;
            boolean wasWorking = !pending.isEmpty();
            String why = wasWorking ? recordCrash() : null;
            for (PluginCall call : pending.values()) call.reject("The story writer stopped on this device" + (why == null ? "" : " (" + why + ")"));
            pending.clear(); pendingKind.clear(); pendingFile.clear();
            generating = false;
        }
    };

    @Override
    public void load() { bind(); }

    private void bind() {
        if (bound) return;
        bound = getContext().bindService(new Intent(getContext(), LlmService.class), connection, Context.BIND_AUTO_CREATE);
    }

    @Override
    protected void handleOnDestroy() {
        if (bound) { try { getContext().unbindService(connection); } catch (Exception ignored) {} bound = false; }
    }

    // Sends one message to LlmService once it is connected; the reply settles the call.
    private void send(int what, PluginCall call, String kind, Bundle data, int arg2) {
        Runnable r = () -> {
            int id = nextId++;
            if (call != null) { pending.put(id, call); pendingKind.put(id, kind); }
            if (data != null && data.getString("file") != null) pendingFile.put(id, data.getString("file"));
            Message m = Message.obtain(null, what, id, arg2);
            if (data != null) m.setData(data);
            m.replyTo = replies;
            try { service.send(m); }
            catch (RemoteException e) {
                pending.remove(id); pendingKind.remove(id);
                if (call != null) call.reject("The story writer isn't running");
            }
        };
        new Handler(Looper.getMainLooper()).post(() -> {
            if (service != null) r.run();
            else { queued.add(r); bind(); }
        });
    }

    // Why the story writer's process ended last, from Android's own record (Android 11+).
    private String recordCrash() {
        SharedPreferences p = prefs();
        int crashes = p.getInt("crashes", 0) + 1;
        String why = "it closed unexpectedly";
        if (Build.VERSION.SDK_INT >= 30) {
            try {
                ActivityManager am = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
                List<ApplicationExitInfo> list = am.getHistoricalProcessExitReasons(getContext().getPackageName(), 0, 10);
                for (ApplicationExitInfo e : list) {
                    if (e.getProcessName() == null || !e.getProcessName().endsWith(":llm")) continue;
                    why = exitReason(e.getReason()) + (e.getDescription() != null ? " — " + e.getDescription() : "")
                        + " · memory used " + (e.getPss() / 1024) + " MB";
                    break;
                }
            } catch (Exception ignored) {}
        }
        p.edit().putInt("crashes", crashes).putBoolean("safe", true)
            .putString("problem", DateFormat.getDateTimeInstance().format(new Date()) + ": " + why).apply();
        return why;
    }

    private static String exitReason(int r) {
        switch (r) {
            case 3: return "the system ran out of memory"; // REASON_LOW_MEMORY
            case 4: return "it crashed";                    // REASON_CRASH
            case 5: return "it crashed in the engine";      // REASON_CRASH_NATIVE
            case 6: return "it stopped responding";         // REASON_ANR
            case 9: return "it used too much memory";       // REASON_EXCESSIVE_RESOURCE_USAGE
            case 10: return "the app was closed";           // REASON_USER_REQUESTED
            case 2: return "it was stopped by a signal";    // REASON_SIGNALED
            default: return "reason " + r;
        }
    }

    private File dir() {
        File d = new File(getContext().getFilesDir(), "models");
        d.mkdirs();
        return d;
    }

    // Only plain file names: models live in one folder.
    private File modelFile(String name) {
        if (name == null || !name.matches("[A-Za-z0-9._-]+\\.(gguf|bin)")) return null;
        return new File(dir(), name);
    }

    @PluginMethod
    public void info(PluginCall call) {
        ActivityManager am = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
        ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
        am.getMemoryInfo(mi);
        JSArray files = new JSArray();
        File[] list = dir().listFiles();
        if (list != null) for (File f : list) {
            if (!f.getName().endsWith(".gguf") && !f.getName().endsWith(".bin")) continue;
            JSObject o = new JSObject();
            o.put("file", f.getName());
            o.put("size", f.length());
            files.put(o);
        }
        JSObject ret = new JSObject();
        ret.put("files", files);
        ret.put("ram", mi.totalMem);
        ret.put("freeSpace", dir().getUsableSpace());
        ret.put("cores", Runtime.getRuntime().availableProcessors());
        ret.put("loaded", loadedFile);
        call.resolve(ret);
    }

    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url");
        File target = modelFile(call.getString("file"));
        if (url == null || !url.startsWith("https://") || target == null) { call.reject("Bad download"); return; }
        call.setKeepAlive(false);
        cancelDownload = false;
        downloader.execute(() -> {
            File part = new File(target.getPath() + ".part");
            try {
                long have = part.exists() ? part.length() : 0;
                HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                c.setInstanceFollowRedirects(true);
                c.setConnectTimeout(20000);
                c.setReadTimeout(60000);
                if (have > 0) c.setRequestProperty("Range", "bytes=" + have + "-");
                int code = c.getResponseCode();
                if (code == 200) have = 0; // server ignored the range: start over
                else if (code != 206) throw new Exception("Download failed (HTTP " + code + ")");
                long total = have + c.getContentLengthLong();
                if (dir().getUsableSpace() < total - have + 200_000_000L) throw new Exception("Not enough free space on this device");
                byte[] buf = new byte[1 << 16];
                long loaded = have, lastSent = 0;
                try (InputStream in = c.getInputStream(); FileOutputStream out = new FileOutputStream(part, have > 0)) {
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        if (cancelDownload) throw new Exception("Download stopped");
                        out.write(buf, 0, n);
                        loaded += n;
                        long now = System.currentTimeMillis();
                        if (now - lastSent > 400) {
                            lastSent = now;
                            JSObject p = new JSObject();
                            p.put("file", target.getName()); p.put("loaded", loaded); p.put("total", total);
                            notifyListeners("download", p);
                        }
                    }
                }
                if (!part.renameTo(target)) throw new Exception("Could not save the model");
                JSObject ret = new JSObject();
                ret.put("file", target.getName());
                ret.put("size", target.length());
                call.resolve(ret);
            } catch (Exception e) {
                call.reject(e.getMessage() == null ? "Download failed" : e.getMessage());
            }
        });
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) { cancelDownload = true; call.resolve(); }

    @PluginMethod
    public void remove(PluginCall call) {
        File f = modelFile(call.getString("file"));
        if (f == null) { call.reject("Bad file"); return; }
        runner.execute(() -> {
            if (f.getName().equals(loadedFile)) { loadedFile = null; send(LlmService.UNLOAD, null, null, null, 0); }
            f.delete();
            new File(f.getPath() + ".part").delete();
            call.resolve();
        });
    }

    @PluginMethod
    public void loadModel(PluginCall call) {
        File f = modelFile(call.getString("file"));
        if (f == null || !f.exists()) { call.reject("Model not downloaded"); return; }
        SharedPreferences p = prefs();
        if (p.getInt("crashes", 0) >= MAX_CRASHES) {
            call.reject("The story writer stopped " + MAX_CRASHES + " times on this device, so it is turned off. Grown-ups → Settings → Story writer → TRY AGAIN, or use the Cloud AI.");
            return;
        }
        if (f.getName().equals(loadedFile)) { call.resolve(); return; }
        boolean safe = p.getBoolean("safe", false);
        int cores = Runtime.getRuntime().availableProcessors();
        Bundle b = new Bundle();
        b.putString("path", f.getPath());
        b.putString("file", f.getName());
        b.putInt("nCtx", call.getInt("nCtx", 4096));
        // The big cores; more threads is often slower on phones. Safe mode uses fewer.
        b.putInt("threads", safe ? 2 : Math.max(1, Math.min(4, cores - 1)));
        b.putBoolean("safe", safe);
        send(LlmService.LOAD, call, "load", b, 0);
    }

    @PluginMethod
    public void generate(PluginCall call) {
        Bundle b = new Bundle();
        b.putString("system", call.getString("system", ""));
        b.putString("history", call.getString("history", ""));
        b.putString("user", call.getString("user", ""));
        b.putString("schema", call.getString("schema", ""));
        b.putInt("maxTokens", call.getInt("maxTokens", 1500));
        b.putFloat("temperature", call.getFloat("temperature", 0.8f));
        generating = true;
        send(LlmService.GENERATE, call, "generate", b, 0);
    }

    @PluginMethod
    public void stop(PluginCall call) { send(LlmService.STOP, null, null, null, 0); call.resolve(); }

    // Story writing waits while the app listens to him read with Whisper.
    @PluginMethod
    public void pause(PluginCall call) { send(LlmService.PAUSE, null, null, null, call.getBoolean("on", false) ? 1 : 0); call.resolve(); }

    @PluginMethod
    public void unload(PluginCall call) { loadedFile = null; send(LlmService.UNLOAD, call, "unload", null, 0); }

    // What went wrong with the story writer, for the grown-ups' settings: the last crash, and the
    // engine's own log lines (an app can read its own log).
    @PluginMethod
    public void problem(PluginCall call) {
        SharedPreferences p = prefs();
        JSObject ret = new JSObject();
        ret.put("crashes", p.getInt("crashes", 0));
        ret.put("safe", p.getBoolean("safe", false));
        ret.put("problem", p.getString("problem", ""));
        ret.put("max", MAX_CRASHES);
        runner.execute(() -> {
            StringBuilder log = new StringBuilder();
            try {
                Process proc = Runtime.getRuntime().exec(new String[] { "logcat", "-d", "-t", "1500", "-v", "time" });
                try (BufferedReader r = new BufferedReader(new InputStreamReader(proc.getInputStream()))) {
                    List<String> keep = new ArrayList<>();
                    String line;
                    while ((line = r.readLine()) != null) {
                        if (line.contains("bitschool-llm") || line.contains("DEBUG") || line.contains("libc") || line.contains("lowmemorykiller")
                            || line.contains(" F/") || line.contains("llama") || line.contains("ggml")) keep.add(line);
                    }
                    for (String k : keep.subList(Math.max(0, keep.size() - 80), keep.size())) log.append(k).append('\n');
                }
            } catch (Exception e) { log.append("(log not available: ").append(e.getMessage()).append(")"); }
            ActivityManager am = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
            ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
            am.getMemoryInfo(mi);
            ret.put("device", Build.MANUFACTURER + " " + Build.MODEL + " · Android " + Build.VERSION.RELEASE + " · " + Build.SUPPORTED_ABIS[0]
                + " · " + (mi.totalMem / 1048576) + " MB memory, " + (mi.availMem / 1048576) + " MB free now · " + Runtime.getRuntime().availableProcessors() + " cores");
            ret.put("log", log.toString());
            call.resolve(ret);
        });
    }

    // TRY AGAIN: forget earlier crashes (safe mode stays on until a story is written).
    @PluginMethod
    public void clearProblem(PluginCall call) {
        prefs().edit().putInt("crashes", 0).apply();
        call.resolve();
    }
}
