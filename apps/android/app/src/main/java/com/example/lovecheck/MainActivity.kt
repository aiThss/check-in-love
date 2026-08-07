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
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.provider.Settings
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialException
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.lifecycleScope
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.firebase.messaging.FirebaseMessaging
import java.io.File
import java.io.IOException
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import javax.net.ssl.HttpsURLConnection
import kotlinx.coroutines.launch
import org.json.JSONObject

class LoveCheckBridge(
    private val context: Context,
    private val onGoogleSignInRequested: () -> Unit,
) {
    private val mainHandler = Handler(Looper.getMainLooper())

    @JavascriptInterface
    fun updateWidget(streak: Int, partnerName: String) {
        LoveCheckWidgetProvider.updateWidgetData(context, streak, partnerName)
    }

    @JavascriptInterface
    fun updatePartnerCheckin(
        partnerName: String,
        checkinType: String,
        text: String,
        imageUrl: String?,
        timestamp: String?,
    ) {
        LoveCheckQuickWidgetProvider.updatePartnerCheckin(
            context,
            partnerName,
            checkinType,
            text,
            imageUrl,
            timestamp,
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
    fun openPhotoViewer(
        photoUrl: String,
        caption: String,
        ownerName: String,
        dateStr: String,
        fileName: String,
    ) {
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

    @JavascriptInterface
    fun signInWithGoogle() {
        mainHandler.post(onGoogleSignInRequested)
    }
}

class MainActivity : ComponentActivity() {

    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private var cameraPhotoUri: Uri? = null
    private var cameraPhotoFile: File? = null
    private var webView: WebView? = null
    private var pendingFcmToken: String? = null
    private var webPageLoaded = false
    private val updateCheckLock = Any()
    private var updateCheckRunning = false
    private var lastUpdateCheckAt = 0L
    private var updateDialog: AlertDialog? = null
    private var nativeGoogleSignInInProgress = false
    private val credentialManager by lazy(LazyThreadSafetyMode.NONE) {
        CredentialManager.create(this)
    }

    private val fcmReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val token = intent?.getStringExtra("token")
            if (token != null) {
                runOnUiThread { injectFcmToken(token) }
            }
        }
    }

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
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
        } else {
            null
        }

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
            FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    val token = task.result
                    val prefs = getSharedPreferences("lovecheck", Context.MODE_PRIVATE)
                    prefs.edit().putString("fcm_token", token).apply()
                    runOnUiThread { injectFcmToken(token) }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS,
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                101,
            )
        }

        setupDailyReminders(this)

        setContent {
            AndroidView(
                factory = { context ->
                    StickerWebView(context).apply {
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
                        settings.cacheMode = android.webkit.WebSettings.LOAD_DEFAULT

                        val versionName = packageManager
                            .getPackageInfo(packageName, 0)
                            .versionName
                            ?: "unknown"
                        settings.userAgentString =
                            settings.userAgentString + " LoveCheckAndroidWrapper/$versionName"

                        addJavascriptInterface(
                            LoveCheckBridge(context.applicationContext) {
                                startNativeGoogleSignIn()
                            },
                            "LoveCheckAndroid",
                        )

                        webViewClient = object : WebViewClient() {
                            override fun onPageFinished(view: WebView, url: String) {
                                super.onPageFinished(view, url)
                                webPageLoaded = true

                                val insets = ViewCompat.getRootWindowInsets(window.decorView)
                                val statusBarPx = insets
                                    ?.getInsets(WindowInsetsCompat.Type.statusBars())
                                    ?.top
                                    ?: 0
                                val navBarPx = insets
                                    ?.getInsets(WindowInsetsCompat.Type.navigationBars())
                                    ?.bottom
                                    ?: 0
                                val density = resources.displayMetrics.density
                                val statusBarDp = (statusBarPx.toFloat() / density + 0.5f).toInt()
                                val navBarDp = (navBarPx.toFloat() / density + 0.5f).toInt()

                                view.evaluateJavascript(
                                    """(function(){
                                        var r=document.documentElement.style;
                                        r.setProperty('--android-status-bar','${statusBarDp}px');
                                        r.setProperty('--android-nav-bar','${navBarDp}px');
                                    })();""".trimIndent(),
                                    null,
                                )

                                installAndroidCardLayoutGuard(view)

                                pendingFcmToken?.let { token ->
                                    pendingFcmToken = null
                                    injectFcmToken(token)
                                }
                            }

                            override fun shouldOverrideUrlLoading(
                                view: WebView,
                                request: WebResourceRequest,
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
                                    // Ignore malformed or unsupported external links.
                                }
                                return true
                            }

                            override fun onReceivedError(
                                view: WebView,
                                request: WebResourceRequest,
                                error: WebResourceError,
                            ) {
                                if (request.isForMainFrame) {
                                    view.loadDataWithBaseURL(
                                        APP_URL,
                                        buildErrorHtml(),
                                        "text/html",
                                        "UTF-8",
                                        null,
                                    )
                                }
                            }
                        }

                        webChromeClient = object : WebChromeClient() {
                            override fun onShowFileChooser(
                                webView: WebView,
                                filePathCallback: ValueCallback<Array<Uri>>,
                                fileChooserParams: FileChooserParams,
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
                modifier = Modifier.fillMaxSize(),
            )
        }

        installBackHandler()
    }

    override fun onResume() {
        super.onResume()
        checkUpdate()
    }

    private fun installBackHandler() {
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    val currentWebView = webView ?: return

                    // Route every system/predictive Back gesture through the web history.
                    // This lets the PWA close its active modal/history layer or restore
                    // the previous tab. At the app root history.back() is a no-op, so
                    // MainActivity stays open instead of being finished by Android.
                    currentWebView.evaluateJavascript(
                        "window.history.back();",
                        null,
                    )
                }
            },
        )
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
        } else {
            null
        }
    }

    private fun buildImagePickIntent(): Intent {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
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
                photoFile,
            )

            cameraPhotoFile = photoFile
            cameraPhotoUri = uri

            captureIntent.apply {
                putExtra(MediaStore.EXTRA_OUTPUT, uri)
                addFlags(
                    Intent.FLAG_GRANT_READ_URI_PERMISSION or
                        Intent.FLAG_GRANT_WRITE_URI_PERMISSION,
                )
            }
        } catch (_: IOException) {
            cameraPhotoFile = null
            cameraPhotoUri = null
            null
        }
    }

    @Throws(IOException::class)
    private fun createTempImageFile(): File {
        val timeStamp = SimpleDateFormat(
            "yyyyMMdd_HHmmss",
            Locale.getDefault(),
        ).format(Date())
        val imageFileName = "JPEG_${timeStamp}_"
        val storageDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES)
        return File.createTempFile(imageFileName, ".jpg", storageDir)
    }

    private fun initialUrlFromIntent(intent: Intent?): String {
        val data = intent?.data ?: return APP_URL
        return if (isAllowedInWebView(data)) data.toString() else APP_URL
    }

    private fun installAndroidCardLayoutGuard(view: WebView) {
        // Android WebView can report a zero-sized scratch canvas for several frames
        // right after a fixed modal is attached. The web card retries only a handful
        // of animation frames, closes itself, and its focus/pageshow retry loop then
        // opens it again, producing a stack of "Thiệp chưa tải xong" toasts.
        // Keep this fix APK-only: give the card shell a stable viewport-sized layout
        // before the PWA's canvas initializer measures it. No PWA source is changed.
        view.evaluateJavascript(
            """
            (function installLoveCheckAndroidCardLayoutGuard() {
              if (window.__loveCheckAndroidCardLayoutGuardInstalled) return;
              window.__loveCheckAndroidCardLayoutGuardInstalled = true;

              var style = document.getElementById('lovecheck-android-card-layout-guard');
              if (!style) {
                style = document.createElement('style');
                style.id = 'lovecheck-android-card-layout-guard';
                style.textContent =
                  '.android-wrapper .occasion-overlay{' +
                    'width:100vw!important;height:100dvh!important;min-height:100vh!important;' +
                  '}' +
                  '.android-wrapper .occasion-shell{' +
                    'min-width:1px!important;min-height:1px!important;' +
                  '}' +
                  '.android-wrapper .occasion-scratch{' +
                    'display:block!important;min-width:1px!important;min-height:1px!important;' +
                  '}';
                (document.head || document.documentElement).appendChild(style);
              }

              var primeCardLayout = function(root) {
                var overlay = root && root.matches && root.matches('.occasion-overlay')
                  ? root
                  : root && root.querySelector
                    ? root.querySelector('.occasion-overlay')
                    : null;
                if (!overlay) return;

                var shell = overlay.querySelector('.occasion-shell');
                var canvas = overlay.querySelector('.occasion-scratch');
                if (!shell || !canvas) return;

                // Force one synchronous layout pass before the card's next rAF.
                shell.getBoundingClientRect();
                canvas.getBoundingClientRect();
              };

              var observer = new MutationObserver(function(records) {
                records.forEach(function(record) {
                  record.addedNodes.forEach(function(node) {
                    if (node && node.nodeType === 1) primeCardLayout(node);
                  });
                });
              });
              observer.observe(document.documentElement, { childList: true, subtree: true });
              primeCardLayout(document);
            })();
            """.trimIndent(),
            null,
        )
    }

    private fun injectFcmToken(token: String) {
        if (!webPageLoaded) {
            pendingFcmToken = token
            return
        }

        val escaped = token.replace("'", "\\'")
        webView?.evaluateJavascript(
            "if (typeof window.onFcmTokenReceived === 'function') { window.onFcmTokenReceived('$escaped'); }",
            null,
        )
    }

    private fun startNativeGoogleSignIn() {
        if (nativeGoogleSignInInProgress || isFinishing || isDestroyed) return

        nativeGoogleSignInInProgress = true
        lifecycleScope.launch {
            try {
                val result = requestNativeGoogleCredential()
                val credential = result.credential
                if (
                    credential !is CustomCredential ||
                    credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
                ) {
                    throw IllegalStateException("Unexpected Google credential type")
                }

                val googleCredential = GoogleIdTokenCredential.createFrom(credential.data)
                injectNativeGoogleCredential(googleCredential.idToken)
            } catch (error: GetCredentialException) {
                val errorType = error::class.java.simpleName
                Log.w(
                    TAG,
                    "Native Google sign-in unavailable: $errorType: ${error.message}",
                    error,
                )
                if (isUserCancelledCredentialRequest(error)) {
                    injectNativeGoogleError("CANCELLED")
                } else {
                    injectNativeGoogleError(nativeGoogleErrorMessage(error))
                }
            } catch (error: Exception) {
                val errorType = error::class.java.simpleName
                Log.e(
                    TAG,
                    "Native Google sign-in failed: $errorType: ${error.message}",
                    error,
                )
                injectNativeGoogleError("Không thể mở đăng nhập Google. Vui lòng thử lại.")
            } finally {
                nativeGoogleSignInInProgress = false
            }
        }
    }

    private suspend fun requestNativeGoogleCredential() = run {
        val webClientId = getString(R.string.google_web_client_id)
        val buttonOption = GetSignInWithGoogleOption.Builder(webClientId).build()
        val buttonRequest = GetCredentialRequest.Builder()
            .addCredentialOption(buttonOption)
            .build()

        try {
            credentialManager.getCredential(
                request = buttonRequest,
                context = this@MainActivity,
            )
        } catch (error: GetCredentialException) {
            if (isUserCancelledCredentialRequest(error)) throw error

            Log.w(
                TAG,
                "Google button flow failed; retrying with account picker: " +
                    "${error::class.java.simpleName}: ${error.message}",
                error,
            )

            val accountOption = GetGoogleIdOption.Builder()
                .setFilterByAuthorizedAccounts(false)
                .setServerClientId(webClientId)
                .build()
            val accountRequest = GetCredentialRequest.Builder()
                .addCredentialOption(accountOption)
                .build()

            credentialManager.getCredential(
                request = accountRequest,
                context = this@MainActivity,
            )
        }
    }

    private fun isUserCancelledCredentialRequest(error: GetCredentialException): Boolean {
        val errorType = error::class.java.simpleName
        val msg = error.message ?: ""
        return errorType.contains("Cancellation", ignoreCase = true) ||
            errorType.contains("Interrupted", ignoreCase = true) ||
            msg.contains("Cancelled by user", ignoreCase = true)
    }

    private fun nativeGoogleErrorMessage(error: GetCredentialException): String {
        val errorType = error::class.java.simpleName
        return when {
            errorType.contains("NoCredential", ignoreCase = true) ->
                "Chưa chọn tài khoản Google."
            errorType.contains("ProviderConfiguration", ignoreCase = true) ->
                "Dịch vụ Google Play chưa được cấu hình cho ứng dụng này."
            errorType.contains("Unsupported", ignoreCase = true) ->
                "Thiết bị không hỗ trợ Credential Manager."
            else -> "Không thể đăng nhập Google. Vui lòng thử lại sau."
        }
    }

    private fun injectNativeGoogleCredential(idToken: String) {
        evaluateNativeGoogleCallback("onNativeGoogleCredential", idToken)
    }

    private fun injectNativeGoogleError(message: String) {
        evaluateNativeGoogleCallback("onNativeGoogleSignInError", message)
    }

    private fun evaluateNativeGoogleCallback(functionName: String, value: String) {
        val escapedValue = JSONObject.quote(value)
        webView?.post {
            webView?.evaluateJavascript(
                "if (typeof window.$functionName === 'function') { window.$functionName($escapedValue); }",
                null,
            )
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
        val now = android.os.SystemClock.elapsedRealtime()
        synchronized(updateCheckLock) {
            if (updateCheckRunning || updateDialog?.isShowing == true) return
            if (now - lastUpdateCheckAt < UPDATE_CHECK_INTERVAL_MS) return
            updateCheckRunning = true
            lastUpdateCheckAt = now
        }

        Thread {
            try {
                val url = URL("https://api.github.com/repos/aiThss/check-in-love/releases/latest")
                val conn = url.openConnection() as HttpsURLConnection
                conn.connectTimeout = 7000
                conn.readTimeout = 7000
                conn.requestMethod = "GET"
                conn.setRequestProperty("User-Agent", "LoveCheckUpdater")
                conn.setRequestProperty("Cache-Control", "no-cache")
                conn.setRequestProperty("Accept", "application/vnd.github+json")

                if (conn.responseCode == 200) {
                    val response = conn.inputStream.bufferedReader().readText()
                    val json = JSONObject(response)
                    val tagName = json.getString("tag_name")
                    val currentVersion = packageManager
                        .getPackageInfo(packageName, 0)
                        .versionName
                        ?: ""
                    val latestVersion = tagName.removePrefix("v")

                    if (compareVersions(latestVersion, currentVersion) > 0) {
                        val assets = json.getJSONArray("assets")
                        var apkUrl: String? = null

                        for (i in 0 until assets.length()) {
                            val asset = assets.getJSONObject(i)
                            if (asset.getString("name").endsWith(".apk", ignoreCase = true)) {
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
            } finally {
                synchronized(updateCheckLock) {
                    updateCheckRunning = false
                }
            }
        }.start()
    }

    private fun showUpdateDialog(version: String, url: String) {
        if (isFinishing || isDestroyed || updateDialog?.isShowing == true) return

        val dialogView = layoutInflater.inflate(R.layout.dialog_update, null)
        val dialog = AlertDialog.Builder(this)
            .setView(dialogView)
            .create()

        updateDialog = dialog
        dialog.setOnDismissListener {
            if (updateDialog === dialog) updateDialog = null
        }

        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        val txtMessage = dialogView.findViewById<android.widget.TextView>(R.id.dialog_message)
        val stickerPatchNote = if (compareVersions(version, STICKER_PATCH_VERSION) >= 0) {
            "\n\nBản vá này bổ sung gửi sticker trực tiếp từ bàn phím và sửa nhận ảnh clipboard."
        } else {
            ""
        }
        txtMessage.text =
            "Có phiên bản mới (v$version). Bạn có muốn tải xuống và cập nhật ngay không?$stickerPatchNote"

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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            !packageManager.canRequestPackageInstalls()
        ) {
            synchronized(updateCheckLock) {
                lastUpdateCheckAt = 0L
            }
            startActivity(
                Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:$packageName"),
                ),
            )
            return
        }

        val request = DownloadManager.Request(Uri.parse(apkUrl))
            .setTitle("Check IN Love Update")
            .setDescription("Đang tải xuống phiên bản mới...")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalPublicDir(
                Environment.DIRECTORY_DOWNLOADS,
                "check-in-love-update.apk",
            )

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
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                                Intent.FLAG_GRANT_READ_URI_PERMISSION
                        }
                        context.startActivity(installIntent)
                    }
                    context.unregisterReceiver(this)
                }
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(
                receiver,
                IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
                Context.RECEIVER_EXPORTED,
            )
        } else {
            registerReceiver(
                receiver,
                IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
            )
        }
    }

    companion object {
        private const val TAG = "LoveCheckGoogle"
        private const val APP_URL = "https://couple.io.vn"
        private const val RETRY_SCHEME = "lovecheck"
        private const val STICKER_PATCH_VERSION = "1.1.10"
        private const val UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000L

        private val allowedHosts = setOf(
            "couple.io.vn",
            "api.couple.io.vn",
            "couple.babyress.games",
            "api.couple.babyress.games",
            "localhost",
            "127.0.0.1",
            "10.0.2.2",
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
            val alarmManager =
                context.getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
            val hours = listOf(7, 12, 18, 23)

            for (hour in hours) {
                val intent = Intent(context, NotificationReceiver::class.java)
                val pendingIntent = PendingIntent.getBroadcast(
                    context,
                    hour,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
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
                    pendingIntent,
                )
            }
        }
    }
}
