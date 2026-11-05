package com.bitschool.reading;

import android.Manifest;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileReader;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import org.json.JSONArray;
import org.json.JSONObject;

// Listening with Whisper, on the phone. The app records the microphone itself, so Whisper hears every
// word (no restarts between pauses) and the reading is kept as a recording too. The story he is reading
// is the hint that steers Whisper toward the right words. Events match ListenPlugin: partial / final / end.
@CapacitorPlugin(name = "Whisper", permissions = { @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "mic") })
public class WhisperPlugin extends Plugin {

    private static final int RATE = 16000;
    private static final int MAX_RECORDING_SECONDS = 240; // longer readings keep only the first 4 minutes as audio

    static {
        // The faster build needs ARMv8.2 half-precision math; older phones get the plain build.
        System.loadLibrary(hasFp16() ? "bitschool_whisper_fp16" : "bitschool_whisper");
    }

    static native String nLoad(String path);
    static native void nBegin(String story, int threads);
    static native String nFeed(short[] pcm, int n);
    static native String nFlush();
    static native void nUnload();

    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final LinkedBlockingQueue<short[]> queue = new LinkedBlockingQueue<>();
    private volatile boolean recording = false;
    private AudioRecord mic;
    private Thread micThread;
    private String loadedFile = null;
    private ByteArrayOutputStream wav = new ByteArrayOutputStream();

    private static boolean hasFp16() {
        try (BufferedReader r = new BufferedReader(new FileReader("/proc/cpuinfo"))) {
            String line;
            while ((line = r.readLine()) != null) {
                if (line.startsWith("Features") && (line.contains(" fphp") || line.contains(" asimdhp"))) return true;
            }
        } catch (Exception e) { /* unknown: use the plain build */ }
        return false;
    }

    private File modelFile(String name) {
        if (name == null || !name.matches("[A-Za-z0-9._-]+\\.bin")) return null;
        return new File(new File(getContext().getFilesDir(), "models"), name);
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("mic") != PermissionState.GRANTED) {
            requestPermissionForAlias("mic", call, "micAnswered");
            return;
        }
        begin(call);
    }

    @PermissionCallback
    private void micAnswered(PluginCall call) {
        if (getPermissionState("mic") == PermissionState.GRANTED) begin(call);
        else call.reject("not-allowed");
    }

    private void begin(PluginCall call) {
        File f = modelFile(call.getString("file"));
        if (f == null || !f.exists()) { call.reject("Download a listening model in Settings first"); return; }
        String story = call.getString("story", "");
        int cores = Runtime.getRuntime().availableProcessors();
        int threads = Math.max(2, Math.min(4, cores - 1));
        worker.execute(() -> {
            if (!f.getName().equals(loadedFile)) {
                String err = nLoad(f.getPath());
                if (!err.isEmpty()) { loadedFile = null; call.reject(err); return; }
                loadedFile = f.getName();
            }
            nBegin(story, threads);
            queue.clear();
            wav = new ByteArrayOutputStream();
            if (!openMic()) { call.reject("audio-capture"); return; }
            call.resolve();
            // Feed whatever audio has arrived; Whisper decides when to re-read the current stretch.
            while (recording || !queue.isEmpty()) {
                try {
                    short[] first = queue.poll(200, java.util.concurrent.TimeUnit.MILLISECONDS);
                    if (first == null) continue;
                    java.util.ArrayList<short[]> parts = new java.util.ArrayList<>();
                    parts.add(first);
                    queue.drainTo(parts);
                    int n = 0;
                    for (short[] p : parts) n += p.length;
                    short[] all = new short[n];
                    int at = 0;
                    for (short[] p : parts) { System.arraycopy(p, 0, all, at, p.length); at += p.length; }
                    send(nFeed(all, n));
                } catch (InterruptedException e) { break; }
            }
            send(nFlush());
            notifyListeners("end", new JSObject());
        });
    }

    private boolean openMic() {
        int min = AudioRecord.getMinBufferSize(RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        try {
            mic = new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, Math.max(min, RATE));
            if (mic.getState() != AudioRecord.STATE_INITIALIZED) return false;
            mic.startRecording();
        } catch (SecurityException e) { return false; }
        recording = true;
        micThread = new Thread(() -> {
            short[] buf = new short[RATE / 10];
            while (recording) {
                int n = mic.read(buf, 0, buf.length);
                if (n <= 0) continue;
                short[] chunk = java.util.Arrays.copyOf(buf, n);
                queue.offer(chunk);
                if (wav.size() < MAX_RECORDING_SECONDS * RATE * 2) {
                    ByteBuffer b = ByteBuffer.allocate(n * 2).order(ByteOrder.LITTLE_ENDIAN);
                    for (int i = 0; i < n; i++) b.putShort(chunk[i]);
                    wav.write(b.array(), 0, n * 2);
                }
            }
        }, "whisper-mic");
        micThread.start();
        return true;
    }

    private void closeMic() {
        recording = false;
        try { if (micThread != null) micThread.join(500); } catch (InterruptedException ignored) {}
        try { if (mic != null) { mic.stop(); mic.release(); } } catch (Exception ignored) {}
        mic = null;
    }

    private void send(String eventsJson) {
        try {
            JSONArray a = new JSONArray(eventsJson);
            for (int i = 0; i < a.length(); i++) {
                JSONObject e = a.getJSONObject(i);
                JSObject o = new JSObject();
                o.put("utterance", e.getInt("utterance"));
                o.put("text", e.getString("text"));
                notifyListeners(e.getBoolean("final") ? "final" : "partial", o);
            }
        } catch (Exception ignored) {}
    }

    // Stops listening; the reading comes back as a WAV recording (base64) for the dashboard.
    @PluginMethod
    public void stop(PluginCall call) {
        closeMic();
        JSObject ret = new JSObject();
        byte[] pcm = wav.toByteArray();
        if (pcm.length > RATE) ret.put("wav", Base64.encodeToString(wavFile(pcm), Base64.NO_WRAP));
        call.resolve(ret);
    }

    @PluginMethod
    public void abort(PluginCall call) {
        closeMic();
        queue.clear();
        call.resolve();
    }

    @PluginMethod
    public void unload(PluginCall call) {
        worker.execute(() -> { nUnload(); loadedFile = null; call.resolve(); });
    }

    private static byte[] wavFile(byte[] pcm) {
        ByteBuffer h = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN);
        h.put("RIFF".getBytes()).putInt(36 + pcm.length).put("WAVE".getBytes()).put("fmt ".getBytes())
            .putInt(16).putShort((short) 1).putShort((short) 1).putInt(RATE).putInt(RATE * 2).putShort((short) 2).putShort((short) 16)
            .put("data".getBytes()).putInt(pcm.length);
        byte[] out = new byte[44 + pcm.length];
        System.arraycopy(h.array(), 0, out, 0, 44);
        System.arraycopy(pcm, 0, out, 44, pcm.length);
        return out;
    }

    @Override
    protected void handleOnPause() { closeMic(); }

    @Override
    protected void handleOnDestroy() { closeMic(); }
}
