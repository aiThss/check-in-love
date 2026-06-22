package com.example.lovecheck

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.app.DownloadManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.JavascriptInterface
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import java.io.File
import java.io.IOException
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import javax.net.ssl.HttpsURLConnection
import org.json.JSONObject
import android.os.Build
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import android.app.NotificationChannel
import android.app.NotificationManager

private class LoveCheckBridge(private val context: Context) {
    @JavascriptInterface
    fun updateWidget(streak: Int, partnerName: String) {
        LoveCheckWidgetProvider.updateWidgetData(context, streak, partnerName)
    }

    @JavascriptInterface
    fun updatePartnerCheckin(partnerName: String, checkinType: String, text: String, imageUrl: String?, timestamp: String?) {
        LoveCheckQuickWidgetProvider.updatePartnerCheckin(
            context,
            partnerName,
            checkinType,
            text,
            imageUrl,
            timestamp
        )
    }

    @JavascriptInterface
    fun downloadFile(url: String, filename: String) {
        try {
            val request = DownloadManager.Request(Uri.parse(url))
                .setTitle(filename)
                .setDescription("Đang tải ảnh check-in...")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename)

            val downloadManager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            downloadManager.enqueue(request)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @JavascriptInterface
    fun openPhotoViewer(photoUrl: String, caption: String, ownerName: String, dateStr: String, fileName: String) {
        try {
            val intent = Intent(context, PhotoViewerActivity::class.java).apply {
                putExtra("photoUrl", photoUrl)
                putExtra("caption", caption)
                putExtra("ownerName", ownerName)
                putExtra("dateStr", dateStr)
                putExtra("fileName", fileName)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}

class MainActivity : ComponentActivity() {

    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private var cameraPhotoUri: Uri? = null
    private var cameraPhotoFile: File? = null
    private var webView: WebView? = null
    // Holds the FCM token that arrived before the WebView page had finished loading.
    // Injected into JS inside onPageFinished to avoid the race condition where
    // window.onFcmTokenReceived is not yet registered.
    private var pendingFcmToken: String? = null
    private var webPageLoaded = false

    private val fcmReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val token = intent?.getStringExtra("token")
            if (token != null) {
                runOnUiThread { injectFcmToken(token) }
            }
        }
    }

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val callback = fileUploadCallback
        fileUploadCallback = null

        if (callback == null) {
            cameraPhotoUri = null
            cameraPhotoFile = null
            return@registerForActivityResult
        }

        val uris = if (result.resultCode == Activity.RESULT_OK) {
            parseFileChooserResult(result.data)
        } else null

        callback.onReceiveValue(uris)
        cameraPhotoUri = null
        cameraPhotoFile = null
    }

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val filter = IntentFilter("com.example.lovecheck.FCM_TOKEN_UPDATE")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(fcmReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(fcmReceiver, filter)
        }

        try {
            FirebaseMessaging.getInstance().token.addOnCompleteListener { task: com.google.android.gms.tasks.Task<String> ->
                if (task.isSuccessful) {
                    val token = task.result
                    val prefs = getSharedPreferences("lovecheck", Context.MODE_PRIVATE)
                    prefs.edit().putString("fcm_token", token).apply()
                    // Defer injection until page is loaded
                    runOnUiThread { injectFcmToken(token) }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 101)
            }
        }

        setupDailyReminders(this)

        setContent {
            AndroidView(
                factory = { context ->
                    WebView(context).apply {
                        webView = this

                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        settings.databaseEnabled = true
                        settings.allowFileAccess = true
                        settings.allowContentAccess = true
                        settings.mediaPlaybackRequiresUserGesture = false
                        settings.loadsImagesAutomatically = true
                        settings.javaScriptCanOpenWindowsAutomatically = true
                        settings.setSupportZoom(false)
                        val versionName = packageManager.getPackageInfo(packageName, 0).versionName ?: "unknown"
                        settings.userAgentString = settings.userAgentString + " LoveCheckAndroidWrapper/$versionName"
                        addJavascriptInterface(LoveCheckBridge(context.applicationContext), "LoveCheckAndroid")

                        webViewClient = object : WebViewClient() {
                            override fun onPageFinished(view: WebView, url: String) {
                                super.onPageFinished(view, url)
                                webPageLoaded = true
                                // Inject any token that arrived before the page was ready
                                pendingFcmToken?.let { token ->
                                    pendingFcmToken = null
                                    injectFcmToken(token)
                                }
                            }

                            override fun shouldOverrideUrlLoading(
                                view: WebView,
                                request: WebResourceRequest
                            ): Boolean {
                                if (request.url.scheme == RETRY_SCHEME) {
                                    view.loadUrl(APP_URL)
                                    return true
                                }

                                if (isAllowedInWebView(request.url)) {
                                    return false
                                }

                                try {
                                    context.startActivity(Intent(Intent.ACTION_VIEW, request.url))
                                } catch (_: Exception) {
                                    // Ignore malformed/unhandled external links.
                                }
                                return true
                            }

                            override fun onReceivedError(
                                view: WebView,
                                request: WebResourceRequest,
                                error: WebResourceError
                            ) {
                                if (request.isForMainFrame) {
                                    view.loadDataWithBaseURL(
                                        APP_URL,
                                        buildErrorHtml(),
                                        "text/html",
                                        "UTF-8",
                                        null
                                    )
                                }
                            }
                        }

                        webChromeClient = object : WebChromeClient() {
                            override fun onShowFileChooser(
                                webView: WebView,
                                filePathCallback: ValueCallback<Array<Uri>>,
                                fileChooserParams: FileChooserParams
                            ): Boolean {
                                fileUploadCallback?.onReceiveValue(null)
                                fileUploadCallback = filePathCallback

                                val cameraIntent = buildCameraIntent(context)
                                if (fileChooserParams.isCaptureEnabled && cameraIntent != null) {
                                    fileChooserLauncher.launch(cameraIntent)
                                    return true
                                }

                                fileChooserLauncher.launch(buildImagePickIntent())
                                return true
                            }
                        }

                        loadUrl(initialUrlFromIntent(intent))
                    }
                },
                modifier = Modifier.fillMaxSize()
            )
        }

        checkUpdate()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        webView?.loadUrl(initialUrlFromIntent(intent))
    }

    private fun parseFileChooserResult(data: Intent?): Array<Uri>? {
        val clipData = data?.clipData
        if (clipData != null && clipData.itemCount > 0) {
            return Array(clipData.itemCount) { index -> clipData.getItemAt(index).uri }
        }

        data?.data?.let { return arrayOf(it) }

        return if (
            cameraPhotoUri != null &&
            cameraPhotoFile?.exists() == true &&
            (cameraPhotoFile?.length() ?: 0L) > 0L
        ) {
            arrayOf(cameraPhotoUri!!)
        } else null
    }

    private fun buildImagePickIntent(): Intent {
        return if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            Intent(MediaStore.ACTION_PICK_IMAGES).apply {
                type = "image/*"
            }
        } else {
            Intent(Intent.ACTION_GET_CONTENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "image/*"
            }
        }
    }

    private fun buildCameraIntent(context: Context): Intent? {
        val captureIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
        return try {
            val photoFile = createTempImageFile()
            val uri = FileProvider.getUriForFile(
                context,
                "${packageName}.fileprovider",
                photoFile
            )

            cameraPhotoFile = photoFile
            cameraPhotoUri = uri

            captureIntent.apply {
                putExtra(MediaStore.EXTRA_OUTPUT, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
            }
        } catch (_: IOException) {
            cameraPhotoFile = null
            cameraPhotoUri = null
            null
        }
    }

    @Throws(IOException::class)
    private fun createTempImageFile(): File {
        val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val imageFileName = "JPEG_${timeStamp}_"
        val storageDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES)
        return File.createTempFile(imageFileName, ".jpg", storageDir)
    }

    private fun initialUrlFromIntent(intent: Intent?): String {
        val data = intent?.data ?: return APP_URL
        return if (isAllowedInWebView(data)) data.toString() else APP_URL
    }

    /**
     * Injects the FCM token into the WebView JS context.
     * If the page has not finished loading yet, saves the token as [pendingFcmToken]
     * so it can be injected inside [WebViewClient.onPageFinished].
     */
    private fun injectFcmToken(token: String) {
        if (!webPageLoaded) {
            pendingFcmToken = token
            return
        }
        val escaped = token.replace("'", "\\'")
        webView?.evaluateJavascript(
            "if (typeof window.onFcmTokenReceived === 'function') { window.onFcmTokenReceived('$escaped'); }",
            null
        )
    }

    override fun onBackPressed() {
        if (webView?.canGoBack() == true) {
            webView?.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        try {
            unregisterReceiver(fcmReceiver)
        } catch (e: Exception) {
            e.printStackTrace()
        }
        super.onDestroy()
    }

    private fun checkUpdate() {
        Thread {
            try {
                val url = URL("https://api.github.com/repos/aiThss/check-in-love/releases/latest")
                val conn = url.openConnection() as HttpsURLConnection
                conn.connectTimeout = 7000
                conn.readTimeout = 7000
                conn.requestMethod = "GET"
                conn.setRequestProperty("User-Agent", "LoveCheckUpdater")

                if (conn.responseCode == 200) {
                    val response = conn.inputStream.bufferedReader().readText()
                    val json = JSONObject(response)
                    val tagName = json.getString("tag_name")

                    val currentVersion = packageManager.getPackageInfo(packageName, 0).versionName ?: ""
                    val latestVersion = tagName.removePrefix("v")

                    if (compareVersions(latestVersion, currentVersion) > 0) {
                        val assets = json.getJSONArray("assets")
                        var apkUrl: String? = null
                        for (i in 0 until assets.length()) {
                            val asset = assets.getJSONObject(i)
                            if (asset.getString("name").endsWith(".apk")) {
                                apkUrl = asset.getString("browser_download_url")
                                break
                            }
                        }

                        if (apkUrl != null) {
                            runOnUiThread {
                                showUpdateDialog(latestVersion, apkUrl)
                            }
                        }
                    }
                }
                conn.disconnect()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }.start()
    }

    private fun showUpdateDialog(version: String, url: String) {
        val dialogView = layoutInflater.inflate(R.layout.dialog_update, null)
        val dialog = AlertDialog.Builder(this)
            .setView(dialogView)
            .create()

        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        val txtMessage = dialogView.findViewById<android.widget.TextView>(R.id.dialog_message)
        txtMessage.text = "Có phiên bản mới (v$version). Bạn có muốn tải xuống và cập nhật ngay không?"

        val btnCancel = dialogView.findViewById<android.widget.Button>(R.id.btn_cancel)
        val btnUpdate = dialogView.findViewById<android.widget.Button>(R.id.btn_update)

        btnCancel.setOnClickListener {
            dialog.dismiss()
        }

        btnUpdate.setOnClickListener {
            downloadAndInstallApk(url)
            dialog.dismiss()
        }

        dialog.show()
    }

    private fun downloadAndInstallApk(apkUrl: String) {
        val request = DownloadManager.Request(Uri.parse(apkUrl))
            .setTitle("Check IN Love Update")
            .setDescription("Đang tải xuống phiên bản mới...")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "check-in-love-update.apk")

        val downloadManager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val downloadId = downloadManager.enqueue(request)

        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                val id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1)
                if (id == downloadId) {
                    val uri = downloadManager.getUriForDownloadedFile(downloadId)
                    if (uri != null) {
                        val installIntent = Intent(Intent.ACTION_VIEW).apply {
                            setDataAndType(uri, "application/vnd.android.package-archive")
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
                        }
                        context.startActivity(installIntent)
                    }
                    context.unregisterReceiver(this)
                }
            }
        }

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(receiver, IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), Context.RECEIVER_EXPORTED)
        } else {
            registerReceiver(receiver, IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE))
        }
    }

    companion object {
        private const val APP_URL = "https://couple.babyress.games"
        private const val RETRY_SCHEME = "lovecheck"
        private val allowedHosts = setOf(
            "couple.babyress.games",
            "api.couple.babyress.games",
            "localhost",
            "127.0.0.1",
            "10.0.2.2"
        )

        private fun compareVersions(left: String, right: String): Int {
            val leftParts = left.split(".", "-", "_").map { it.toIntOrNull() ?: 0 }
            val rightParts = right.split(".", "-", "_").map { it.toIntOrNull() ?: 0 }
            val max = maxOf(leftParts.size, rightParts.size)

            for (i in 0 until max) {
                val leftPart = leftParts.getOrElse(i) { 0 }
                val rightPart = rightParts.getOrElse(i) { 0 }
                if (leftPart != rightPart) return leftPart.compareTo(rightPart)
            }

            return 0
        }

        private fun isAllowedInWebView(uri: Uri): Boolean {
            val host = uri.host ?: return false
            return host in allowedHosts
        }

        private fun buildErrorHtml(): String = """
            <!doctype html>
            <html lang="vi">
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
              <style>
                html,body{margin:0;height:100%;background:#000;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
                body{display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;box-sizing:border-box}
                .box{max-width:340px}
                .icon{font-size:64px;margin-bottom:16px}
                h1{font-size:24px;margin:0 0 10px}
                p{color:#a3a3a3;line-height:1.5;margin:0 0 24px}
                button{border:0;border-radius:999px;background:#ff3b7f;color:#fff;padding:14px 24px;font-weight:700;font-size:16px}
              </style>
            </head>
            <body>
              <div class="box">
                <div class="icon">📡</div>
                <h1>Không tải được ứng dụng</h1>
                <p>Kiểm tra kết nối mạng rồi thử lại nhé.</p>
                <button onclick="location.href='lovecheck://retry'">Thử lại</button>
              </div>
            </body>
            </html>
        """.trimIndent()

        fun setupDailyReminders(context: Context) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
            val hours = listOf(7, 12, 18, 23)

            for (hour in hours) {
                val intent = Intent(context, NotificationReceiver::class.java)
                val pendingIntent = PendingIntent.getBroadcast(
                    context,
                    hour,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )

                val calendar = Calendar.getInstance().apply {
                    set(Calendar.HOUR_OF_DAY, hour)
                    set(Calendar.MINUTE, 0)
                    set(Calendar.SECOND, 0)
                    if (timeInMillis <= System.currentTimeMillis()) {
                        add(Calendar.DAY_OF_YEAR, 1)
                    }
                }

                alarmManager.setInexactRepeating(
                    android.app.AlarmManager.RTC_WAKEUP,
                    calendar.timeInMillis,
                    android.app.AlarmManager.INTERVAL_DAY,
                    pendingIntent
                )
            }
        }
    }
}
