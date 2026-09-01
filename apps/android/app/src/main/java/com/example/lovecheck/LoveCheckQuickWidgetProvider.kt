package com.example.lovecheck

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import android.text.TextUtils
import android.view.View
import android.widget.RemoteViews
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequest
import androidx.work.WorkManager
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

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
        private const val KEY_IMAGE_URL = "image_url"
        private const val KEY_IMAGE_PATH = "image_path"
        private const val KEY_TIMESTAMP = "timestamp"

        private const val CHECKIN_URL = "https://couple.io.vn/app/checkin"
        private const val CHECKIN_ORIGIN = "https://couple.io.vn"
        private const val UNIQUE_IMAGE_WORK = "latest_partner_checkin_image"
        private const val WIDGET_IMAGE_DIRECTORY = "widgets"
        private const val MAX_IMAGE_EDGE_PX = 512
        private const val PHOTO_CORNER_RADIUS_DP = 28f

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
                editor
                    .putString(KEY_IMAGE_URL, imageUrl)
                    .remove(KEY_IMAGE_PATH)
                    .putBoolean(KEY_HAS_IMAGE, false)
                    .apply()
                triggerWidgetUpdate(context)
                enqueueLatestImageDownload(context, imageUrl)
            } else {
                editor
                    .remove(KEY_IMAGE_URL)
                    .remove(KEY_IMAGE_PATH)
                    .putBoolean(KEY_HAS_IMAGE, false)
                editor.apply()
                triggerWidgetUpdate(context)
            }
        }

        private fun enqueueLatestImageDownload(context: Context, imageUrl: String) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            val input = Data.Builder()
                .putString(LatestWidgetImageWorker.INPUT_IMAGE_URL, imageUrl)
                .build()
            val request = OneTimeWorkRequest.Builder(LatestWidgetImageWorker::class.java)
                .setConstraints(constraints)
                .setInputData(input)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
                .build()

            WorkManager.getInstance(context.applicationContext).enqueueUniqueWork(
                UNIQUE_IMAGE_WORK,
                ExistingWorkPolicy.REPLACE,
                request,
            )
        }

        /** Called by WorkManager after the FCM service has returned. */
        internal fun downloadAndDisplayLatestImage(context: Context, imageUrl: String): Boolean {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            if (prefs.getString(KEY_IMAGE_URL, null) != imageUrl) {
                return true
            }

            val imageFile = downloadImageToFile(context, imageUrl) ?: return false
            if (prefs.getString(KEY_IMAGE_URL, null) != imageUrl) {
                return true
            }

            prefs.edit()
                .putString(KEY_IMAGE_PATH, imageFile.absolutePath)
                .putBoolean(KEY_HAS_IMAGE, true)
                .apply()
            triggerWidgetUpdate(context)
            return true
        }

        private fun downloadImageToFile(context: Context, imageUrl: String): File? {
            val imageDirectory = File(context.filesDir, WIDGET_IMAGE_DIRECTORY)
            if (!imageDirectory.exists() && !imageDirectory.mkdirs()) return null

            val imageKey = imageUrl.hashCode().toUInt().toString(16)
            val finalFile = File(imageDirectory, "partner_checkin_$imageKey.jpg")
            val downloadedFile = File(imageDirectory, "partner_checkin_$imageKey.download")
            val stagedFile = File(imageDirectory, "partner_checkin_$imageKey.new.jpg")
            var connection: HttpURLConnection? = null

            return try {
                val resolvedUrl = if (imageUrl.startsWith('/')) "$CHECKIN_ORIGIN$imageUrl" else imageUrl
                val activeConnection = URL(resolvedUrl).openConnection() as HttpURLConnection
                connection = activeConnection
                activeConnection.doInput = true
                activeConnection.connectTimeout = 10_000
                activeConnection.readTimeout = 10_000
                activeConnection.connect()
                if (activeConnection.responseCode == HttpURLConnection.HTTP_OK) {
                    activeConnection.inputStream.use { input ->
                        FileOutputStream(downloadedFile).use { output ->
                            input.copyTo(output)
                        }
                    }
                    val bitmap = decodeWidgetBitmap(downloadedFile) ?: return null
                    val wroteImage = try {
                        FileOutputStream(stagedFile).use { output ->
                            bitmap.compress(Bitmap.CompressFormat.JPEG, 88, output)
                        }
                    } finally {
                        bitmap.recycle()
                    }
                    if (!wroteImage) return null

                    if (finalFile.exists() && !finalFile.delete()) return null
                    if (!stagedFile.renameTo(finalFile)) {
                        stagedFile.copyTo(finalFile, overwrite = true)
                        stagedFile.delete()
                    }
                    finalFile
                } else {
                    null
                }
            } catch (e: Exception) {
                null
            } finally {
                connection?.disconnect()
                downloadedFile.delete()
                stagedFile.delete()
            }
        }

        private fun decodeWidgetBitmap(file: File): Bitmap? {
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(file.absolutePath, bounds)
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null

            var sampleSize = 1
            while (maxOf(bounds.outWidth, bounds.outHeight) / sampleSize > MAX_IMAGE_EDGE_PX * 2) {
                sampleSize *= 2
            }

            val options = BitmapFactory.Options().apply {
                inSampleSize = sampleSize
                inPreferredConfig = Bitmap.Config.RGB_565
            }
            val decoded = BitmapFactory.decodeFile(file.absolutePath, options) ?: return null
            val largestEdge = maxOf(decoded.width, decoded.height)
            if (largestEdge <= MAX_IMAGE_EDGE_PX) return decoded

            val scale = MAX_IMAGE_EDGE_PX.toFloat() / largestEdge
            val scaled = Bitmap.createScaledBitmap(
                decoded,
                (decoded.width * scale).toInt().coerceAtLeast(1),
                (decoded.height * scale).toInt().coerceAtLeast(1),
                true,
            )
            if (scaled !== decoded) decoded.recycle()
            return scaled
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
            val text = prefs.getString(KEY_CHECKIN_TEXT, "").orEmpty()
            val checkinType = prefs.getString(KEY_CHECKIN_TYPE, "").orEmpty()
            val hasImage = prefs.getBoolean(KEY_HAS_IMAGE, false)
            val imagePath = prefs.getString(KEY_IMAGE_PATH, null)

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
                val message = text.ifBlank { "Có check-in mới 💗" }
                views.setTextViewText(R.id.quick_widget_body, message)
                views.setViewVisibility(R.id.quick_widget_body, View.VISIBLE)

                if (hasImage) {
                    val file = imagePath?.let(::File)
                    if (file != null && file.exists()) {
                        try {
                            val bitmap = BitmapFactory.decodeFile(
                                file.absolutePath,
                                BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.RGB_565 },
                            )
                            if (bitmap != null) {
                                val cardBitmap = createSquarePhotoCard(
                                    context,
                                    appWidgetManager,
                                    appWidgetId,
                                    bitmap,
                                    message,
                                )
                                if (cardBitmap !== bitmap) bitmap.recycle()
                                views.setImageViewBitmap(R.id.quick_widget_image, cardBitmap)
                                views.setViewVisibility(R.id.quick_widget_image, View.VISIBLE)
                                views.setViewVisibility(R.id.quick_widget_scrim, View.GONE)
                                views.setViewVisibility(R.id.quick_widget_body, View.GONE)
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
                views.setTextViewText(R.id.quick_widget_body, "Nhấn để gửi check-in")
                views.setViewVisibility(R.id.quick_widget_body, View.VISIBLE)
                views.setViewVisibility(R.id.quick_widget_image, View.GONE)
                views.setViewVisibility(R.id.quick_widget_scrim, View.GONE)
            }

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        /**
         * The launcher may allocate a 2x2 widget as a tall rectangle. Compose the photo,
         * gradient and caption as one square bitmap so the visible card remains square and
         * every layer shares the same rounded corners.
         */
        private fun createSquarePhotoCard(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int,
            source: Bitmap,
            message: String,
        ): Bitmap {
            val options = appWidgetManager.getAppWidgetOptions(appWidgetId)
            val targetWidthDp = options
                .getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 110)
                .coerceAtLeast(1)
            val cardEdge = minOf(source.width, source.height)
            val sourceLeft = (source.width - cardEdge) / 2
            val sourceTop = (source.height - cardEdge) / 2
            val sourceRect = Rect(sourceLeft, sourceTop, sourceLeft + cardEdge, sourceTop + cardEdge)

            val output = Bitmap.createBitmap(
                cardEdge,
                cardEdge,
                Bitmap.Config.ARGB_8888,
            )
            val canvas = Canvas(output)
            val cardPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
            val pixelsPerDp = cardEdge.toFloat() / targetWidthDp
            val cornerRadiusPx = (PHOTO_CORNER_RADIUS_DP * pixelsPerDp)
                .coerceAtMost(cardEdge / 2f)
            val destination = RectF(0f, 0f, cardEdge.toFloat(), cardEdge.toFloat())

            canvas.drawRoundRect(destination, cornerRadiusPx, cornerRadiusPx, cardPaint)
            cardPaint.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN)
            canvas.drawBitmap(source, sourceRect, destination, cardPaint)
            cardPaint.xfermode = null

            canvas.save()
            val roundedClip = Path().apply {
                addRoundRect(destination, cornerRadiusPx, cornerRadiusPx, Path.Direction.CW)
            }
            canvas.clipPath(roundedClip)
            val overlayPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                shader = LinearGradient(
                    0f,
                    0f,
                    0f,
                    cardEdge.toFloat(),
                    intArrayOf(
                        Color.TRANSPARENT,
                        Color.argb(115, 25, 15, 23),
                        Color.argb(225, 25, 15, 23),
                    ),
                    floatArrayOf(0f, 0.52f, 1f),
                    Shader.TileMode.CLAMP,
                )
            }
            canvas.drawRect(destination, overlayPaint)
            canvas.restore()

            val textPaint = TextPaint(Paint.ANTI_ALIAS_FLAG or Paint.SUBPIXEL_TEXT_FLAG).apply {
                color = Color.WHITE
                textSize = 17f * pixelsPerDp
                typeface = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.resources.getFont(R.font.be_vietnam_pro_extra_bold)
                } else {
                    Typeface.create("sans-serif", Typeface.BOLD)
                }
            }
            val horizontalPadding = 12f * pixelsPerDp
            val textWidth = (cardEdge - horizontalPadding * 2).toInt().coerceAtLeast(1)
            val textLayout = StaticLayout.Builder
                .obtain(message, 0, message.length, textPaint, textWidth)
                .setAlignment(Layout.Alignment.ALIGN_CENTER)
                .setEllipsize(TextUtils.TruncateAt.END)
                .setIncludePad(false)
                .setMaxLines(2)
                .build()
            val textBottom = 14f * pixelsPerDp
            canvas.save()
            canvas.translate(
                horizontalPadding,
                (cardEdge - textBottom - textLayout.height).coerceAtLeast(horizontalPadding),
            )
            textLayout.draw(canvas)
            canvas.restore()
            return output
        }
    }
}
