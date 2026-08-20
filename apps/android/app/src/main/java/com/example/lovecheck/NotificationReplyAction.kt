package com.example.lovecheck

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.RemoteInput

fun addNotificationReplyAction(
    context: Context,
    builder: NotificationCompat.Builder,
    notificationId: Int,
    messageId: String?,
) {
    if (messageId.isNullOrBlank()) return

    val replyIntent = Intent(context, NotificationReplyReceiver::class.java).apply {
        action = NotificationReplyReceiver.ACTION_REPLY
        putExtra(NotificationReplyReceiver.EXTRA_MESSAGE_ID, messageId)
        putExtra(NotificationReplyReceiver.EXTRA_NOTIFICATION_ID, notificationId)
    }
    val mutableFlag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        PendingIntent.FLAG_MUTABLE
    } else {
        0
    }
    val replyPendingIntent = PendingIntent.getBroadcast(
        context,
        notificationId + 100_000,
        replyIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or mutableFlag,
    )
    val remoteInput = RemoteInput.Builder(NotificationReplyReceiver.KEY_TEXT)
        .setLabel("Nhập tin nhắn...")
        .build()

    builder.addAction(
        NotificationCompat.Action.Builder(
            R.drawable.ic_notification,
            "Trả lời",
            replyPendingIntent,
        )
            .addRemoteInput(remoteInput)
            .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_REPLY)
            .setShowsUserInterface(false)
            .build(),
    )
}
