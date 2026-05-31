package com.deteksimaling.app;

import android.content.Intent;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AlarmLauncher")
public class AlarmLauncherPlugin extends Plugin {

    @PluginMethod
    public void open(PluginCall call) {
        String deviceName = call.getString("deviceName", "Unknown Device");
        String time = call.getString("time", "");
        boolean soundEnabled = Boolean.TRUE.equals(call.getBoolean("soundEnabled", true));
        String vibrationMode = call.getString("vibrationMode", "long");
        String ringtoneType = call.getString("ringtoneType", "preset");
        String ringtoneName = call.getString("ringtoneName", "default");
        String ringtoneFilePath = call.getString("ringtoneFilePath", "");

        try {
            Log.d("Securo", "AlarmLauncher open start device=" + deviceName + " time=" + time);

            Intent stopIntent = new Intent(getContext(), AlarmForegroundService.class);
            stopIntent.setAction("STOP_ALARM");
            getContext().startService(stopIntent);

            Intent serviceIntent = new Intent(getContext(), AlarmForegroundService.class);
            serviceIntent.putExtra("deviceName", deviceName);
            serviceIntent.putExtra("time", time);
            serviceIntent.putExtra("soundEnabled", soundEnabled);
            serviceIntent.putExtra("vibrationMode", vibrationMode);
            serviceIntent.putExtra("ringtoneType", ringtoneType);
            serviceIntent.putExtra("ringtoneName", ringtoneName);
            serviceIntent.putExtra("ringtoneFilePath", ringtoneFilePath);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(serviceIntent);
            } else {
                getContext().startService(serviceIntent);
            }

            Intent activityIntent = new Intent(getContext(), AlarmFullScreenActivity.class);
            activityIntent.putExtra("deviceName", deviceName);
            activityIntent.putExtra("time", time);
            activityIntent.putExtra("soundEnabled", soundEnabled);
            activityIntent.putExtra("vibrationMode", vibrationMode);
            activityIntent.putExtra("ringtoneType", ringtoneType);
            activityIntent.putExtra("ringtoneName", ringtoneName);
            activityIntent.putExtra("ringtoneFilePath", ringtoneFilePath);
            activityIntent.addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK
                            | Intent.FLAG_ACTIVITY_CLEAR_TOP
                            | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            getContext().startActivity(activityIntent);

            Log.d("Securo", "AlarmLauncher open done device=" + deviceName + " time=" + time);
            JSObject result = new JSObject();
            result.put("ok", true);
            call.resolve(result);
        } catch (Exception e) {
            Log.e("Securo", "AlarmLauncher failed: " + e.getMessage());
            call.reject("Failed to open alarm");
        }
    }

    @PluginMethod
    public void saveAlarmPrefs(PluginCall call) {
        boolean soundEnabled = Boolean.TRUE.equals(call.getBoolean("soundEnabled", true));
        String vibrationMode = call.getString("vibrationMode", "long");
        String ringtoneType = call.getString("ringtoneType", "preset");
        String ringtoneName = call.getString("ringtoneName", "default");
        String ringtoneFilePath = call.getString("ringtoneFilePath", "");

        android.content.SharedPreferences prefs = getContext()
                .getSharedPreferences("SecuroPrefs", android.content.Context.MODE_PRIVATE);
        prefs.edit()
                .putBoolean("soundEnabled", soundEnabled)
                .putString("vibrationMode", vibrationMode)
                .putString("ringtoneType", ringtoneType)
                .putString("ringtoneName", ringtoneName)
                .putString("ringtoneFilePath", ringtoneFilePath)
                .apply();

        Log.d("Securo", "AlarmPrefs saved to SharedPreferences");
        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }
}
