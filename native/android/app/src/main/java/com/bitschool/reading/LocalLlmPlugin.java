package com.bitschool.reading;

import android.app.ActivityManager;
import android.content.Context;
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

// The on-device story writer: downloads a model into the app's private storage and runs it with llama.cpp.
@CapacitorPlugin(name = "LocalLlm")
public class LocalLlmPlugin extends Plugin {

    static { System.loadLibrary("bitschool_llm"); }

    interface Progress { boolean onTokens(int n); }

    static native void nInit(String libDir);
    static native String nLoad(String path, int nCtx, int nThreads);
    static native String nGenerate(String system, String user, String schema, int maxTokens, float temperature, Progress p);
    static native void nStop();
    static native void nUnload();

    private final ExecutorService runner = Executors.newSingleThreadExecutor();
    private final ExecutorService downloader = Executors.newSingleThreadExecutor();
    private volatile boolean cancelDownload = false;
    private String loadedFile = null;

    @Override
    public void load() {
        runner.execute(() -> nInit(getContext().getApplicationInfo().nativeLibraryDir));
    }

    private File dir() {
        File d = new File(getContext().getFilesDir(), "models");
        d.mkdirs();
        return d;
    }

    // Only plain file names: models live in one folder.
    private File modelFile(String name) {
        if (name == null || !name.matches("[A-Za-z0-9._-]+\\.gguf")) return null;
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
            if (!f.getName().endsWith(".gguf")) continue;
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
            if (f.getName().equals(loadedFile)) { nUnload(); loadedFile = null; }
            f.delete();
            new File(f.getPath() + ".part").delete();
            call.resolve();
        });
    }

    @PluginMethod
    public void loadModel(PluginCall call) {
        File f = modelFile(call.getString("file"));
        if (f == null || !f.exists()) { call.reject("Model not downloaded"); return; }
        int nCtx = call.getInt("nCtx", 4096);
        int cores = Runtime.getRuntime().availableProcessors();
        int threads = Math.max(1, Math.min(4, cores - 1)); // the big cores; more threads is often slower on phones
        runner.execute(() -> {
            if (f.getName().equals(loadedFile)) { call.resolve(); return; }
            String err = nLoad(f.getPath(), nCtx, threads);
            if (!err.isEmpty()) { loadedFile = null; call.reject(err); return; }
            loadedFile = f.getName();
            call.resolve();
        });
    }

    @PluginMethod
    public void generate(PluginCall call) {
        String system = call.getString("system", ""), user = call.getString("user", ""), schema = call.getString("schema", "");
        int maxTokens = call.getInt("maxTokens", 1500);
        float temperature = call.getFloat("temperature", 0.8f);
        runner.execute(() -> {
            if (loadedFile == null) { call.reject("No model loaded"); return; }
            try {
                String text = nGenerate(system, user, schema, maxTokens, temperature, n -> {
                    JSObject p = new JSObject();
                    p.put("tokens", n);
                    notifyListeners("progress", p);
                    return true;
                });
                JSObject ret = new JSObject();
                ret.put("text", text);
                call.resolve(ret);
            } catch (RuntimeException e) {
                call.reject(e.getMessage());
            }
        });
    }

    @PluginMethod
    public void stop(PluginCall call) { nStop(); call.resolve(); }

    @PluginMethod
    public void unload(PluginCall call) {
        runner.execute(() -> { nUnload(); loadedFile = null; call.resolve(); });
    }
}
