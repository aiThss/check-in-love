package com.example.lovecheck

import android.app.Application
import android.app.DownloadManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions

class MainApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        cleanupLegacyUpdateDownloads()
        setupFirebase()
        createNotificationChannels()
    }

    /**
     * Older APKs always downloaded updates to the exact same public Downloads path:
     * `check-in-love-update.apk`. DownloadManager keeps the completed destination around,
     * so a later update can fail before downloading because that destination already exists.
     *
     * Remove only our finished/failed updater jobs. Active downloads are deliberately left
     * alone, and normal user downloads (photos, stickers, etc.) are not touched.
     */
    private fun cleanupLegacyUpdateDownloads() {
        try {
            val downloadManager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            val query = DownloadManager.Query().setFilterByStatus(
                DownloadManager.STATUS_SUCCESSFUL or DownloadManager.STATUS_FAILED,
            )
            val idsToRemove = mutableListOf<Long>()

            downloadManager.query(query)?.use { cursor ->
                val idIndex = cursor.getColumnIndex(DownloadManager.COLUMN_ID)
                val titleIndex = cursor.getColumnIndex(DownloadManager.COLUMN_TITLE)
                val localUriIndex = cursor.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI)

                while (cursor.moveToNext()) {
                    if (idIndex < 0) continue
                    val title = if (titleIndex >= 0) cursor.getString(titleIndex) else null
                    val localUri = if (localUriIndex >= 0) cursor.getString(localUriIndex) else null
                    val isLoveCheckUpdate =
                        title == UPDATE_DOWNLOAD_TITLE ||
                            localUri?.contains(LEGACY_UPDATE_FILE_NAME, ignoreCase = true) == true

                    if (isLoveCheckUpdate) {
                        idsToRemove += cursor.getLong(idIndex)
                    }
                }
            }

            idsToRemove.forEach(downloadManager::remove)
        } catch (error: Exception) {
            // Cleanup is best-effort. It must never prevent the app from starting.
            error.printStackTrace()
        }
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
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Nhắc nhở cập nhật check-in tình yêu mỗi ngày"
                enableLights(true)
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 250, 150, 250)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            }
            notificationManager.createNotificationChannel(channelReminders)

            // Channel 2: Realtime Interactions (Tương tác thời gian thực)
            val channelRealtime = NotificationChannel(
                "realtime_interactions",
                "Tương tác thời gian thực",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Thông báo react, reply, tin nhắn và check-in thời gian thực"
                enableLights(true)
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 250, 150, 250)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            }
            notificationManager.createNotificationChannel(channelRealtime)
        }
    }

    companion object {
        private const val UPDATE_DOWNLOAD_TITLE = "Check IN Love Update"
        private const val LEGACY_UPDATE_FILE_NAME = "check-in-love-update.apk"
    }
}
