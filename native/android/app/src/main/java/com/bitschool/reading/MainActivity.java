package com.bitschool.reading;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LocalLlmPlugin.class);
        registerPlugin(ListenPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
