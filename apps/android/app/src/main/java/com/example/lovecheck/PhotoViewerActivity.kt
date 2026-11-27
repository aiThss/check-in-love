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
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.IconButton
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
    val isDark = isSystemInDarkTheme()
    var isLoading by remember { mutableStateOf(true) }
    var hasError  by remember { mutableStateOf(false) }
    var intrinsicRatio by remember { mutableStateOf<Float?>(null) }
    val backdrop = rememberBackdrop()

    val bgBrush = if (isDark) {
        Brush.verticalGradient(colors = listOf(Color(0xFF3A2230), Color(0xFF261824)))
    } else {
        Brush.verticalGradient(colors = listOf(Color(0xFFFFF4F7), Color(0xFFF8E2E7)))
    }
    val primaryInk = if (isDark) Color(0xFFFFF0F5) else Color(0xFF2A101D)
    val secondaryInk = if (isDark) Color(0xFFE5B8CE) else Color(0xFF6F4B5B)
    val borderTint = if (isDark) Color(0x66FFAACD) else Color(0x442A101D)
    val photoShape = RoundedCornerShape(18.dp)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(bgBrush),
    ) {
        // ── Backdrop Layer: Rounded Photo Hugging Exact Aspect Ratio ─────────
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 12.dp, vertical = 92.dp)
                .layerBackdrop(backdrop),
            contentAlignment = Alignment.Center,
        ) {
            val availW = maxWidth
            val availH = maxHeight
            val ratio = intrinsicRatio
            val photoModifier = if (ratio != null && ratio > 0f && availW > 0.dp && availH > 0.dp) {
                var w = availW
                var h = availW / ratio
                if (h > availH) {
                    h = availH
                    w = availH * ratio
                }
                Modifier
                    .size(w, h)
                    .clip(photoShape)
                    .border(1.dp, borderTint, photoShape)
            } else {
                Modifier
                    .fillMaxWidth()
                    .clip(photoShape)
            }

            AsyncImage(
                model = ImageRequest.Builder(context)
                    .data(photoUrl)
                    .crossfade(260)
                    .build(),
                contentDescription = caption.ifEmpty { "Ảnh check-in" },
                contentScale = if (ratio != null) ContentScale.Crop else ContentScale.Fit,
                modifier = photoModifier,
                onLoading = { isLoading = true; hasError = false },
                onSuccess = { state ->
                    isLoading = false
                    hasError = false
                    val s = state.painter.intrinsicSize
                    if (s.width > 0f && s.height > 0f && s.width.isFinite() && s.height.isFinite()) {
                        intrinsicRatio = s.width / s.height
                    }
                },
                onError   = { isLoading = false; hasError = true },
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
                    color     = secondaryInk,
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
                        tintColor = if (isDark) Color(0xFFFF85A1) else Color.White,
                        surfaceAlpha = if (isDark) 0.16f else 0.72f,
                        maxScale = 1.035f,
                    )
                    .border(
                        width = 1.dp,
                        color = borderTint,
                        shape = cardShape,
                    )
                    .padding(horizontal = 20.dp, vertical = 16.dp),
            ) {
                if (caption.isNotEmpty()) {
                    Text(
                        text       = caption,
                        color      = primaryInk,
                        fontSize   = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    if (ownerName.isNotEmpty()) Spacer(Modifier.height(6.dp))
                }
                if (ownerName.isNotEmpty()) {
                    Text(
                        text     = "Gửi bởi $ownerName${if (dateStr.isNotEmpty()) "  ·  $dateStr" else ""}",
                        color    = secondaryInk,
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
            IconButton(
                onClick  = onClose,
                modifier = Modifier
                    .size(46.dp)
                    .liquidGlass(
                        backdrop = backdrop,
                        shape = CircleShape,
                        isInteractive = true,
                        tintColor = Color.White,
                        surfaceAlpha = if (isDark) 0.14f else 0.78f,
                        maxScale = 1.28f,
                    )
                    .border(1.dp, borderTint, CircleShape),
            ) {
                Text("✕", color = primaryInk, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            }

            IconButton(
                onClick = onDownload,
                modifier = Modifier
                    .size(46.dp)
                    .liquidGlass(
                        backdrop = backdrop,
                        shape = CircleShape,
                        isInteractive = true,
                        tintColor = Color(0xFFFF5C93),
                        surfaceAlpha = if (isDark) 0.46f else 0.88f,
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
