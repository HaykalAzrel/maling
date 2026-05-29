package com.deteksimaling.app

import android.app.Notification
import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat

class AlarmForegroundService : Service() {

    override fun onCreate() {
        super.onCreate()
        Log.d(
            "Securo",
            "AlarmForegroundService created"
        )

        val notification: Notification =
            NotificationCompat.Builder(
                this,
                "alarm-channel"
            )
            .setSmallIcon(
                R.mipmap.ic_launcher
            )
            .setContentTitle(
                "SecureSense Active"
            )
            .setContentText(
                "Security monitoring is running"
            )
            .setPriority(
                NotificationCompat.PRIORITY_LOW
            )
            .setOngoing(true)
            .build()

        // Wajib dipanggil <=5 detik
        startForeground(
            1001,
            notification
        )
        Log.d(
            "Securo",
            "AlarmForegroundService startForeground called"
        )
    }

    override fun onStartCommand(
        intent: Intent?,
        flags: Int,
        startId: Int
    ): Int {

        // hidupkan lagi jika Android membunuh service
        Log.d(
            "Securo",
            "AlarmForegroundService onStartCommand"
        )
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(
            "Securo",
            "AlarmForegroundService destroyed"
        )
    }

    override fun onBind(
        intent: Intent?
    ): IBinder? {

        return null
    }
}
