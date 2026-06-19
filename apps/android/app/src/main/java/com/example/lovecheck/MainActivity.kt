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
}
