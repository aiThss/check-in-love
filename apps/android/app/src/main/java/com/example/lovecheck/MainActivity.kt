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

class MainActivity : ComponentActivity() {

    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private var cameraPhotoUri: Uri? = null
    private var cameraPhotoFile: File? = null
    private var webView: WebView? = null

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
            val pickedUri = result.data?.data
            when {
                pickedUri != null -> arrayOf(pickedUri)
                cameraPhotoUri != null &&
                    cameraPhotoFile?.exists() == true &&
                    (cameraPhotoFile?.length() ?: 0L) > 0L -> arrayOf(cameraPhotoUri!!)
                else -> null
            }
        } else {
            null
        }

        callback.onReceiveValue(uris)
        cameraPhotoUri = null
        cameraPhotoFile = null
    }

    private val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ -> }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

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

                        webViewClient = object : WebViewClient() {
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
                                val pickIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
                                    addCategory(Intent.CATEGORY_OPENABLE)
                                    type = "image/*"
                                }

                                val chooserIntent = Intent(Intent.ACTION_CHOOSER).apply {
                                    putExtra(Intent.EXTRA_INTENT, pickIntent)
                                    putExtra(Intent.EXTRA_TITLE, "Chọn ảnh check-in")
                                    putExtra(
                                        Intent.EXTRA_INITIAL_INTENTS,
                                        cameraIntent?.let { arrayOf(it) } ?: emptyArray<Intent>()
                                    )
                                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                }

                                fileChooserLauncher.launch(chooserIntent)
                                return true
                            }
                        }

                        loadUrl(APP_URL)
                    }
                },
                modifier = Modifier.fillMaxSize()
            )
        }

        checkUpdate()
    }

    private fun buildCameraIntent(context: Context): Intent? {
        val captureIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
        val hasCameraPermission =
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        val hasCameraApp = captureIntent.resolveActivity(packageManager) != null

        if (!hasCameraPermission) {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
            return null
        }

        if (!hasCameraApp) return null

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

    override fun onBackPressed() {
        if (webView?.canGoBack() == true) {
            webView?.goBack()
        } else {
            super.onBackPressed()
        }
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
        AlertDialog.Builder(this)
            .setTitle("Cập nhật phiên bản mới")
            .setMessage("Có phiên bản mới (v$version). Bạn có muốn tải xuống và cập nhật ngay không?")
            .setPositiveButton("Có") { _, _ ->
                downloadAndInstallApk(url)
            }
            .setNegativeButton("Để sau", null)
            .show()
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
