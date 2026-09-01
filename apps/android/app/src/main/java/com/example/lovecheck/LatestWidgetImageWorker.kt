package com.example.lovecheck

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

/** Downloads the newest check-in photo outside the FCM service time budget. */
class LatestWidgetImageWorker(
    appContext: Context,
    params: WorkerParameters,
) : Worker(appContext, params) {

    override fun doWork(): Result {
        val imageUrl = inputData.getString(INPUT_IMAGE_URL) ?: return Result.failure()
        return if (LoveCheckQuickWidgetProvider.downloadAndDisplayLatestImage(applicationContext, imageUrl)) {
            Result.success()
        } else {
            Result.retry()
        }
    }

    companion object {
        const val INPUT_IMAGE_URL = "image_url"
    }
}
