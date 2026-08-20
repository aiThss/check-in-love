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
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.content.ContextCompat
import androidx.core.graphics.drawable.IconCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import java.util.concurrent.atomic.AtomicInteger

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
        val photoUrl: String?

        if (data.isNotEmpty()) {
            title = data["title"] ?: notification?.title ?: "Check in Love"
            body = data["body"] ?: notification?.body ?: ""
            senderName = data["senderName"] ?: "Người ấy"
            senderAvatar = data["senderAvatar"]
            actionType = data["actionType"] ?: "reminder"
            targetUrl = data["targetUrl"] ?: "/app/home"
            photoUrl = data["photoUrl"]
        } else if (notification != null) {
            title = notification.title ?: "Check in Love"
            body = notification.body ?: ""
            senderName = "Người ấy"
            senderAvatar = null
            actionType = "reminder"
            targetUrl = "/app/home"
            photoUrl = null
        } else {
            return
        }

        showMessagingNotification(title, body, senderName, senderAvatar, actionType, targetUrl, photoUrl)

        // Update home screen widget on new checkins or message interactions
        try {
            if (actionType == "checkin" || actionType == "reaction" || actionType == "reply" || actionType == "message") {
                LoveCheckWidgetProvider.updateWidgetNotification(this, senderName, title, body, targetUrl)

                if (actionType == "checkin" && !photoUrl.isNullOrEmpty()) {
                    LoveCheckQuickWidgetProvider.updatePartnerCheckin(
                        this,
                        senderName,
                        "photo",
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
        targetUrl: String,
        photoUrl: String? = null
    ) {
        try {
            val channelId = "realtime_interactions"
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

            // Create high importance channel for sound and banner popup
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val audioAttributes = AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                    .build()

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
                    setSound(defaultSoundUri, audioAttributes)
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

            val displayTitle = if (actionType == "message" && senderName.isNotBlank()) {
                senderName
            } else {
                title
            }
            val displayBody = compactNotificationBody(body, actionType, photoUrl)

            // Use one id for both the PendingIntent and the notification update.
            val notificationId = notificationIdGenerator.incrementAndGet()
            val pendingIntent = PendingIntent.getActivity(
                this,
                notificationId,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            // Publish a plain notification before doing any network I/O. This keeps
            // high-priority data-only FCM delivery inside the Android time budget.
            notificationManager.notify(
                notificationId,
                buildMessagingNotification(
                    channelId = channelId,
                    title = displayTitle,
                    body = displayBody,
                    actionType = actionType,
                    defaultSoundUri = defaultSoundUri,
                    pendingIntent = pendingIntent,
                    avatarBitmap = null,
                    photoBitmap = null,
                ).build(),
            )

            // Enrich the already-visible notification in the background. If the
            // avatar/photo request is slow or unavailable, the notification itself
            // is still delivered instead of being lost while onMessageReceived waits.
            if (!senderAvatar.isNullOrBlank() || !photoUrl.isNullOrBlank()) {
                Thread {
                    try {
                        val avatarBitmap = loadRemoteBitmap(senderAvatar)?.let { getCircleBitmap(it) }
                        val photoBitmap = loadRemoteBitmap(photoUrl)?.let { getSquareBitmap(it) }

                        if (avatarBitmap != null || photoBitmap != null) {
                            notificationManager.notify(
                                notificationId,
                                buildMessagingNotification(
                                    channelId = channelId,
                                    title = displayTitle,
                                    body = displayBody,
                                    actionType = actionType,
                                    defaultSoundUri = defaultSoundUri,
                                    pendingIntent = pendingIntent,
                                    avatarBitmap = avatarBitmap,
                                    photoBitmap = photoBitmap,
                                ).build(),
                            )
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Notification rich media update failed", e)
                    }
                }.start()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to show messaging notification", e)
        }
    }

    private fun buildMessagingNotification(
        channelId: String,
        title: String,
        body: String,
        actionType: String,
        defaultSoundUri: Uri,
        pendingIntent: PendingIntent,
        avatarBitmap: Bitmap?,
        photoBitmap: Bitmap?,
    ): NotificationCompat.Builder {
        val largeIcon = avatarBitmap ?: BitmapFactory.decodeResource(resources, R.mipmap.ic_launcher)

        val builder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_notification)
            .setLargeIcon(largeIcon)
            .setColor(ContextCompat.getColor(this, R.color.notification_color))
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setSound(defaultSoundUri)
            .setVibrate(longArrayOf(0, 250, 150, 250))
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(
                if (actionType == "message") NotificationCompat.CATEGORY_MESSAGE
                else NotificationCompat.CATEGORY_EVENT
            )

        if (photoBitmap != null) {
            val bigPictureStyle = NotificationCompat.BigPictureStyle()
                .bigPicture(photoBitmap)
                .setBigContentTitle(title)
                .setSummaryText(body)
            builder.setStyle(bigPictureStyle)
        } else {
            val bigTextStyle = NotificationCompat.BigTextStyle()
                .setBigContentTitle(title)
                .bigText(body)
            builder.setStyle(bigTextStyle)
        }

        return builder
    }

    private fun loadRemoteBitmap(remoteUrl: String?): Bitmap? {
        if (remoteUrl.isNullOrBlank()) return null
        val resolvedUrl = if (remoteUrl.startsWith("/")) {
            "https://couple.io.vn$remoteUrl"
        } else {
            remoteUrl
        }
        return getBitmapFromUrl(resolvedUrl)
    }

    private fun getBitmapFromUrl(urlStr: String): Bitmap? {
        return try {
            val url = java.net.URL(urlStr)
            val connection = url.openConnection() as java.net.HttpURLConnection
            connection.doInput = true
            connection.connectTimeout = 1500
            connection.readTimeout = 1500
            connection.connect()
            val input = connection.inputStream
            val bitmap = BitmapFactory.decodeStream(input)
            input.close()
            connection.disconnect()
            bitmap
        } catch (e: Exception) {
            null
        }
    }

    private fun getSquareBitmap(bitmap: Bitmap): Bitmap? {
        return try {
            val size = minOf(bitmap.width, bitmap.height)
            if (size <= 0) return null

            val left = (bitmap.width - size) / 2
            val top = (bitmap.height - size) / 2
            Bitmap.createBitmap(bitmap, left, top, size, size)
        } catch (e: Exception) {
            null
        }
    }

    private fun compactNotificationBody(body: String, actionType: String, photoUrl: String?): String {
        val trimmed = body.trim()
        val isPhotoNotification = actionType == "message" && !photoUrl.isNullOrBlank()
        val isGenericPhotoText = trimmed.isEmpty() ||
            trimmed.equals("Xem ngay nào!", ignoreCase = true) ||
            trimmed.equals("vừa gửi 1 ảnh check-in", ignoreCase = true) ||
            trimmed.equals("vừa gửi 1 ảnh check in", ignoreCase = true)

        return if (isPhotoNotification && isGenericPhotoText) "Ảnh mới 📸" else body
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
        private val notificationIdGenerator = AtomicInteger(1000)
    }
}
