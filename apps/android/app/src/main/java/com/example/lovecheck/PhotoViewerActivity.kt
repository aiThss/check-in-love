package com.example.lovecheck

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import coil3.compose.AsyncImagePainter
import coil3.compose.rememberAsyncImagePainter
import coil3.request.ImageRequest
import coil3.request.crossfade

class PhotoViewerActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val photoUrl  = intent.getStringExtra("photoUrl")  ?: ""
        val caption   = intent.getStringExtra("caption")   ?: ""
        val ownerName = intent.getStringExtra("ownerName") ?: ""
        val dateStr   = intent.getStringExtra("dateStr")   ?: ""
        val fileName  = intent.getStringExtra("fileName")  ?: "checkin-love.jpg"

        setContent {
            PhotoViewerScreen(
                photoUrl  = photoUrl,
                caption   = caption,
                ownerName = ownerName,
                dateStr   = dateStr,
                fileName  = fileName,
                onDownload = { downloadPhoto(photoUrl, fileName) },
                onClose    = { finish() },
            )
        }
    }

    private fun downloadPhoto(url: String, fileName: String) {
        if (url.isEmpty()) return
        try {
            val request = DownloadManager.Request(Uri.parse(url))
                .setTitle(fileName)
                .setDescription("Đang tải ảnh check-in...")
                .setNotificationVisibility(
                    DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED
                )
                .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)

            val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            dm.enqueue(request)
            Toast.makeText(this, "Đang tải ảnh xuống...", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Toast.makeText(this, "Không thể tải ảnh", Toast.LENGTH_SHORT).show()
            e.printStackTrace()
        }
    }
}

// ─── Composable ────────────────────────────────────────────────────────────────

@Composable
fun PhotoViewerScreen(
    photoUrl:  String,
    caption:   String,
    ownerName: String,
    dateStr:   String,
    fileName:  String,
    onDownload: () -> Unit,
    onClose:    () -> Unit,
) {
    val context = LocalContext.current
    var isLoading by remember { mutableStateOf(true) }
    var hasError  by remember { mutableStateOf(false) }
    var downloadPressed by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0A0A0A)),
    ) {
        // ── Image ────────────────────────────────────────────────────────────
        val painter = rememberAsyncImagePainter(
            model = ImageRequest.Builder(context)
                .data(photoUrl)
                .crossfade(300)
                .build(),
            onLoading = { isLoading = true;  hasError = false },
            onSuccess = { isLoading = false; hasError = false },
            onError   = { isLoading = false; hasError = true  },
        )

        androidx.compose.foundation.Image(
            painter           = painter,
            contentDescription = caption.ifEmpty { "Ảnh check-in" },
            contentScale      = ContentScale.Fit,
            modifier          = Modifier
                .fillMaxWidth()
                .wrapContentHeight()
                .align(Alignment.Center),
        )

        // Loading spinner
        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.align(Alignment.Center),
                color    = Color(0xFFFF3B7F),
                strokeWidth = 3.dp,
            )
        }

        // Error message
        if (hasError) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.align(Alignment.Center),
            ) {
                Text("😢", fontSize = 48.sp)
                Spacer(Modifier.height(8.dp))
                Text(
                    text      = "Không tải được ảnh",
                    color     = Color(0xFFAAAAAA),
                    fontSize  = 15.sp,
                    textAlign = TextAlign.Center,
                )
            }
        }

        // ── Bottom info bar ────────────────────────────────────────────────
        if (!isLoading && !hasError) {
            Column(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .background(
                        brush = Brush.verticalGradient(
                            colors = listOf(Color.Transparent, Color(0xCC000000)),
                        )
                    )
                    .padding(horizontal = 20.dp, vertical = 16.dp),
            ) {
                if (caption.isNotEmpty()) {
                    Text(
                        text       = caption,
                        color      = Color.White,
                        fontSize   = 15.sp,
                        fontWeight = FontWeight.Normal,
                    )
                    Spacer(Modifier.height(6.dp))
                }
                if (ownerName.isNotEmpty()) {
                    Text(
                        text     = "Gửi bởi $ownerName${if (dateStr.isNotEmpty()) "  ·  $dateStr" else ""}",
                        color    = Color(0xFFCCCCCC),
                        fontSize = 13.sp,
                    )
                }
            }
        }

        // ── Top bar ────────────────────────────────────────────────────────
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 36.dp, start = 12.dp, end = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Close button
            androidx.compose.material3.IconButton(
                onClick  = onClose,
                modifier = Modifier
                    .size(44.dp)
                    .background(Color(0x77000000), CircleShape),
            ) {
                Text("✕", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            }

            // Download button
            val downloadScale by animateFloatAsState(
                targetValue = if (downloadPressed) 0.88f else 1f,
                label = "download_scale",
            )
            androidx.compose.material3.IconButton(
                onClick = {
                    downloadPressed = true
                    onDownload()
                    // reset after animation
                    android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                        downloadPressed = false
                    }, 300)
                },
                modifier = Modifier
                    .size(44.dp)
                    .background(Color(0xFFFF3B7F), CircleShape),
            ) {
                Text(
                    text     = "↓",
                    color    = Color.White,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}
