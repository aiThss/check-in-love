package com.example.lovecheck

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Rect
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.content.ContextCompat
import androidx.core.graphics.drawable.IconCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class MyFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        val prefs = getSharedPreferences("lovecheck", Context.MODE_PRIVATE)
        prefs.edit().putString("fcm_token", token).apply()

        // Notify MainActivity if active
        val intent = Intent("com.example.lovecheck.FCM_TOKEN_UPDATE").apply {
            putExtra("token", token)
        }
        sendBroadcast(intent)
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        val data = remoteMessage.data
        val notification = remoteMessage.notification

        val title: String
        val body: String
        val senderName: String
        val senderAvatar: String?
        val actionType: String
        val targetUrl: String

        if (data.isNotEmpty()) {
            title = data["title"] ?: notification?.title ?: "Check IN Love 💕"
            body = data["body"] ?: notification?.body ?: ""
            senderName = data["senderName"] ?: "Người ấy"
            senderAvatar = data["senderAvatar"]
            actionType = data["actionType"] ?: "reminder"
            targetUrl = data["targetUrl"] ?: "/app/home"
        } else if (notification != null) {
            title = notification.title ?: "Check IN Love 💕"
            body = notification.body ?: ""
            senderName = "Người ấy"
            senderAvatar = null
            actionType = "reminder"
            targetUrl = "/app/home"
        } else {
            return
        }

        showMessagingNotification(title, body, senderName, senderAvatar, actionType, targetUrl)

        // Update home screen widget on new checkins or message interactions
        try {
            if (actionType == "checkin" || actionType == "reaction" || actionType == "reply") {
                LoveCheckWidgetProvider.updateWidgetNotification(this, senderName, title, body, targetUrl)

                if (actionType == "checkin") {
                    val photoUrl = data["photoUrl"]
                    LoveCheckQuickWidgetProvider.updatePartnerCheckin(
                        this,
                        senderName,
                        if (!photoUrl.isNullOrEmpty()) "photo" else "text",
                        body,
                        photoUrl,
                        null
                    )
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Widget update failed", e)
        }
    }

    private fun showMessagingNotification(
        title: String,
        body: String,
        senderName: String,
        senderAvatar: String?,
        actionType: String,
        targetUrl: String
    ) {
        try {
            val channelId = "realtime_interactions"
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            // Create high importance channel for sound and banner popup
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    channelId,
                    "Tương tác thời gian thực",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Thông báo react, reply, tin nhắn và check-in thời gian thực"
                    enableLights(true)
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 250, 150, 250)
                    lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
                }
                notificationManager.createNotificationChannel(channel)
            }

            // Setup click intent to navigate inside WebView
            val fullTargetUrl = if (targetUrl.startsWith("http://") || targetUrl.startsWith("https://")) {
                targetUrl
            } else {
                "https://couple.io.vn${if (targetUrl.startsWith("/")) "" else "/"}$targetUrl"
            }

            val intent = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                data = Uri.parse(fullTargetUrl)
                putExtra("targetUrl", targetUrl)
            }
            val pendingIntent = PendingIntent.getActivity(
                this,
                (System.currentTimeMillis() % 100000).toInt(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            // Download and crop sender avatar safely
            var avatarBitmap: Bitmap? = null
            if (!senderAvatar.isNullOrBlank()) {
                val resolvedAvatarUrl = if (senderAvatar.startsWith("/")) {
                    "https://couple.io.vn$senderAvatar"
                } else {
                    senderAvatar
                }
                val bitmap = getBitmapFromUrl(resolvedAvatarUrl)
                if (bitmap != null) {
                    avatarBitmap = getCircleBitmap(bitmap)
                }
            }

            val largeIcon = avatarBitmap ?: BitmapFactory.decodeResource(resources, R.mipmap.ic_launcher)

            val builder = NotificationCompat.Builder(this, channelId)
                .setSmallIcon(R.drawable.ic_notification)
                .setLargeIcon(largeIcon)
                .setColor(ContextCompat.getColor(this, R.color.notification_color))
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)

            if (actionType == "message") {
                val userIcon = if (avatarBitmap != null) {
                    IconCompat.createWithBitmap(avatarBitmap)
                } else {
                    null
                }
                // In MessagingStyle:
                // constructor argument is the CURRENT DEVICE OWNER (recipient)
                // addMessage sender is the OTHER PERSON (partner)
                val me = Person.Builder().setName("Tôi").build()
                val partner = Person.Builder()
                    .setName(senderName)
                    .setIcon(userIcon)
                    .build()

                val messagingStyle = NotificationCompat.MessagingStyle(me)
                    .addMessage(body, System.currentTimeMillis(), partner)

                builder.setStyle(messagingStyle)
                builder.setCategory(NotificationCompat.CATEGORY_MESSAGE)
            } else {
                builder.setStyle(NotificationCompat.BigTextStyle().bigText(body))
                builder.setCategory(NotificationCompat.CATEGORY_EVENT)
            }

            notificationManager.notify((System.currentTimeMillis() % 100000).toInt(), builder.build())
        } catch (e: Exception) {
            Log.e(TAG, "Failed to show messaging notification", e)
        }
    }

    private fun getBitmapFromUrl(urlStr: String): Bitmap? {
        return try {
            val url = java.net.URL(urlStr)
            val connection = url.openConnection() as java.net.HttpURLConnection
            connection.doInput = true
            connection.connectTimeout = 2500
            connection.readTimeout = 2500
            connection.connect()
            val input = connection.inputStream
            BitmapFactory.decodeStream(input)
        } catch (e: Exception) {
            null
        }
    }

    private fun getCircleBitmap(bitmap: Bitmap): Bitmap? {
        return try {
            val minSize = Math.min(bitmap.width, bitmap.height)
            if (minSize <= 0) return null

            val output = Bitmap.createBitmap(minSize, minSize, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(output)
            val paint = Paint()
            val rect = Rect(0, 0, minSize, minSize)
            paint.isAntiAlias = true
            canvas.drawARGB(0, 0, 0, 0)
            paint.color = 0xff424242.toInt()

            val radius = (minSize / 2).toFloat()
            canvas.drawCircle(radius, radius, radius, paint)
            paint.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN)
            canvas.drawBitmap(bitmap, rect, rect, paint)
            output
        } catch (e: Exception) {
            null
        }
    }

    companion object {
        private const val TAG = "LoveCheckFCM"
    }
}
