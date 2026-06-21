package com.example.lovecheck

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

class LoveCheckQuickWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        appWidgetIds.forEach { appWidgetId ->
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    companion object {
        private const val PREFS_NAME = "lovecheck_quick_widget"
        private const val KEY_PARTNER_NAME = "partner_name"
        private const val KEY_CHECKIN_TEXT = "checkin_text"
        private const val KEY_CHECKIN_TYPE = "checkin_type"
        private const val KEY_HAS_IMAGE = "has_image"
        private const val KEY_TIMESTAMP = "timestamp"

        private const val CHECKIN_URL = "https://couple.babyress.games/app/checkin"

        fun updatePartnerCheckin(
            context: Context,
            partnerName: String,
            checkinType: String,
            text: String,
            imageUrl: String?,
            timestamp: String?
        ) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val editor = prefs.edit()
                .putString(KEY_PARTNER_NAME, partnerName)
                .putString(KEY_CHECKIN_TEXT, text)
                .putString(KEY_CHECKIN_TYPE, checkinType)
                .putString(KEY_TIMESTAMP, timestamp)

            if (checkinType == "photo" && !imageUrl.isNullOrEmpty()) {
                // Fetch image in background thread
                thread {
                    val file = File(context.cacheDir, "partner_checkin.jpg")
                    val success = downloadImageToFile(imageUrl, file)
                    editor.putBoolean(KEY_HAS_IMAGE, success)
                    editor.apply()
                    triggerWidgetUpdate(context)
                }
            } else {
                editor.putBoolean(KEY_HAS_IMAGE, false)
                editor.apply()
                triggerWidgetUpdate(context)
            }
        }

        private fun downloadImageToFile(urlStr: String, file: File): Boolean {
            return try {
                val url = URL(urlStr)
                val connection = url.openConnection() as HttpURLConnection
                connection.doInput = true
                connection.connectTimeout = 5000
                connection.readTimeout = 5000
                connection.connect()
                if (connection.responseCode == HttpURLConnection.HTTP_OK) {
                    connection.inputStream.use { input ->
                        FileOutputStream(file).use { output ->
                            input.copyTo(output)
                        }
                    }
                    true
                } else {
                    false
                }
            } catch (e: Exception) {
                e.printStackTrace()
                false
            }
        }

        private fun triggerWidgetUpdate(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(
                ComponentName(context, LoveCheckQuickWidgetProvider::class.java)
            )
            ids.forEach { appWidgetId ->
                updateAppWidget(context, manager, appWidgetId)
            }
        }

        private fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val partnerName = prefs.getString(KEY_PARTNER_NAME, "").orEmpty()
            val text = prefs.getString(KEY_CHECKIN_TEXT, "").orEmpty()
            val checkinType = prefs.getString(KEY_CHECKIN_TYPE, "").orEmpty()
            val hasImage = prefs.getBoolean(KEY_HAS_IMAGE, false)

            val launchIntent = Intent(context, MainActivity::class.java).apply {
                action = Intent.ACTION_VIEW
                data = Uri.parse(CHECKIN_URL)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingIntent = PendingIntent.getActivity(
                context,
                3008,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val views = RemoteViews(context.packageName, R.layout.love_check_quick_widget).apply {
                setOnClickPendingIntent(R.id.quick_widget_root, pendingIntent)
            }

            if (checkinType.isNotEmpty()) {
                val titleText = if (partnerName.isNotEmpty()) "$partnerName da check-in" else "Nguoi ay da check-in"
                views.setTextViewText(R.id.quick_widget_title, titleText)
                views.setTextViewText(R.id.quick_widget_body, text)
                views.setViewVisibility(R.id.quick_widget_title, View.VISIBLE)
                views.setViewVisibility(R.id.quick_widget_body, View.VISIBLE)

                if (hasImage) {
                    val file = File(context.cacheDir, "partner_checkin.jpg")
                    if (file.exists()) {
                        try {
                            val bitmap = BitmapFactory.decodeFile(file.absolutePath)
                            if (bitmap != null) {
                                views.setImageViewBitmap(R.id.quick_widget_image, bitmap)
                                views.setViewVisibility(R.id.quick_widget_image, View.VISIBLE)
                                views.setViewVisibility(R.id.quick_widget_scrim, View.VISIBLE)
                            } else {
                                views.setViewVisibility(R.id.quick_widget_image, View.GONE)
                                views.setViewVisibility(R.id.quick_widget_scrim, View.GONE)
                            }
                        } catch (e: Exception) {
                            views.setViewVisibility(R.id.quick_widget_image, View.GONE)
                            views.setViewVisibility(R.id.quick_widget_scrim, View.GONE)
                        }
                    } else {
                        views.setViewVisibility(R.id.quick_widget_image, View.GONE)
                        views.setViewVisibility(R.id.quick_widget_scrim, View.GONE)
                    }
                } else {
                    views.setViewVisibility(R.id.quick_widget_image, View.GONE)
                    views.setViewVisibility(R.id.quick_widget_scrim, View.GONE)
                }
            } else {
                // Default state
                views.setTextViewText(R.id.quick_widget_title, "Chua co check-in moi")
                views.setTextViewText(R.id.quick_widget_body, "Nhan de gui check-in cho doi phuong")
                views.setViewVisibility(R.id.quick_widget_title, View.VISIBLE)
                views.setViewVisibility(R.id.quick_widget_body, View.VISIBLE)
                views.setViewVisibility(R.id.quick_widget_image, View.GONE)
                views.setViewVisibility(R.id.quick_widget_scrim, View.GONE)
            }

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
