package com.deteksimaling.app

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class AlarmFCMService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        val currentUser = FirebaseAuth.getInstance().currentUser ?: return
        val deviceKey = "android_${Build.MODEL.replace(" ", "_")}"
        FirebaseDatabase.getInstance().reference
            .child("users")
            .child(currentUser.uid)
            .child("fcmTokens")
            .child(deviceKey)
            .setValue(token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        val data = message.data
        val type = data["type"]

        if (type == "alarm") {
            val deviceId = data["deviceId"] ?: ""
            val deviceName = message.notification?.body
                ?: data["deviceName"]
                ?: "Unknown Device"
            val timeStr = data["timestamp"]?.toLongOrNull()?.let {
                val ts = if (it < 1_000_000_000_000L) it * 1000 else it
                java.text.SimpleDateFormat("HH:mm", java.util.Locale.getDefault())
                    .format(java.util.Date(ts))
            } ?: ""

            showFullScreenAlarm(deviceName, timeStr, deviceId)
        }
    }


    private fun showFullScreenAlarm(deviceName: String, timeStr: String, deviceId: String) {
        // Intent untuk fullscreen activity
        val fullScreenIntent = Intent(this, AlarmFullScreenActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("deviceName", deviceName)
            putExtra("time", timeStr)
            putExtra("deviceId", deviceId)
        }

        val fullScreenPendingIntent = PendingIntent.getActivity(
            this,
            0,
            fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Intent saat notifikasi di-tap
        val tapIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("deviceId", deviceId)
        }

        val tapPendingIntent = PendingIntent.getActivity(
            this,
            1,
            tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(
    this,
    "alarm-channel"
)
    .setSmallIcon(R.mipmap.ic_launcher)

    .setContentTitle(
        "🚨 ALARM LASER TERBLOCKED"
    )

    .setContentText(
        "$deviceName • $timeStr"
    )

    // ← penting
    .setPriority(
        NotificationCompat.PRIORITY_MAX
    )

    // ← ganti ALARM menjadi CALL
    .setCategory(
        NotificationCompat.CATEGORY_CALL
    )

    // ← tampil di lockscreen
    .setVisibility(
        NotificationCompat.VISIBILITY_PUBLIC
    )

    .setOngoing(true)

    .setAutoCancel(false)

    .setContentIntent(
        tapPendingIntent
    )

    .setFullScreenIntent(
        fullScreenPendingIntent,
        true
    )

    .build()

        val notificationManager =
            getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(1001, notification)
    }
}