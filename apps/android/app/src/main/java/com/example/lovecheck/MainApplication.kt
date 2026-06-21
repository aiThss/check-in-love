package com.example.lovecheck

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions

class MainApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        setupFirebase()
        createNotificationChannels()
    }

    private fun setupFirebase() {
        try {
            if (FirebaseApp.getApps(this).isEmpty()) {
                val apiKey = getString(R.string.firebase_api_key)
                val appId = getString(R.string.firebase_application_id)
                val projectId = getString(R.string.firebase_project_id)
                val gcmSenderId = getString(R.string.firebase_gcm_sender_id)

                if (apiKey != "YOUR_API_KEY" && appId != "YOUR_APP_ID") {
                    val options = FirebaseOptions.Builder()
                        .setApiKey(apiKey)
                        .setApplicationId(appId)
                        .setProjectId(projectId)
                        .setGcmSenderId(gcmSenderId)
                        .build()
                    FirebaseApp.initializeApp(this, options)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            // Channel 1: Reminders (Nhắc nhở hàng ngày)
            val channelReminders = NotificationChannel(
                "lovecheck_reminders",
                "Nhắc nhở hàng ngày",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Nhắc nhở cập nhật check-in tình yêu mỗi ngày"
            }
            notificationManager.createNotificationChannel(channelReminders)

            // Channel 2: Realtime Interactions (Tương tác thời gian thực)
            val channelRealtime = NotificationChannel(
                "realtime_interactions",
                "Tương tác thời gian thực",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Thông báo react, reply và check-in thời gian thực"
                enableLights(true)
                enableVibration(true)
            }
            notificationManager.createNotificationChannel(channelRealtime)
        }
    }
}
