package com.example.lovecheck

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import java.io.File
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import org.json.JSONObject
import java.net.URL
import javax.net.ssl.HttpsURLConnection
import android.app.AlertDialog
import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.IntentFilter

class MainActivity : ComponentActivity() {

    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private var cameraPhotoUri: Uri? = null
    private var webView: WebView? = null

    // Register activity result for file chooser (Camera / Gallery upload)
    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val data = result.data
            var results: Array<Uri>? = null

            if (data?.dataString != null) {
                results = arrayOf(Uri.parse(data.dataString))
            } else if (cameraPhotoUri != null) {
                // Ensure captured photo exists and is not empty
                val file = File(cameraPhotoUri?.path ?: "")
                if (file.exists() && file.length() > 0) {
                    results = arrayOf(cameraPhotoUri!!)
                }
            }

            fileUploadCallback?.onReceiveValue(results)
        } else {
            fileUploadCallback?.onReceiveValue(null)
        }
        fileUploadCallback = null
    }

    private val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ -> }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Request notification permission for Android 13+
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 101)
            }
        }

        setupDailyReminders(this)

        setContent {
            val modifier = Modifier.fillMaxSize()
            AndroidView(
                factory = { context ->
                    WebView(context).apply {
                        webView = this
                        
                        // WebView settings optimal for PWA
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        settings.databaseEnabled = true
                        settings.allowFileAccess = true
                        settings.allowContentAccess = true
                        settings.mediaPlaybackRequiresUserGesture = false
                        
                        // Identifiable User Agent
                        settings.userAgentString = settings.userAgentString + " LoveCheckAndroidWrapper"

                        webViewClient = object : WebViewClient() {
                            override fun shouldOverrideUrlLoading(
                                view: WebView,
                                request: WebResourceRequest
                            ): Boolean {
                                val url = request.url.toString()
                                // Keep internal links within the WebView
                                if (url.contains("babyress.games") || url.contains("localhost")) {
                                    return false
                                }
                                // External link: launch system browser
                                try {
                                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                                    context.startActivity(intent)
                                } catch (e: Exception) {
                                    // ignore
                                }
                                return true
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

                                val takePictureIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
                                if (takePictureIntent.resolveActivity(packageManager) != null) {
                                    var photoFile: File? = null
                                    try {
                                        photoFile = createTempImageFile()
                                    } catch (ex: IOException) {
                                        // Error creating file
                                    }

                                    if (photoFile != null) {
                                        cameraPhotoUri = FileProvider.getUriForFile(
                                            context,
                                            "${packageName}.fileprovider",
                                            photoFile
                                        )
                                        takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraPhotoUri)
                                    } else {
                                        cameraPhotoUri = null
                                    }
                                }

                                val contentSelectionIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
                                    addCategory(Intent.CATEGORY_OPENABLE)
                                    type = "image/*"
                                }

                                val intentArray: Array<Intent> = if (takePictureIntent.resolveActivity(packageManager) != null) {
                                    arrayOf(takePictureIntent)
                                } else {
                                    emptyArray()
                                }

                                val chooserIntent = Intent(Intent.ACTION_CHOOSER).apply {
                                    putExtra(Intent.EXTRA_INTENT, contentSelectionIntent)
                                    putExtra(Intent.EXTRA_TITLE, "Chọn ảnh check-in")
                                    putExtra(Intent.EXTRA_INITIAL_INTENTS, intentArray)
                                }

                                fileChooserLauncher.launch(chooserIntent)
                                return true
                            }
                        }

                        // Load user's PWA URL
                        loadUrl("https://couple.babyress.games")
                    }
                },
                modifier = modifier
            )
        }

        // Proactively ask for camera permission for image captures
        checkAndRequestPermissions()
        
        // Check for updates
        checkUpdate()
    }

    private fun checkAndRequestPermissions() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
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
                conn.requestMethod = "GET"
                conn.setRequestProperty("User-Agent", "LoveCheckUpdater")
                
                if (conn.responseCode == 200) {
                    val response = conn.inputStream.bufferedReader().readText()
                    val json = JSONObject(response)
                    val tagName = json.getString("tag_name")
                    
                    val currentVersion = packageManager.getPackageInfo(packageName, 0).versionName
                    val latestVersion = if (tagName.startsWith("v")) tagName.substring(1) else tagName
                    
                    if (latestVersion != currentVersion) {
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
