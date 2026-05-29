package com.deteksimaling.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.content.ComponentName;
import android.content.pm.PackageManager;

import com.getcapacitor.BridgeActivity;
import com.codetrixstudio.capacitor.GoogleAuth.GoogleAuth;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(
            Bundle savedInstanceState) {

        registerPlugin(
                GoogleAuth.class);
        registerPlugin(
                SecuroLoggerPlugin.class);

        super.onCreate(
                savedInstanceState);

        createNotificationChannels();

        try {

            ComponentName component = new ComponentName(
                    this,
                    "com.deteksimaling.app.CustomMessagingService");

            getPackageManager().setComponentEnabledSetting(
                    component,
                    PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                    PackageManager.DONT_KILL_APP
            );

            int state = getPackageManager()
                    .getComponentEnabledSetting(
                            component);

            Log.d(
                    "Securo",
                    "MessagingService state = "
                            + state);

        } catch (Exception e) {

            Log.d(
                    "Securo",
                    "MessagingService check failed");

        }

        Log.d(
                "Securo",
                "MainActivity created");
    }

    private void createNotificationChannels() {

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {

            Uri alarmUri = RingtoneManager.getDefaultUri(
                    RingtoneManager.TYPE_ALARM);

            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setUsage(
                            AudioAttributes.USAGE_ALARM)
                    .setContentType(
                            AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();

            NotificationChannel channel = new NotificationChannel(
                    "alarm-channel",
                    "Alarm Intrusi",
                    NotificationManager.IMPORTANCE_HIGH);

            channel.setDescription(
                    "Notifikasi alarm saat laser terblocked");

            channel.enableVibration(
                    true);

            channel.setVibrationPattern(
                    new long[] {
                            0, 200, 100, 200, 100, 400
                    });

            channel.setSound(
                    alarmUri,
                    audioAttributes);

            channel.setLockscreenVisibility(
                    Notification.VISIBILITY_PUBLIC);

            channel.enableLights(
                    true);

            channel.setLightColor(
                    Color.RED);

            NotificationManager manager = (NotificationManager) getSystemService(
                    Context.NOTIFICATION_SERVICE);

            if (manager != null) {

                manager.createNotificationChannel(
                        channel);
            }
        }
    }
}
