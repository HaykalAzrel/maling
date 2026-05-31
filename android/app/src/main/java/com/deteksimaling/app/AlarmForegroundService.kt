package com.deteksimaling.app

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat

class AlarmForegroundService : Service() {

    override fun onCreate() {
        super.onCreate()
        Log.d("Securo", "AlarmForegroundService created")

        val fullScreenIntent = Intent(this, AlarmFullScreenActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val fullScreenPendingIntent = PendingIntent.getActivity(
            this, 0, fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification: Notification = NotificationCompat.Builder(this, "alarm-channel")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Securo Active")
            .setContentText("Securo is running")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .build()

        startForeground(1001, notification)
        Log.d("Securo", "AlarmForegroundService startForeground called")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == "STOP_ALARM") {
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }

        // Ambil preferensi dari intent
        val deviceName = intent?.getStringExtra("deviceName") ?: "Unknown"
        val time = intent?.getStringExtra("time") ?: ""
        val soundEnabled = intent?.getBooleanExtra("soundEnabled", true) ?: true
        val vibrationMode = intent?.getStringExtra("vibrationMode") ?: "long"
        val ringtoneType = intent?.getStringExtra("ringtoneType") ?: "preset"
        val ringtoneName = intent?.getStringExtra("ringtoneName") ?: "default"
        val ringtoneFilePath = intent?.getStringExtra("ringtoneFilePath") ?: ""

        val fullScreenIntent = Intent(this, AlarmFullScreenActivity::class.java).also { i ->
            i.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            i.putExtra("deviceName", deviceName)
            i.putExtra("time", time)
            i.putExtra("soundEnabled", soundEnabled)
            i.putExtra("vibrationMode", vibrationMode)
            i.putExtra("ringtoneType", ringtoneType)
            i.putExtra("ringtoneName", ringtoneName)
            i.putExtra("ringtoneFilePath", ringtoneFilePath)
}

        val fullScreenPendingIntent = PendingIntent.getActivity(
            this, 0, fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, "alarm-channel")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Securo Active")
            .setContentText("Securo is running")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .build()

        startForeground(1001, notification)
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d("Securo", "AlarmForegroundService destroyed")
    }

    override fun onBind(intent: Intent?): IBinder? = null
}