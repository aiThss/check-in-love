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
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.content.ContextCompat
import androidx.core.graphics.drawable.IconCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class MyFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Store FCM token in SharedPreferences
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
        if (data.isEmpty()) return

        val title = data["title"] ?: "Check IN Love 💕"
        val body = data["body"] ?: ""
        val senderName = data["senderName"] ?: "Người ấy"
        val senderAvatar = data["senderAvatar"]
        val actionType = data["actionType"] ?: "reminder"
        val targetUrl = data["targetUrl"] ?: "/app/home"

        showMessagingNotification(title, body, senderName, senderAvatar, actionType, targetUrl)

        // Update home screen widget on new checkins or message interactions
        if (actionType == "checkin" || actionType == "reaction" || actionType == "reply") {
            LoveCheckWidgetProvider.updateWidgetNotification(this, senderName, title, body, targetUrl)
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
        val channelId = "realtime_interactions"
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Create high importance channel for sound and banner popup
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Tương tác thời gian thực",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Thông báo react, reply và check-in thời gian thực"
                enableLights(true)
                enableVibration(true)
            }
            notificationManager.createNotificationChannel(channel)
        }

        // Setup click intent to navigate inside WebView
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            data = Uri.parse("https://couple.babyress.games$targetUrl")
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            System.currentTimeMillis().toInt(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Download and crop sender avatar
        var avatarBitmap: Bitmap? = null
        if (!senderAvatar.isNullOrEmpty()) {
            val bitmap = getBitmapFromUrl(senderAvatar)
            if (bitmap != null) {
                avatarBitmap = getCircleBitmap(bitmap)
            }
        }

        // Setup Person for MessagingStyle
        val userIcon = if (avatarBitmap != null) {
            IconCompat.createWithBitmap(avatarBitmap)
        } else {
            null
        }

        val sender = Person.Builder()
            .setName(senderName)
            .setIcon(userIcon)
            .build()

        val messagingStyle = NotificationCompat.MessagingStyle(sender)
            .addMessage(body, System.currentTimeMillis(), sender)
            .setConversationTitle(if (actionType == "checkin") title else null)

        val largeIcon = if (avatarBitmap != null) {
            avatarBitmap
        } else {
            BitmapFactory.decodeResource(resources, R.mipmap.ic_launcher)
        }

        val builder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_notification)
            .setLargeIcon(largeIcon)
            .setColor(ContextCompat.getColor(this, R.color.notification_color))
            .setStyle(messagingStyle)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)

        notificationManager.notify(System.currentTimeMillis().toInt(), builder.build())
    }

    private fun getBitmapFromUrl(urlStr: String): Bitmap? {
        return try {
            val url = java.net.URL(urlStr)
            val connection = url.openConnection() as java.net.HttpURLConnection
            connection.doInput = true
            connection.connectTimeout = 5000
            connection.readTimeout = 5000
            connection.connect()
            val input = connection.inputStream
            BitmapFactory.decodeStream(input)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    private fun getCircleBitmap(bitmap: Bitmap): Bitmap {
        val output = Bitmap.createBitmap(bitmap.width, bitmap.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(output)
        val paint = Paint()
        val rect = Rect(0, 0, bitmap.width, bitmap.height)
        paint.isAntiAlias = true
        canvas.drawARGB(0, 0, 0, 0)
        paint.color = 0xff424242.toInt()
        
        val radius = (Math.min(bitmap.width, bitmap.height) / 2).toFloat()
        canvas.drawCircle((bitmap.width / 2).toFloat(), (bitmap.height / 2).toFloat(), radius, paint)
        paint.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN)
        canvas.drawBitmap(bitmap, rect, rect, paint)
        return output
    }
}
