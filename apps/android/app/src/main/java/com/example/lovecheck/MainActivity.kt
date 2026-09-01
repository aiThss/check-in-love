package com.example.lovecheck

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.DownloadManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Rect
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.provider.Settings
import android.util.Log
import android.util.Base64
import android.view.View
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
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
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
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject

class LoveCheckBridge(
    private val context: Context,
    private val onGoogleSignInRequested: () -> Unit,
) {
    private val mainHandler = Handler(Looper.getMainLooper())

    private fun resolveRemoteUrl(url: String): String {
        val trimmedUrl = url.trim()
        if (trimmedUrl.startsWith("https://") || trimmedUrl.startsWith("http://")) {
            return trimmedUrl
        }
        return "https://couple.io.vn/${trimmedUrl.trimStart('/')}"
    }

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
            val request = DownloadManager.Request(Uri.parse(resolveRemoteUrl(url)))
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
            val resolvedPhotoUrl = resolveRemoteUrl(photoUrl)
            val intent = Intent(context, PhotoViewerActivity::class.java).apply {
                putExtra("photoUrl", resolvedPhotoUrl)
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

    /**
     * Returns the latest FCM token retained by Android. The PWA can pull this
     * after its JavaScript listener and session are ready, rather than relying
     * on a single page-load callback from the native activity.
     */
    @JavascriptInterface
    fun getFcmToken(): String {
        val prefs = context.getSharedPreferences("lovecheck", Context.MODE_PRIVATE)
        return prefs.getString("fcm_token", "").orEmpty()
    }

    @JavascriptInterface
    fun setAuthToken(token: String?) {
        val prefs = context.getSharedPreferences("lovecheck", Context.MODE_PRIVATE)
        prefs.edit().apply {
            if (token.isNullOrBlank()) remove("auth_token") else putString("auth_token", token)
        }.apply()
    }

    @JavascriptInterface
    fun getFcmDebugInfo(): String {
        val prefs = context.getSharedPreferences("lovecheck", Context.MODE_PRIVATE)
        val token = prefs.getString("fcm_token", "").orEmpty()
        val error = prefs.getString("fcm_error", "").orEmpty()
        val escapedToken = JSONObject.quote(token)
        val escapedError = JSONObject.quote(error)
        return "{\"token\":$escapedToken,\"error\":$escapedError}"
    }

    @JavascriptInterface
    fun getPendingShareData(): String {
        val prefs = context.getSharedPreferences("lovecheck", Context.MODE_PRIVATE)
        val text = prefs.getString("pending_share_text", "").orEmpty()
        val uriValues = prefs.getString("pending_share_uris", "").orEmpty()
            .split('\n')
            .map(String::trim)
            .filter(String::isNotEmpty)
        val images = org.json.JSONArray()
        uriValues.take(4).forEach { rawUri ->
            try {
                val uri = Uri.parse(rawUri)
                val bytes = context.contentResolver.openInputStream(uri)?.use { input ->
                    input.readBytes().take(8 * 1024 * 1024).toByteArray()
                } ?: return@forEach
                val mime = context.contentResolver.getType(uri) ?: "image/jpeg"
                images.put(org.json.JSONObject().apply {
                    put("dataUrl", "data:$mime;base64,${Base64.encodeToString(bytes, Base64.NO_WRAP)}")
                    put("name", "shared-image.jpg")
                    put("type", mime)
                })
            } catch (_: Exception) {
                // A revoked grant should not prevent the text share from arriving.
            }
        }
        prefs.edit().remove("pending_share_text").remove("pending_share_uris").apply()
        return org.json.JSONObject().apply {
            put("text", text)
            put("images", images)
        }.toString()
    }

    private fun getBitmapFromUrl(urlStr: String): Bitmap? {
        return try {
            val url = URL(urlStr)
            val connection = url.openConnection() as HttpsURLConnection
            connection.doInput = true
            connection.connectTimeout = 2500
            connection.readTimeout = 2500
            connection.connect()
            val input = connection.inputStream
            val bitmap = BitmapFactory.decodeStream(input)
            input.close()
            connection.disconnect()
            bitmap
        } catch (e: Exception) {
            null
        }
    }

    private fun getSquareBitmap(bitmap: Bitmap): Bitmap? {
        return try {
            val size = minOf(bitmap.width, bitmap.height)
            if (size <= 0) return null

            val left = (bitmap.width - size) / 2
            val top = (bitmap.height - size) / 2
            Bitmap.createBitmap(bitmap, left, top, size, size)
        } catch (e: Exception) {
            null
        }
    }

    private fun getCircleBitmap(bitmap: Bitmap): Bitmap? {
        return try {
            val minSize = Math.min(bitmap.width, bitmap.height)
            if (minSize <= 0) return null

            val output = Bitmap.createBitmap(minSize, minSize, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(output)
            val paint = Paint()
            val rect = Rect(0, 0, minSize, minSize)
            paint.isAntiAlias = true
            canvas.drawARGB(0, 0, 0, 0)
            paint.color = 0xff424242.toInt()

            val radius = (minSize / 2).toFloat()
            canvas.drawCircle(radius, radius, radius, paint)
            paint.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN)
            canvas.drawBitmap(bitmap, rect, rect, paint)
            output
        } catch (e: Exception) {
            null
        }
    }

    private fun normalizeLocalNotificationTitle(title: String): String {
        val suffixes = listOf(
            " đã gửi ảnh mới 📸",
            " đã gửi ảnh mới",
            " đã nhắn cho bạn",
            " đã react check-in của bạn",
            " đã reply check-in của bạn",
            " đã check-in! 💕",
            " đã check-in!",
        )
        return suffixes.firstNotNullOfOrNull { suffix ->
            title.takeIf { it.endsWith(suffix) }?.removeSuffix(suffix)?.trim()
        } ?: title
    }

    private fun compactLocalNotificationBody(body: String, photoUrl: String?): String {
        val trimmed = body.trim()
        val isGenericPhotoText = trimmed.isEmpty() ||
            trimmed.equals("Xem ngay nào!", ignoreCase = true) ||
            trimmed.equals("vừa gửi 1 ảnh check-in", ignoreCase = true) ||
            trimmed.equals("vừa gửi 1 ảnh check in", ignoreCase = true)

        return if (!photoUrl.isNullOrBlank() && isGenericPhotoText) "Ảnh mới 📸" else body
    }

    @JavascriptInterface
    fun showLocalNotification(
        title: String,
        body: String,
        targetUrl: String,
        photoUrl: String?,
        senderAvatar: String?,
        messageId: String?
    ) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val displayTitle = normalizeLocalNotificationTitle(title)
                val displayBody = compactLocalNotificationBody(body, photoUrl)
                val channelId = "realtime_interactions"
                val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                val defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val audioAttributes = AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                        .build()

                    val channel = NotificationChannel(
                        channelId,
                        "Tương tác thời gian thực",
                        NotificationManager.IMPORTANCE_HIGH
                    ).apply {
                        description = "Thông báo react, reply, tin nhắn và check-in thời gian thực"
                        enableLights(true)
                        enableVibration(true)
                        vibrationPattern = longArrayOf(0, 250, 150, 250)
                        lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
                        setSound(defaultSoundUri, audioAttributes)
                    }
                    notificationManager.createNotificationChannel(channel)
                }

                val fullTargetUrl = if (targetUrl.startsWith("http://") || targetUrl.startsWith("https://")) {
                    targetUrl
                } else {
                    "https://couple.io.vn${if (targetUrl.startsWith("/")) "" else "/"}$targetUrl"
                }

                val intent = Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                    data = Uri.parse(fullTargetUrl)
                    putExtra("targetUrl", targetUrl)
                }
                val pendingIntent = PendingIntent.getActivity(
                    context,
                    (System.currentTimeMillis() % 100000).toInt(),
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )

                // Download and crop sender avatar safely to circular icon
                var avatarBitmap: Bitmap? = null
                if (!senderAvatar.isNullOrBlank()) {
                    val resolvedAvatarUrl = if (senderAvatar.startsWith("/")) {
                        "https://couple.io.vn$senderAvatar"
                    } else {
                        senderAvatar
                    }
                    val bitmap = getBitmapFromUrl(resolvedAvatarUrl)
                    if (bitmap != null) {
                        avatarBitmap = getCircleBitmap(bitmap)
                    }
                }

                val largeIcon = avatarBitmap ?: BitmapFactory.decodeResource(context.resources, R.mipmap.ic_launcher)

                // Download photo preview if attached
                var photoBitmap: Bitmap? = null
                if (!photoUrl.isNullOrBlank()) {
                    val resolvedPhotoUrl = if (photoUrl.startsWith("/")) {
                        "https://couple.io.vn$photoUrl"
                    } else {
                        photoUrl
                    }
                    photoBitmap = getBitmapFromUrl(resolvedPhotoUrl)?.let { getSquareBitmap(it) }
                }

                val builder = NotificationCompat.Builder(context, channelId)
                    .setSmallIcon(R.drawable.ic_notification)
                    .setLargeIcon(largeIcon)
                    .setColor(0xFFFF3B7F.toInt())
                    .setContentTitle(displayTitle)
                    .setContentText(displayBody)
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setDefaults(NotificationCompat.DEFAULT_ALL)
                    .setSound(defaultSoundUri)
                    .setVibrate(longArrayOf(0, 250, 150, 250))
                    .setAutoCancel(true)
                    .setContentIntent(pendingIntent)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)

                if (photoBitmap != null) {
                    builder.setStyle(
                        NotificationCompat.BigPictureStyle()
                            .bigPicture(photoBitmap)
                            .setSummaryText(displayBody)
                    )
                } else {
                    builder.setStyle(NotificationCompat.BigTextStyle().bigText(displayBody))
                }

                val notificationId = (System.currentTimeMillis() % 100000).toInt()
                addNotificationReplyAction(context, builder, notificationId, messageId)
                notificationManager.notify(notificationId, builder.build())
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    @JavascriptInterface
    fun showLocalNotification(
        title: String,
        body: String,
        targetUrl: String,
        photoUrl: String?,
        senderAvatar: String?
    ) {
        showLocalNotification(title, body, targetUrl, photoUrl, senderAvatar, null)
    }

    @JavascriptInterface
    fun showLocalNotification(title: String, body: String, targetUrl: String, photoUrl: String?) {
        showLocalNotification(title, body, targetUrl, photoUrl, null, null)
    }
}

class MainActivity : ComponentActivity() {

    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private var fileChooserActive = false
    private var suppressWebBackUntil = 0L
    private var cameraPhotoUri: Uri? = null
    private var cameraPhotoFile: File? = null
    private var webView: WebView? = null
    private var pendingFcmToken: String? = null
    private var webPageLoaded = false
    private var pendingShareUris: List<Uri> = emptyList()
    private var pendingShareText: String = ""
    private val updateCheckLock = Any()
    private var updateCheckRunning = false
    private var lastUpdateCheckAt = 0L
    private var updateUiState by mutableStateOf<UpdateUiState?>(null)
    private val updateProgressHandler = Handler(Looper.getMainLooper())
    private var updateProgressRunnable: Runnable? = null
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
        fileChooserActive = false
        suppressWebBackUntil =
            android.os.SystemClock.elapsedRealtime() + FILE_CHOOSER_BACK_GUARD_MS

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

    private fun fetchFcmTokenWithRetry(retryCount: Int = 0) {
        try {
            FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                val prefs = getSharedPreferences("lovecheck", Context.MODE_PRIVATE)
                if (task.isSuccessful) {
                    val token = task.result
                    Log.i("LoveCheckFCM", "FCM token fetched successfully: $token")
                    prefs.edit()
                        .putString("fcm_token", token)
                        .putString("fcm_error", "")
                        .apply()
                    runOnUiThread { injectFcmToken(token) }
                } else {
                    val errorMsg = task.exception?.message ?: "Unknown error"
                    Log.e("LoveCheckFCM", "Failed to fetch FCM token (attempt $retryCount): $errorMsg", task.exception)
                    prefs.edit().putString("fcm_error", errorMsg).apply()
                    if (retryCount < 4) {
                        Handler(Looper.getMainLooper()).postDelayed({
                            fetchFcmTokenWithRetry(retryCount + 1)
                        }, 2500L * (retryCount + 1))
                    }
                }
            }
        } catch (e: Exception) {
            val errorMsg = e.message ?: "Exception calling FirebaseMessaging"
            Log.e("LoveCheckFCM", "Exception calling FirebaseMessaging", e)
            val prefs = getSharedPreferences("lovecheck", Context.MODE_PRIVATE)
            prefs.edit().putString("fcm_error", errorMsg).apply()
        }
    }

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        captureIncomingShare(intent)

        val filter = IntentFilter("com.example.lovecheck.FCM_TOKEN_UPDATE")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(fcmReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(fcmReceiver, filter)
        }

        fetchFcmTokenWithRetry(0)

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
            Box(modifier = Modifier.fillMaxSize()) {
                AndroidView(
                    factory = { context ->
                        StickerWebView(context).apply {
                        webView = this

                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS
                        }

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
                                dispatchPendingShareToWeb()

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
                                fileChooserActive = true
                                suppressWebBackUntil = 0L
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

                updateUiState?.let { state ->
                    UpdateBottomBar(
                        state = state,
                        onPrimary = { onUpdatePrimaryAction(state) },
                        onSecondary = { onUpdateSecondaryAction(state) },
                    )
                }
            }
        }

        installBackHandler()
    }

    override fun onResume() {
        super.onResume()
        if (!restorePendingUpdateDownload()) {
            checkUpdate()
        }
    }

    override fun onPause() {
        stopUpdateProgressTracking()
        super.onPause()
    }

    private fun installBackHandler() {
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (
                        fileChooserActive ||
                        android.os.SystemClock.elapsedRealtime() < suppressWebBackUntil
                    ) {
                        // Returning from the native camera/file picker can deliver one
                        // extra Back event to the host Activity. Do not let it pop the
                        // previous SPA tab after the chooser has already returned.
                        return
                    }

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
        captureIncomingShare(intent)
        val url = initialUrlFromIntent(intent)
        if (url != APP_URL) {
            webView?.loadUrl(url)
        }
    }

    private fun captureIncomingShare(intent: Intent?) {
        if (intent?.action != Intent.ACTION_SEND && intent?.action != Intent.ACTION_SEND_MULTIPLE) return
        pendingShareText = intent.getStringExtra(Intent.EXTRA_TEXT).orEmpty()
        val uris = mutableListOf<Uri>()
        intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)?.let(uris::addAll)
        intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)?.let(uris::add)
        intent.clipData?.let { clip ->
            for (index in 0 until clip.itemCount) clip.getItemAt(index).uri?.let(uris::add)
        }
        pendingShareUris = uris.distinct().take(4)
        if (pendingShareUris.isEmpty() && pendingShareText.isBlank()) return
        getSharedPreferences("lovecheck", Context.MODE_PRIVATE).edit()
            .putString("pending_share_text", pendingShareText)
            .putString("pending_share_uris", pendingShareUris.joinToString("\n") { it.toString() })
            .apply()
        dispatchPendingShareToWeb()
    }

    private fun dispatchPendingShareToWeb() {
        if (!webPageLoaded) return
        webView?.post {
            webView?.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('lovecheck:android-share'));",
                null,
            )
        }
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
        val targetUrl = intent?.getStringExtra("targetUrl")
            ?: intent?.extras?.getString("targetUrl")
            ?: intent?.getStringExtra("url")
            ?: intent?.extras?.getString("url")

        if (!targetUrl.isNullOrBlank()) {
            val fullUrl = if (targetUrl.startsWith("http://") || targetUrl.startsWith("https://")) {
                targetUrl
            } else {
                "$APP_URL${if (targetUrl.startsWith("/")) "" else "/"}$targetUrl"
            }
            val uri = Uri.parse(fullUrl)
            if (isAllowedInWebView(uri)) return fullUrl
        }

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

        val escaped = JSONObject.quote(token)
        webView?.evaluateJavascript(
            "if (typeof window.onFcmTokenReceived === 'function') { window.onFcmTokenReceived($escaped); }",
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
        stopUpdateProgressTracking()
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
            if (updateCheckRunning || updateUiState != null) return
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
                                showUpdateAvailable(latestVersion, apkUrl)
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

    private fun showUpdateAvailable(version: String, url: String) {
        if (isFinishing || isDestroyed || updateUiState != null) return

        val stickerPatchNote = if (compareVersions(version, STICKER_PATCH_VERSION) >= 0) {
            " Bản này bổ sung gửi sticker trực tiếp từ bàn phím và sửa nhận ảnh clipboard."
        } else {
            ""
        }
        updateUiState = UpdateUiState(
            stage = UpdateStage.AVAILABLE,
            version = version,
            apkUrl = url,
            detail = "Đã có Check IN Love v$version.$stickerPatchNote",
        )
    }

    private fun onUpdatePrimaryAction(state: UpdateUiState) {
        when (state.stage) {
            UpdateStage.AVAILABLE -> startUpdateDownload(state.version, state.apkUrl)
            UpdateStage.DOWNLOADING -> Unit
            UpdateStage.READY -> installDownloadedUpdate()
            UpdateStage.FAILED -> {
                if (state.apkUrl.isNullOrBlank()) {
                    clearStoredUpdateDownload(removeDownload = true)
                    updateUiState = null
                    synchronized(updateCheckLock) { lastUpdateCheckAt = 0L }
                    checkUpdate()
                } else {
                    startUpdateDownload(state.version, state.apkUrl)
                }
            }
        }
    }

    private fun onUpdateSecondaryAction(state: UpdateUiState) {
        when (state.stage) {
            UpdateStage.AVAILABLE -> updateUiState = null
            UpdateStage.DOWNLOADING -> cancelUpdateDownload()
            // The finished APK remains registered in DownloadManager so it can be offered
            // again after the user reopens the app.
            UpdateStage.READY -> updateUiState = null
            UpdateStage.FAILED -> {
                clearStoredUpdateDownload(removeDownload = true)
                updateUiState = null
            }
        }
    }

    private fun startUpdateDownload(version: String, apkUrl: String?) {
        if (apkUrl.isNullOrBlank()) return

        clearStoredUpdateDownload(removeDownload = true)
        val fileVersion = version.replace(Regex("[^0-9A-Za-z._-]"), "_")
        val request = DownloadManager.Request(Uri.parse(apkUrl))
            .setTitle("Check IN Love Update v$version")
            .setDescription("Đang tải xuống phiên bản mới...")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
            .setDestinationInExternalPublicDir(
                Environment.DIRECTORY_DOWNLOADS,
                "check-in-love-update-v$fileVersion.apk",
            )

        try {
            val downloadManager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            val downloadId = downloadManager.enqueue(request)
            updatePreferences().edit()
                .putLong(UPDATE_DOWNLOAD_ID, downloadId)
                .putString(UPDATE_DOWNLOAD_VERSION, version)
                .putString(UPDATE_DOWNLOAD_URL, apkUrl)
                .apply()
            updateUiState = UpdateUiState(
                stage = UpdateStage.DOWNLOADING,
                version = version,
                apkUrl = apkUrl,
                detail = "Đang chuẩn bị tải xuống...",
            )
            startUpdateProgressTracking(downloadId, version, apkUrl)
        } catch (error: Exception) {
            updateUiState = UpdateUiState(
                stage = UpdateStage.FAILED,
                version = version,
                apkUrl = apkUrl,
                detail = "Không thể bắt đầu tải xuống. Hãy thử lại.",
            )
            Log.e(TAG, "Unable to enqueue app update", error)
        }
    }

    private fun cancelUpdateDownload() {
        clearStoredUpdateDownload(removeDownload = true)
        stopUpdateProgressTracking()
        updateUiState = null
    }

    private fun restorePendingUpdateDownload(): Boolean {
        val prefs = updatePreferences()
        val downloadId = prefs.getLong(UPDATE_DOWNLOAD_ID, -1L)
        val version = prefs.getString(UPDATE_DOWNLOAD_VERSION, "").orEmpty()
        val apkUrl = prefs.getString(UPDATE_DOWNLOAD_URL, null)
        if (downloadId < 0L || version.isBlank()) return false

        val currentVersion = packageManager.getPackageInfo(packageName, 0).versionName.orEmpty()
        if (compareVersions(version, currentVersion) <= 0) {
            clearStoredUpdateDownload(removeDownload = true)
            return false
        }

        val snapshot = queryUpdateDownload(downloadId)
        if (snapshot == null) {
            clearStoredUpdateDownload(removeDownload = false)
            return false
        }

        when (snapshot.status) {
            DownloadManager.STATUS_SUCCESSFUL -> {
                updateUiState = UpdateUiState(
                    stage = UpdateStage.READY,
                    version = version,
                    apkUrl = apkUrl,
                    detail = completedDownloadDetail(snapshot),
                )
            }
            DownloadManager.STATUS_FAILED -> {
                updateUiState = UpdateUiState(
                    stage = UpdateStage.FAILED,
                    version = version,
                    apkUrl = apkUrl,
                    detail = "Không thể tải bản cập nhật. Hãy kiểm tra mạng hoặc bộ nhớ rồi thử lại.",
                )
            }
            else -> {
                showDownloadingUpdate(version, apkUrl, snapshot)
                startUpdateProgressTracking(downloadId, version, apkUrl)
            }
        }
        return true
    }

    private fun startUpdateProgressTracking(downloadId: Long, version: String, apkUrl: String?) {
        stopUpdateProgressTracking()
        val task = object : Runnable {
            override fun run() {
                when (val snapshot = queryUpdateDownload(downloadId)) {
                    null -> {
                        updateUiState = UpdateUiState(
                            stage = UpdateStage.FAILED,
                            version = version,
                            apkUrl = apkUrl,
                            detail = "Không tìm thấy tác vụ tải xuống. Hãy thử lại.",
                        )
                        stopUpdateProgressTracking()
                    }
                    else -> when (snapshot.status) {
                        DownloadManager.STATUS_SUCCESSFUL -> {
                            updateUiState = UpdateUiState(
                                stage = UpdateStage.READY,
                                version = version,
                                apkUrl = apkUrl,
                                detail = completedDownloadDetail(snapshot),
                            )
                            stopUpdateProgressTracking()
                        }
                        DownloadManager.STATUS_FAILED -> {
                            updateUiState = UpdateUiState(
                                stage = UpdateStage.FAILED,
                                version = version,
                                apkUrl = apkUrl,
                                detail = "Không thể tải bản cập nhật. Hãy kiểm tra mạng hoặc bộ nhớ rồi thử lại.",
                            )
                            stopUpdateProgressTracking()
                        }
                        else -> {
                            showDownloadingUpdate(version, apkUrl, snapshot)
                            updateProgressHandler.postDelayed(this, UPDATE_PROGRESS_INTERVAL_MS)
                        }
                    }
                }
            }
        }
        updateProgressRunnable = task
        updateProgressHandler.post(task)
    }

    private fun stopUpdateProgressTracking() {
        updateProgressRunnable?.let(updateProgressHandler::removeCallbacks)
        updateProgressRunnable = null
    }

    private fun showDownloadingUpdate(
        version: String,
        apkUrl: String?,
        snapshot: UpdateDownloadSnapshot,
    ) {
        val totalBytes = snapshot.totalBytes
        val downloadedBytes = snapshot.downloadedBytes.coerceAtLeast(0L)
        val progress = if (totalBytes > 0L) {
            ((downloadedBytes * 100L) / totalBytes).toInt().coerceIn(0, 100)
        } else {
            0
        }
        val stateText = if (snapshot.status == DownloadManager.STATUS_PAUSED) {
            "Đang chờ kết nối để tiếp tục tải..."
        } else {
            "Đang tải xuống..."
        }
        val sizeText = if (totalBytes > 0L) {
            "${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)}"
        } else {
            formatBytes(downloadedBytes)
        }
        updateUiState = UpdateUiState(
            stage = UpdateStage.DOWNLOADING,
            version = version,
            apkUrl = apkUrl,
            progress = progress,
            detail = "$stateText $sizeText",
        )
    }

    private fun completedDownloadDetail(snapshot: UpdateDownloadSnapshot): String {
        val bytes = snapshot.totalBytes.takeIf { it > 0L } ?: snapshot.downloadedBytes
        return if (bytes > 0L) {
            "Đã tải xong ${formatBytes(bytes)}. Bạn có thể cài ngay hoặc để sau."
        } else {
            "Đã tải xong. Bạn có thể cài ngay hoặc để sau."
        }
    }

    private fun installDownloadedUpdate() {
        val downloadId = updatePreferences().getLong(UPDATE_DOWNLOAD_ID, -1L)
        if (downloadId < 0L || queryUpdateDownload(downloadId)?.status != DownloadManager.STATUS_SUCCESSFUL) {
            restorePendingUpdateDownload()
            return
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            !packageManager.canRequestPackageInstalls()
        ) {
            startActivity(
                Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:$packageName"),
                ),
            )
            return
        }

        val downloadManager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val apkUri = downloadManager.getUriForDownloadedFile(downloadId)
        if (apkUri == null) {
            updateUiState = updateUiState?.copy(
                stage = UpdateStage.FAILED,
                detail = "Không tìm thấy tệp cập nhật. Hãy tải lại.",
            )
            return
        }

        try {
            startActivity(
                Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(apkUri, "application/vnd.android.package-archive")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                },
            )
        } catch (error: Exception) {
            updateUiState = updateUiState?.copy(
                stage = UpdateStage.FAILED,
                detail = "Không thể mở trình cài đặt. Hãy tải lại bản cập nhật.",
            )
            Log.e(TAG, "Unable to open package installer", error)
        }
    }

    private fun queryUpdateDownload(downloadId: Long): UpdateDownloadSnapshot? {
        return try {
            val downloadManager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            downloadManager.query(DownloadManager.Query().setFilterById(downloadId))?.use { cursor ->
                if (!cursor.moveToFirst()) return null
                UpdateDownloadSnapshot(
                    status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)),
                    downloadedBytes = cursor.getLong(
                        cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR),
                    ),
                    totalBytes = cursor.getLong(
                        cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES),
                    ),
                )
            }
        } catch (error: Exception) {
            Log.w(TAG, "Unable to read update download status", error)
            null
        }
    }

    private fun clearStoredUpdateDownload(removeDownload: Boolean) {
        val prefs = updatePreferences()
        val downloadId = prefs.getLong(UPDATE_DOWNLOAD_ID, -1L)
        if (removeDownload && downloadId >= 0L) {
            try {
                (getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).remove(downloadId)
            } catch (error: Exception) {
                Log.w(TAG, "Unable to remove update download", error)
            }
        }
        prefs.edit()
            .remove(UPDATE_DOWNLOAD_ID)
            .remove(UPDATE_DOWNLOAD_VERSION)
            .remove(UPDATE_DOWNLOAD_URL)
            .apply()
    }

    private fun updatePreferences() =
        getSharedPreferences(UPDATE_PREFERENCES, Context.MODE_PRIVATE)

    private fun formatBytes(bytes: Long): String {
        return when {
            bytes < 1024L -> "$bytes B"
            bytes < 1024L * 1024L -> "${bytes / 1024L} KB"
            else -> String.format(Locale.getDefault(), "%.1f MB", bytes / (1024f * 1024f))
        }
    }

    companion object {
        private const val TAG = "LoveCheckGoogle"
        private const val APP_URL = "https://couple.io.vn"
        private const val RETRY_SCHEME = "lovecheck"
        private const val STICKER_PATCH_VERSION = "1.1.10"
        private const val UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000L
        private const val UPDATE_PROGRESS_INTERVAL_MS = 400L
        private const val UPDATE_PREFERENCES = "lovecheck_update"
        private const val UPDATE_DOWNLOAD_ID = "download_id"
        private const val UPDATE_DOWNLOAD_VERSION = "download_version"
        private const val UPDATE_DOWNLOAD_URL = "download_url"
        private const val FILE_CHOOSER_BACK_GUARD_MS = 1200L

        private val allowedHosts = setOf(
            "couple.io.vn",
            "api.couple.io.vn",
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

private enum class UpdateStage {
    AVAILABLE,
    DOWNLOADING,
    READY,
    FAILED,
}

private data class UpdateUiState(
    val stage: UpdateStage,
    val version: String,
    val apkUrl: String?,
    val progress: Int = 0,
    val detail: String,
)

private data class UpdateDownloadSnapshot(
    val status: Int,
    val downloadedBytes: Long,
    val totalBytes: Long,
)

@Composable
private fun UpdateBottomBar(
    state: UpdateUiState,
    onPrimary: () -> Unit,
    onSecondary: () -> Unit,
) {
    val title = when (state.stage) {
        UpdateStage.AVAILABLE -> "Có bản cập nhật mới"
        UpdateStage.DOWNLOADING -> "Đang tải Check IN Love v${state.version}"
        UpdateStage.READY -> "Bản v${state.version} đã sẵn sàng"
        UpdateStage.FAILED -> "Chưa tải được bản cập nhật"
    }
    val primaryLabel = when (state.stage) {
        UpdateStage.AVAILABLE -> "Tải xuống"
        UpdateStage.DOWNLOADING -> "Đang tải"
        UpdateStage.READY -> "Cập nhật"
        UpdateStage.FAILED -> "Tải lại"
    }
    val secondaryLabel = when (state.stage) {
        UpdateStage.AVAILABLE, UpdateStage.READY -> "Để sau"
        UpdateStage.DOWNLOADING -> "Hủy tải"
        UpdateStage.FAILED -> "Đóng"
    }

    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.BottomCenter,
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 12.dp, end = 12.dp, bottom = 14.dp),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xF21F1B24)),
            elevation = CardDefaults.cardElevation(defaultElevation = 12.dp),
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 18.dp, vertical = 16.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = title,
                            color = Color.White,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = state.detail,
                            color = Color(0xFFC9C3D4),
                            fontSize = 13.sp,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = when (state.stage) {
                            UpdateStage.AVAILABLE -> "✦"
                            UpdateStage.DOWNLOADING -> "${state.progress}%"
                            UpdateStage.READY -> "✓"
                            UpdateStage.FAILED -> "!"
                        },
                        color = Color(0xFFFF6B98),
                        fontSize = if (state.stage == UpdateStage.DOWNLOADING) 15.sp else 26.sp,
                        fontWeight = FontWeight.ExtraBold,
                    )
                }

                if (state.stage == UpdateStage.DOWNLOADING) {
                    Spacer(modifier = Modifier.height(14.dp))
                    LinearProgressIndicator(
                        progress = { state.progress / 100f },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(7.dp),
                        color = Color(0xFFFF477B),
                        trackColor = Color(0xFF403847),
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    OutlinedButton(
                        onClick = onSecondary,
                        modifier = Modifier
                            .weight(1f)
                            .height(46.dp),
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = Color(0xFFE0DAE9),
                        ),
                        shape = RoundedCornerShape(14.dp),
                    ) {
                        Text(secondaryLabel, fontWeight = FontWeight.Bold)
                    }
                    Button(
                        onClick = onPrimary,
                        enabled = state.stage != UpdateStage.DOWNLOADING,
                        modifier = Modifier
                            .weight(1f)
                            .height(46.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFFFF3B7F),
                            contentColor = Color.White,
                            disabledContainerColor = Color(0xFF6B4353),
                            disabledContentColor = Color(0xFFE3CBD3),
                        ),
                        shape = RoundedCornerShape(14.dp),
                    ) {
                        Text(primaryLabel, fontWeight = FontWeight.ExtraBold)
                    }
                }
            }
        }
    }
}
