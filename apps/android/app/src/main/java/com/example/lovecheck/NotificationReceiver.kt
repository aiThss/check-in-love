package com.example.lovecheck

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import java.util.Calendar

class NotificationReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            // Re-schedule alarms on boot
            MainActivity.setupDailyReminders(context)
            return
        }

        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        val message = getRandomMessageForHour(hour)
        showNotification(context, message)
    }

    private fun getRandomMessageForHour(hour: Int): String {
        val messages = when (hour) {
            in 6..8 -> listOf(
                "Dậy chưa người đẹp ơi! ☀️",
                "Chào buổi sáng người yêu! 🥰",
                "Dậy thôi cô bé ơi, ngày mới tốt lành! 🌻"
            )
            in 11..13 -> listOf(
                "Trưa rồi, nhớ ăn uống đầy đủ nha! 🍲",
                "Nghỉ tay đi ăn trưa thôi bé ơi! 🍱",
                "Đừng bỏ bữa trưa nhé người đẹp! 🥗"
            )
            in 17..19 -> listOf(
                "Chiều rồi, làm về mệt không? Nhớ ăn tối nhé! 🍛",
                "Đến giờ nạp năng lượng buổi tối rồi! 🥘",
                "Ăn tối thật ngon miệng nha cô bé! 🍲"
            )
            in 22..23 -> listOf(
                "Muộn rồi, đi ngủ thôi người đẹp! 😴",
                "Ngủ ngon nha cô bé, mơ đẹp nhé! 🌙",
                "Chúc người yêu ngủ thật ngon! ✨"
            )
            else -> listOf("Nhớ người yêu quá, mở app xem xíu đi! 💕")
        }
        return messages.random()
    }

    private fun showNotification(context: Context, message: String) {
        val channelId = "lovecheck_reminders"
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Nhắc nhở hàng ngày",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Thông báo nhắc nhở ăn uống, ngủ nghỉ"
            }
            notificationManager.createNotificationChannel(channel)
        }

        val mainIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            mainIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info) // Fallback icon
            .setContentTitle("Check IN Love 💕")
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)

        notificationManager.notify(System.currentTimeMillis().toInt(), builder.build())
    }
}
