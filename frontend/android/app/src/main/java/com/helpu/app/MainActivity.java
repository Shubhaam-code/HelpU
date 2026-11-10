package com.helpu.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.media.AudioAttributes;
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

    /**
     * Channel ID for all Helpu push notifications.
     * v3 = new channel with custom WAV notification chime.
     * Android notification channels are IMMUTABLE after first creation — if sound or
     * importance changes are needed, we must use a new channel ID.
     * Match this value with HELPU_NOTIFICATION_CHANNEL_ID in pushNotifications.js.
     */
    public static final String CHANNEL_ID = "helpu_alerts_v3";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Install AndroidX SplashScreen before super.onCreate to cleanly manage launch window transition
        androidx.core.splashscreen.SplashScreen.installSplashScreen(this);

        super.onCreate(savedInstanceState);

        // Explicitly transition Activity theme to standard AppTheme.NoActionBar so window
        // background is immediately solid #FFF8F3 and NEVER flashes any launch splash on background resume
        setTheme(R.style.AppTheme_NoActionBar);

        Log.i(TAG, "==================================================");
        Log.i(TAG, ">>> [HelpuApp] Native Android MainActivity started! <<<");
        Log.i(TAG, "Package: " + getPackageName());
        Log.i(TAG, "==================================================");

        configureSystemWindowBars();
        createNotificationChannel();
        requestNotificationPermissionIfNeeded();
    }

    @Override
    public void onResume() {
        super.onResume();
        // Apply WebView audio settings after the Capacitor bridge is fully initialized.
        // getBridge() is null during onCreate but guaranteed non-null by onResume.
        configureWebViewAudioSettings();
    }

    private void configureWebViewAudioSettings() {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
                Log.i(TAG, "[HelpuApp] MediaPlaybackRequiresUserGesture=false applied — video audio autoplay enabled.");
            }
        } catch (Exception e) {
            Log.w(TAG, "[HelpuApp] Could not configure WebView audio settings", e);
        }
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

            // Clean up legacy channels from previous versions
            try { notificationManager.deleteNotificationChannel("helpu_high_importance"); } catch (Exception ignored) {}
            // Note: We do NOT delete helpu_alerts_v2 — existing notifications in that channel
            // remain accessible. We simply create v3 as the active channel going forward.

            // Check if the v3 channel already exists (avoid duplicate creation on every launch)
            NotificationChannel existingChannel = notificationManager.getNotificationChannel(CHANNEL_ID);
            if (existingChannel != null) {
                Log.i(TAG, "[HelpuPush] Notification channel '" + CHANNEL_ID + "' already exists, skipping creation.");
                return;
            }

            CharSequence name = "Helpu Booking & Ride Alerts";
            String description = "Instant heads-up popup alerts for booking requests, confirmations, matches, and ride updates";
            int importance = NotificationManager.IMPORTANCE_HIGH;

            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            channel.enableLights(true);
            channel.setLightColor(Color.parseColor("#FF572E"));
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 250, 150, 250});
            channel.setShowBadge(true);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            // ─── CUSTOM HELPU NOTIFICATION SOUND ───────────────────────────────
            // Use the supplied helpu_notification_chime.wav from res/raw/
            // URI format: android.resource://package/raw/filename_without_extension
            Uri customSoundUri = Uri.parse(
                "android.resource://" + getPackageName() + "/raw/helpu_notification_chime"
            );
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();
            channel.setSound(customSoundUri, audioAttributes);
            // ────────────────────────────────────────────────────────────────────

            notificationManager.createNotificationChannel(channel);
            Log.i(TAG, "[HelpuPush] Native NotificationChannel '" + CHANNEL_ID + "' created with IMPORTANCE_HIGH and custom Helpu chime sound.");
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
