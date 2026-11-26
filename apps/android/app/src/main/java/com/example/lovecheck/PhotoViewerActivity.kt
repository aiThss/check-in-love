package com.example.lovecheck

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import coil3.request.ImageRequest
import coil3.request.crossfade
import com.example.lovecheck.ui.glass.liquidGlass
import com.example.lovecheck.ui.glass.rememberBackdrop
import com.kyant.backdrop.backdrops.layerBackdrop

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
                photoUrl   = photoUrl,
                caption    = caption,
                ownerName  = ownerName,
                dateStr    = dateStr,
                fileName   = fileName,
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
    val backdrop = rememberBackdrop()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        Color(0xFF3A2230),
                        Color(0xFF261824),
                    ),
                ),
            ),
    ) {
        // ── Backdrop Layer: Ambient Orbs + Photo ─────────────────────────────
        Box(
            modifier = Modifier
                .fillMaxSize()
                .layerBackdrop(backdrop),
        ) {
            AsyncImage(
                model = ImageRequest.Builder(context)
                    .data(photoUrl)
                    .crossfade(300)
                    .build(),
                contentDescription = caption.ifEmpty { "Ảnh check-in" },
                contentScale = ContentScale.Fit,
                modifier = Modifier
                    .fillMaxSize()
                    .align(Alignment.Center),
                onLoading = { isLoading = true;  hasError = false },
                onSuccess = { isLoading = false; hasError = false },
                onError   = { isLoading = false; hasError = true  },
            )
        }

        // Loading spinner
        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.align(Alignment.Center),
                color    = Color(0xFFFF5C93),
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
                    color     = Color(0xFFE5B8CE),
                    fontSize  = 15.sp,
                    textAlign = TextAlign.Center,
                )
            }
        }

        // ── Bottom Liquid Glass Info Card ─────────────────────────────────────
        if (!isLoading && !hasError && (caption.isNotEmpty() || ownerName.isNotEmpty())) {
            val cardShape = RoundedCornerShape(24.dp)
            Column(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 24.dp)
                    .liquidGlass(
                        backdrop = backdrop,
                        shape = cardShape,
                        isInteractive = true,
                        tintColor = Color(0xFFFF85A1),
                        surfaceAlpha = 0.14f,
                        maxScale = 1.035f,
                    )
                    .border(
                        width = 1.dp,
                        color = Color(0x66FFAACD),
                        shape = cardShape,
                    )
                    .padding(horizontal = 20.dp, vertical = 16.dp),
            ) {
                if (caption.isNotEmpty()) {
                    Text(
                        text       = caption,
                        color      = Color(0xFFFFF0F5),
                        fontSize   = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Spacer(Modifier.height(6.dp))
                }
                if (ownerName.isNotEmpty()) {
                    Text(
                        text     = "Gửi bởi $ownerName${if (dateStr.isNotEmpty()) "  ·  $dateStr" else ""}",
                        color    = Color(0xFFE5B8CE),
                        fontSize = 13.sp,
                    )
                }
            }
        }

        // ── Top Liquid Glass Action Buttons ───────────────────────────────────
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 36.dp, start = 16.dp, end = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Close button with real Liquid Glass refraction + bulge
            IconButton(
                onClick  = onClose,
                modifier = Modifier
                    .size(46.dp)
                    .liquidGlass(
                        backdrop = backdrop,
                        shape = CircleShape,
                        isInteractive = true,
                        tintColor = Color.White,
                        surfaceAlpha = 0.12f,
                        maxScale = 1.28f,
                    )
                    .border(1.dp, Color(0x66FFAACD), CircleShape),
            ) {
                Text("✕", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            }

            // Download button with real Liquid Glass refraction + bulge
            IconButton(
                onClick = onDownload,
                modifier = Modifier
                    .size(46.dp)
                    .liquidGlass(
                        backdrop = backdrop,
                        shape = CircleShape,
                        isInteractive = true,
                        tintColor = Color(0xFFFF5C93),
                        surfaceAlpha = 0.42f,
                        maxScale = 1.28f,
                    )
                    .border(1.dp, Color(0x88FFD2E8), CircleShape),
            ) {
                Text(
                    text       = "↓",
                    color      = Color.White,
                    fontSize   = 20.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}
