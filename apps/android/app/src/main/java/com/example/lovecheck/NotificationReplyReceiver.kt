package com.example.lovecheck

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.RemoteInput
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import org.json.JSONObject

class NotificationReplyReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_REPLY) return

        val replyText = RemoteInput.getResultsFromIntent(intent)
            ?.getCharSequence(KEY_TEXT)
            ?.toString()
            ?.trim()
            .orEmpty()
        val messageId = intent.getStringExtra(EXTRA_MESSAGE_ID).orEmpty()
        if (replyText.isBlank() || messageId.isBlank()) return

        val pendingResult = goAsync()
        Thread {
            try {
                val token = context
                    .getSharedPreferences("lovecheck", Context.MODE_PRIVATE)
                    .getString("auth_token", "")
                    .orEmpty()
                if (token.isBlank()) {
                    throw IllegalStateException("No authenticated session is available")
                }

                val requestBody = JSONObject().apply {
                    put("type", "text")
                    put("text", replyText)
                    put("replyToMessageId", messageId)
                    put(
                        "clientMutationId",
                        "android-notification-reply-" + UUID.randomUUID(),
                    )
                }.toString()

                val connection = (URL(API_URL).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    connectTimeout = 8_000
                    readTimeout = 8_000
                    setRequestProperty("Authorization", "Bearer $token")
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("Accept", "application/json")
                }
                connection.outputStream.use { output ->
                    output.write(requestBody.toByteArray(Charsets.UTF_8))
                }
                val status = connection.responseCode
                if (status !in 200..299) {
                    throw IllegalStateException("Reply API returned HTTP $status")
                }
                connection.disconnect()

                val notificationId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, -1)
                if (notificationId >= 0) {
                    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                    manager.cancel(notificationId)
                }
            } catch (error: Exception) {
                Log.e(TAG, "Inline notification reply failed", error)
            } finally {
                pendingResult.finish()
            }
        }.start()
    }

    companion object {
        const val ACTION_REPLY = "com.example.lovecheck.ACTION_REPLY"
        const val EXTRA_MESSAGE_ID = "messageId"
        const val EXTRA_NOTIFICATION_ID = "notificationId"
        const val KEY_TEXT = "replyText"
        private const val API_URL = "https://api.couple.io.vn/api/messages"
        private const val TAG = "LoveCheckReply"
    }
}
