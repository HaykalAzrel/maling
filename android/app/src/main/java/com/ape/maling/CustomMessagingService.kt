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
        deviceName:String,
        timeStr:String,
        deviceId:String
    ){
        Log.d(
            "Securo",
            "showFullScreenAlarm device=" + deviceName + " time=" + timeStr + " id=" + deviceId
        )

        val intent =
            Intent(
                this,
                AlarmFullScreenActivity::class.java
            )

        intent.flags =
            Intent.FLAG_ACTIVITY_NEW_TASK or
            Intent.FLAG_ACTIVITY_CLEAR_TOP

        intent.putExtra(
            "deviceName",
            deviceName
        )

        intent.putExtra(
            "time",
            timeStr
        )

        intent.putExtra(
            "deviceId",
            deviceId
        )

        val pendingIntent =
            PendingIntent.getActivity(
                this,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or
                PendingIntent.FLAG_IMMUTABLE
            )

        val notification =
            NotificationCompat.Builder(
                this,
                "alarm-channel"
            )
            .setSmallIcon(
                R.mipmap.ic_launcher
            )
            .setContentTitle(
                "🚨 SECURITY ALERT"
            )
            .setContentText(
                "$deviceName • $timeStr"
            )
            .setPriority(
                NotificationCompat.PRIORITY_MAX
            )
            .setCategory(
                NotificationCompat.CATEGORY_CALL
            )
            .setVisibility(
                NotificationCompat.VISIBILITY_PUBLIC
            )
            .setFullScreenIntent(
                pendingIntent,
                true
            )
            .setOngoing(true)
            .setAutoCancel(false)
            .build()

        val manager =
            getSystemService(
                Context.NOTIFICATION_SERVICE
            ) as NotificationManager

        manager.notify(
            1001,
            notification
        )
    }
}
