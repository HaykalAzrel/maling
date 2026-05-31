package com.deteksimaling.app

import android.app.KeyguardManager
import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import android.util.Log

class AlarmFullScreenActivity : AppCompatActivity() {

    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.d(
            "Securo",
            "AlarmFullScreenActivity started"
        )

        // Tampil di atas lockscreen dan nyalakan layar
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
            keyguardManager.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            )
        }

        setContentView(R.layout.activity_alarm_fullscreen)

        val deviceName = intent.getStringExtra("deviceName") ?: "Unknown Device"
        val timeStr = intent.getStringExtra("time") ?: ""
        Log.d(
            "Securo",
            "AlarmFullScreenActivity extras device=" + deviceName + " time=" + timeStr
        )

        findViewById<TextView>(R.id.tvDeviceName).text = deviceName
        findViewById<TextView>(R.id.tvTime).text = timeStr

        findViewById<Button>(R.id.btnDismiss).setOnClickListener {
            Log.d(
                "Securo",
                "Alarm dismissed by user"
            )
            stopAlarm()
            finish()
        }

        startAlarm()
    }

    private fun startAlarm() {
        val soundEnabled = intent.getBooleanExtra("soundEnabled", true)
        val ringtoneType = intent.getStringExtra("ringtoneType") ?: "preset"
        val ringtoneName = intent.getStringExtra("ringtoneName") ?: "default"
        val ringtoneFilePath = intent.getStringExtra("ringtoneFilePath")
        val vibrationMode = intent.getStringExtra("vibrationMode") ?: "long"

        if (soundEnabled) {
            try {
                mediaPlayer = MediaPlayer().apply {
                    setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
                    )

                    when {
                        // Custom ringtone dari file
                        ringtoneType == "custom" && !ringtoneFilePath.isNullOrEmpty() -> {
                            setDataSource(ringtoneFilePath)
                        }
                        // Preset dari assets
                        else -> {
                            val assetFileName = when (ringtoneName.lowercase()) {
                                "beacon" -> "public/sounds/beacon.mp3"
                                "siren" -> "public/sounds/siren.mp3"
                            else -> "public/sounds/default.mp3"
                            }
                            val afd = assets.openFd(assetFileName)
                            setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
                        }
                    }

                    isLooping = true
                    prepare()
                    start()
                }

                val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
                audioManager.setStreamVolume(
                    AudioManager.STREAM_ALARM,
                    audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM),
                    0
                )
            } catch (e: Exception) {
                Log.e("Securo", "Alarm audio failed: ${e.message}")
            }
        }

        // Vibrasi
        try {
            vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vm.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }

            val pattern = when (vibrationMode) {
                "short" -> longArrayOf(0, 120, 500)
                "long" -> longArrayOf(0, 350, 900)
                "continuous" -> longArrayOf(0, 600, 700)
                else -> longArrayOf(0, 200, 100, 200, 100, 400)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(pattern, 0)
            }
        } catch (e: Exception) {
            Log.e("Securo", "Alarm vibration failed: ${e.message}")
        }
    }

    private fun stopAlarm() {
        Log.d(
            "Securo",
            "Alarm stop"
        )
        mediaPlayer?.apply {
            if (isPlaying) stop()
            release()
        }
        mediaPlayer = null
        vibrator?.cancel()
        vibrator = null
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(
            "Securo",
            "AlarmFullScreenActivity destroyed"
        )
        stopAlarm()
    }
}
