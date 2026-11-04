package com.bitschool.reading;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.view.WindowManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;

// Continuous listening for the read-aloud check. Android's recognizer ends after every pause; this
// restarts it at once (instead of a round trip through the web page), asks for long silence
// timeouts, and mutes the beep many phones play on each restart. Each utterance has a number, so the
// page can keep earlier utterances when a new one begins.
@CapacitorPlugin(name = "Listen", permissions = { @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "mic") })
public class ListenPlugin extends Plugin {

    private final Handler main = new Handler(Looper.getMainLooper());
    private SpeechRecognizer recognizer;
    private boolean active = false;
    private boolean continuous = true;
    private boolean muted = false;
    private int utterance = 0;
    private int busyErrors = 0;
    private String language = "en-US";

    @PluginMethod
    public void available(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", SpeechRecognizer.isRecognitionAvailable(getContext()));
        call.resolve(ret);
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
        language = call.getString("language", "en-US");
        continuous = call.getBoolean("continuous", true);
        main.post(() -> {
            if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
                call.reject("service-not-allowed");
                return;
            }
            active = true;
            busyErrors = 0;
            if (continuous) mute(true);
            if (recognizer == null) {
                recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
                recognizer.setRecognitionListener(listener);
            }
            listenNow();
            call.resolve();
        });
    }

    private Intent intent() {
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language);
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getContext().getPackageName());
        // Children pause mid-sentence: ask the recognizer to wait longer before deciding they're done.
        // (Some recognizers ignore these; the immediate restart below covers that.)
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 4000L);
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 4000L);
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 15000L);
        i.putExtra("android.speech.extra.DICTATION_MODE", true);
        return i;
    }

    private void listenNow() {
        if (!active || recognizer == null) return;
        utterance++;
        try {
            recognizer.startListening(intent());
        } catch (Exception e) {
            main.postDelayed(this::listenNow, 300);
        }
    }

    private void again(long delay) {
        if (!active) return;
        if (!continuous) { finish(); return; }
        main.postDelayed(this::listenNow, delay);
    }

    private void send(String event, String text) {
        JSObject o = new JSObject();
        o.put("utterance", utterance);
        o.put("text", text == null ? "" : text);
        notifyListeners(event, o);
    }

    private final RecognitionListener listener = new RecognitionListener() {
        @Override public void onReadyForSpeech(Bundle params) { busyErrors = 0; }
        @Override public void onBeginningOfSpeech() {}
        @Override public void onRmsChanged(float rmsdB) {}
        @Override public void onBufferReceived(byte[] buffer) {}
        @Override public void onEndOfSpeech() {}
        @Override public void onEvent(int eventType, Bundle params) {}

        @Override
        public void onPartialResults(Bundle b) {
            ArrayList<String> m = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            if (m != null && !m.isEmpty() && m.get(0) != null && !m.get(0).isEmpty()) send("partial", m.get(0));
        }

        @Override
        public void onResults(Bundle b) {
            ArrayList<String> m = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            send("final", m != null && !m.isEmpty() ? m.get(0) : "");
            again(0);
        }

        @Override
        public void onError(int error) {
            switch (error) {
                case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                    active = false; mute(false);
                    JSObject p = new JSObject(); p.put("error", "not-allowed"); notifyListeners("error", p);
                    return;
                case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                    // Busy recognizers sometimes never recover; make a fresh one after a few tries.
                    if (++busyErrors >= 3 && recognizer != null) {
                        recognizer.destroy();
                        recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
                        recognizer.setRecognitionListener(listener);
                        busyErrors = 0;
                    }
                    again(250);
                    return;
                case SpeechRecognizer.ERROR_NETWORK:
                case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                case SpeechRecognizer.ERROR_SERVER:
                    JSObject n = new JSObject(); n.put("error", "network"); notifyListeners("warning", n);
                    again(500);
                    return;
                default:
                    // No match, silence timeout, client: he paused. Keep listening.
                    again(50);
            }
        }
    };

    private void finish() {
        active = false;
        mute(false);
        notifyListeners("end", new JSObject());
    }

    // Reading can take a few minutes; the screen sleeping would pause the app and the microphone.
    @PluginMethod
    public void keepScreenOn(PluginCall call) {
        boolean on = call.getBoolean("on", false);
        getActivity().runOnUiThread(() -> {
            if (on) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            call.resolve();
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        main.post(() -> {
            boolean was = active;
            active = false;
            if (recognizer != null) recognizer.stopListening();
            // Let the last words arrive, then say the session ended.
            main.postDelayed(() -> { mute(false); if (was) notifyListeners("end", new JSObject()); }, 700);
            call.resolve();
        });
    }

    @PluginMethod
    public void abort(PluginCall call) {
        main.post(() -> {
            active = false;
            if (recognizer != null) recognizer.cancel();
            mute(false);
            call.resolve();
        });
    }

    // The restart beep plays on the notification/system streams on most phones; silence them while listening.
    private void mute(boolean on) {
        if (on == muted) return;
        try {
            AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            int dir = on ? AudioManager.ADJUST_MUTE : AudioManager.ADJUST_UNMUTE;
            am.adjustStreamVolume(AudioManager.STREAM_NOTIFICATION, dir, 0);
            am.adjustStreamVolume(AudioManager.STREAM_SYSTEM, dir, 0);
            muted = on;
        } catch (Exception e) {
            // Do Not Disturb or a work profile can refuse; listening works anyway.
        }
    }

    @Override
    protected void handleOnPause() {
        active = false;
        if (recognizer != null) recognizer.cancel();
        mute(false);
    }

    @Override
    protected void handleOnDestroy() {
        active = false;
        mute(false);
        if (recognizer != null) { recognizer.destroy(); recognizer = null; }
    }
}
