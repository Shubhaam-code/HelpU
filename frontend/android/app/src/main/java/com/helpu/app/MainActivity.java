package com.helpu.app;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "HelpuPush";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Log.i(TAG, "==================================================");
        Log.i(TAG, ">>> [HelpuPush] Native Android MainActivity started! <<<");
        Log.i(TAG, "Package: " + getPackageName());
        Log.i(TAG, "==================================================");
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent != null && intent.getData() != null) {
            Log.i(TAG, ">>> [HelpuPush] onNewIntent received deep link: " + intent.getDataString());
        }
    }
}
