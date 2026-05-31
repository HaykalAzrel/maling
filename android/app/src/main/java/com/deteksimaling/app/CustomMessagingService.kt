package com.deteksimaling.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.provider.Settings
import android.util.Log

import androidx.core.app.NotificationCompat

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class CustomMessagingService :
    FirebaseMessagingService() {

    override fun onCreate() {
        super.onCreate()

        Log.d(
            "Securo",
            "CustomMessagingService created"
        )
    }

    override fun onNewToken(
        token:String
    ) {

        super.onNewToken(
            token
        )

        Log.d(
            "Securo",
            "Refreshed token: $token"
        )

        val currentUser =
            FirebaseAuth.getInstance()
                .currentUser ?: return

        val deviceKey =
            "android_" +
            Settings.Secure.getString(
                contentResolver,
                Settings.Secure.ANDROID_ID
            )

        FirebaseDatabase.getInstance()
            .reference
            .child("users")
            .child(currentUser.uid)
            .child("fcmTokens")
            .child(deviceKey)
            .setValue(token)
    }

    override fun onMessageReceived(
        message:RemoteMessage
    ){
        Log.d(
            "Securo",
            "MESSAGE RECEIVED - messageId=${message.messageId} from=${message.from}"
        )

        Log.d(
            "Securo",
            "messageId=" + message.messageId +
            " from=" + message.from +
            " data=" + message.data.toString() +
            " notification=" + message.notification?.title
        )

        if (message.data.isEmpty()) {
            Log.w(
                "Securo",
                "FCM data payload is empty. notification=" + message.notification?.body
            )
        }

        createAlarmChannel()

        val data =
            message.data

        if(
            data["type"]=="alarm"
        ){

            Log.d(
                "Securo",
                "ALARM DETECTED"
            )

            val deviceName =
                data["deviceName"]
                    ?: "Unknown"

            val timeStr =
                data["timeStr"]
                    ?: ""

            val deviceId =
                data["deviceId"]
                    ?: ""

            Log.d(
                "Securo",
                "showFullScreenAlarm()"
            )

            showFullScreenAlarm(
                deviceName,
                timeStr,
                deviceId
            )
        } else {
            Log.w(
                "Securo",
                "Ignoring non-alarm message: " + data.toString()
            )
        }
    }

    private fun createAlarmChannel(){

        if(
            Build.VERSION.SDK_INT <
            Build.VERSION_CODES.O
        ){
            return
        }

        val manager =
            getSystemService(
                Context.NOTIFICATION_SERVICE
            ) as NotificationManager

        val channel =
            NotificationChannel(
                "alarm-channel",
                "Security Alarm",
                NotificationManager.IMPORTANCE_HIGH
            )

        channel.enableVibration(
            true
        )

        channel.enableLights(
            true
        )

        channel.lockscreenVisibility =
            Notification.VISIBILITY_PUBLIC

        channel.setBypassDnd(
            true
        )

        channel.setSound(
            RingtoneManager.getDefaultUri(
                RingtoneManager.TYPE_ALARM
            ),
            AudioAttributes.Builder()
                .setUsage(
                    AudioAttributes.USAGE_ALARM
                )
                .build()
        )

        manager.createNotificationChannel(
            channel
        )
        Log.d(
            "Securo",
            "Alarm channel ensured"
        )
    }

    private fun showFullScreenAlarm(
    deviceName: String,
    timeStr: String,
    deviceId: String
) {
    Log.d("Securo", "showFullScreenAlarm device=$deviceName time=$timeStr id=$deviceId")

    // Baca preferensi dari SharedPreferences
    val prefs = getSharedPreferences("SecuroPrefs", Context.MODE_PRIVATE)
    val soundEnabled = prefs.getBoolean("soundEnabled", true)
    val vibrationMode = prefs.getString("vibrationMode", "long") ?: "long"
    val ringtoneType = prefs.getString("ringtoneType", "preset") ?: "preset"
    val ringtoneName = prefs.getString("ringtoneName", "default") ?: "default"
    val ringtoneFilePath = prefs.getString("ringtoneFilePath", "") ?: ""

    // Start AlarmForegroundService dengan preferensi
    val serviceIntent = Intent(this, AlarmForegroundService::class.java).also {
        it.putExtra("deviceName", deviceName)
        it.putExtra("time", timeStr)
        it.putExtra("soundEnabled", soundEnabled)
        it.putExtra("vibrationMode", vibrationMode)
        it.putExtra("ringtoneType", ringtoneType)
        it.putExtra("ringtoneName", ringtoneName)
        it.putExtra("ringtoneFilePath", ringtoneFilePath)
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        startForegroundService(serviceIntent)
    } else {
        startService(serviceIntent)
    }

    // Start AlarmFullScreenActivity
    val activityIntent = Intent(this, AlarmFullScreenActivity::class.java).also {
        it.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        it.putExtra("deviceName", deviceName)
        it.putExtra("time", timeStr)
        it.putExtra("soundEnabled", soundEnabled)
        it.putExtra("vibrationMode", vibrationMode)
        it.putExtra("ringtoneType", ringtoneType)
        it.putExtra("ringtoneName", ringtoneName)
        it.putExtra("ringtoneFilePath", ringtoneFilePath)
    }
    startActivity(activityIntent)
}
}
