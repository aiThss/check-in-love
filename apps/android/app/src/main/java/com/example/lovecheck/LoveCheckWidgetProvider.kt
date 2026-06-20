package com.example.lovecheck

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews

class LoveCheckWidgetProvider : AppWidgetProvider() {
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
        private const val PREFS_NAME = "lovecheck_widget"
        private const val KEY_STREAK = "streak"
        private const val KEY_PARTNER_NAME = "partner_name"
        private const val CHECKIN_URL = "https://couple.babyress.games/app/checkin"

        fun updateWidgetData(context: Context, streak: Int, partnerName: String) {
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putInt(KEY_STREAK, streak.coerceAtLeast(0))
                .putString(KEY_PARTNER_NAME, partnerName)
                .apply()

            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(
                ComponentName(context, LoveCheckWidgetProvider::class.java)
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
            appWidgetManager.updateAppWidget(appWidgetId, buildViews(context))
        }

        private fun buildViews(context: Context): RemoteViews {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val streak = prefs.getInt(KEY_STREAK, 0)
            val partnerName = prefs.getString(KEY_PARTNER_NAME, "").orEmpty()
            val subtitle = if (partnerName.isBlank()) {
                "Nhan + de gui check-in"
            } else {
                "Gui check-in cho $partnerName"
            }

            val launchIntent = Intent(context, MainActivity::class.java).apply {
                action = Intent.ACTION_VIEW
                data = Uri.parse(CHECKIN_URL)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingIntent = PendingIntent.getActivity(
                context,
                3007,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            return RemoteViews(context.packageName, R.layout.love_check_widget).apply {
                setTextViewText(R.id.widget_streak_value, streak.toString())
                setTextViewText(R.id.widget_subtitle, subtitle)
                setOnClickPendingIntent(R.id.widget_root, pendingIntent)
                setOnClickPendingIntent(R.id.widget_add_button, pendingIntent)
            }
        }
    }
}
