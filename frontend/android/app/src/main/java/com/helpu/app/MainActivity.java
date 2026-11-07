package com.helpu.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.Window;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "HelpuApp";
    public static final String CHANNEL_ID = "helpu_alerts_v2";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Log.i(TAG, "==================================================");
        Log.i(TAG, ">>> [HelpuApp] Native Android MainActivity started! <<<");
        Log.i(TAG, "Package: " + getPackageName());
        Log.i(TAG, "==================================================");

        configureSystemWindowBars();
        createNotificationChannel();
        requestNotificationPermissionIfNeeded();
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                Log.i(TAG, "[HelpuPush] Requesting POST_NOTIFICATIONS permission from user...");
                requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 101);
            } else {
                Log.i(TAG, "[HelpuPush] POST_NOTIFICATIONS permission already granted.");
            }
        }
    }

    /**
     * Configures the Android system bars (status bar & navigation bar) and safe area insets.
     * Reserves the Android status bar area so Helpu's header (logo, notification bell,
     * and avatar) starts cleanly below the clock, battery, and signal icons.
     * Also reserves the bottom navigation bar / gesture navigation area.
     */
    private void configureSystemWindowBars() {
        Window window = getWindow();

        // 1. Set window and system bar background colors matching Helpu cream theme
        int creamBg = Color.parseColor("#FFF8F3");
        int navBg = Color.WHITE;

        window.setBackgroundDrawable(new ColorDrawable(creamBg));
        window.setStatusBarColor(creamBg);
        window.setNavigationBarColor(navBg);

        // 2. Configure dark status bar icons and dark navigation bar buttons for light backgrounds
        WindowInsetsControllerCompat insetsController = WindowCompat.getInsetsController(window, window.getDecorView());
        if (insetsController != null) {
            insetsController.setAppearanceLightStatusBars(true);
            insetsController.setAppearanceLightNavigationBars(true);
        }

        // 3. Set up edge-to-edge window with root content inset dispatching
        WindowCompat.setDecorFitsSystemWindows(window, false);

        View contentView = findViewById(android.R.id.content);
        if (contentView != null) {
            ViewCompat.setOnApplyWindowInsetsListener(contentView, (v, windowInsets) -> {
                Insets insets = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
                );
                // Apply status bar + cutout height as top padding
                // Bottom padding is managed cleanly by BottomNavigation to prevent double bottom gap
                v.setPadding(insets.left, insets.top, insets.right, 0);
                return windowInsets;
            });
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager == null) return;

            // Delete legacy channel if present to clean up any stuck/muted settings
            try {
                notificationManager.deleteNotificationChannel("helpu_high_importance");
            } catch (Exception ignored) {}

            CharSequence name = "HelpU Booking & Ride Alerts";
            String description = "Instant heads-up popup alerts for booking requests, confirmations, and ride updates";
            int importance = NotificationManager.IMPORTANCE_HIGH;

            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            channel.enableLights(true);
            channel.setLightColor(Color.parseColor("#FF572E"));
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 250, 150, 250});
            channel.setShowBadge(true);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();
            channel.setSound(defaultSoundUri, audioAttributes);

            notificationManager.createNotificationChannel(channel);
            Log.i(TAG, "[HelpuPush] Native NotificationChannel '" + CHANNEL_ID + "' initialized successfully with IMPORTANCE_HIGH.");
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent != null && intent.getData() != null) {
            Log.i(TAG, ">>> [HelpuApp] onNewIntent received deep link: " + intent.getDataString());
        }
    }
}
