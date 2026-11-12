package com.example.lovecheck.ui.preview

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.lovecheck.theme.LoveCheckTheme
import com.example.lovecheck.ui.glass.liquidGlass
import com.example.lovecheck.ui.glass.rememberBackdrop
import com.kyant.backdrop.backdrops.layerBackdrop

@Composable
fun LoveCheckLiquidGlassShowcase(isDark: Boolean = true) {
    val backdrop = rememberBackdrop()
    val bgBrush = if (isDark) {
        Brush.verticalGradient(
            colors = listOf(
                Color(0xFF4A1040),
                Color(0xFF240046),
                Color(0xFF14001F),
            ),
        )
    } else {
        Brush.verticalGradient(
            colors = listOf(
                Color(0xFFFFEEF2),
                Color(0xFFF8E2E7),
                Color(0xFFF3D5DD),
            ),
        )
    }

    val textPrimary = if (isDark) Color(0xFFFFF0F5) else Color(0xFF1A0E13)
    val textSecondary = if (isDark) Color(0xFFE5B8CE) else Color(0xFF6B5060)
    val accent = if (isDark) Color(0xFFFF5C93) else Color(0xFFFF3B7F)
    val cardBorder = if (isDark) Color(0x55FFAACD) else Color(0xCCFFFFFF)

    LoveCheckTheme(darkTheme = isDark) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(bgBrush),
        ) {
            // Backdrop Layer with Ambient Glowing Orbs
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .layerBackdrop(backdrop),
            ) {
                Box(
                    modifier = Modifier
                        .size(210.dp)
                        .offset(x = (-40).dp, y = (-30).dp)
                        .clip(CircleShape)
                        .background(
                            Brush.radialGradient(
                                colors = listOf(
                                    Color(0x66FF85A1),
                                    Color.Transparent,
                                ),
                            ),
                        ),
                )
                Box(
                    modifier = Modifier
                        .size(240.dp)
                        .align(Alignment.CenterEnd)
                        .offset(x = 60.dp, y = (-40).dp)
                        .clip(CircleShape)
                        .background(
                            Brush.radialGradient(
                                colors = listOf(
                                    if (isDark) Color(0x4400F5D4) else Color(0x44FF5C93),
                                    Color.Transparent,
                                ),
                            ),
                        ),
                )
                Box(
                    modifier = Modifier
                        .size(260.dp)
                        .align(Alignment.BottomStart)
                        .offset(x = 20.dp, y = 40.dp)
                        .clip(CircleShape)
                        .background(
                            Brush.radialGradient(
                                colors = listOf(
                                    Color(0x55FF5C93),
                                    Color.Transparent,
                                ),
                            ),
                        ),
                )
            }

            // Foreground Content
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp, vertical = 20.dp),
                verticalArrangement = Arrangement.SpaceBetween,
            ) {
                // Top Streak Header
                Column {
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(999.dp))
                            .background(
                                Brush.horizontalGradient(
                                    listOf(accent, Color(0xFF9D4EDD)),
                                ),
                            )
                            .padding(horizontal = 14.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = "🔥 365 ngày  ·  Liquid Glass Edition",
                            color = Color.White,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = "Người ấy đã gửi cho bạn:",
                        color = textPrimary,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.ExtraBold,
                    )
                }

                // Center Check-in Polaroid Liquid Glass Card
                val cardShape = RoundedCornerShape(28.dp)
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .liquidGlass(
                            backdrop = backdrop,
                            shape = cardShape,
                            isInteractive = true,
                            tintColor = accent,
                            surfaceAlpha = if (isDark) 0.16f else 0.35f,
                            maxScale = 1.03f,
                        )
                        .border(1.dp, cardBorder, cardShape)
                        .padding(16.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(210.dp)
                            .clip(RoundedCornerShape(20.dp))
                            .background(
                                Brush.linearGradient(
                                    colors = listOf(
                                        Color(0xFFFF5C93),
                                        Color(0xFF9D4EDD),
                                        Color(0xFF240046),
                                    ),
                                ),
                            ),
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("💖", fontSize = 46.sp)
                            Spacer(Modifier.height(8.dp))
                            Text(
                                text = "Check IN Love × LoveMusic",
                                color = Color.White,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.ExtraBold,
                            )
                            Text(
                                text = "Chạm giữ để cảm nhận kính lỏng nổi khối 3D ✨",
                                color = Color(0xFFFFD9E4),
                                fontSize = 12.sp,
                            )
                        }
                    }

                    Spacer(Modifier.height(12.dp))
                    Text(
                        text = "Nhớ em nhiều lắm luôn đó 🥰 tối nay đi dạo hồ Tây nha!",
                        color = textPrimary,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Spacer(Modifier.height(10.dp))

                    // Reaction Pills Row
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        listOf("❤️ 3", "🥰 2", "✨ 1", "💬 Trả lời").forEach { label ->
                            Box(
                                modifier = Modifier
                                    .liquidGlass(
                                        backdrop = backdrop,
                                        shape = RoundedCornerShape(999.dp),
                                        isInteractive = true,
                                        tintColor = Color.White,
                                        surfaceAlpha = if (isDark) 0.12f else 0.45f,
                                        maxScale = 1.24f,
                                    )
                                    .border(1.dp, cardBorder, RoundedCornerShape(999.dp))
                                    .padding(horizontal = 12.dp, vertical = 6.dp),
                            ) {
                                Text(
                                    text = label,
                                    color = textPrimary,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                )
                            }
                        }
                    }
                }

                // Bottom Ergonomic Quick Dock + Liquid Glass Navigation Bar
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    // Quick Dock (integrated from top bar)
                    val dockShape = RoundedCornerShape(999.dp)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .liquidGlass(
                                backdrop = backdrop,
                                shape = dockShape,
                                isInteractive = true,
                                tintColor = accent,
                                surfaceAlpha = if (isDark) 0.14f else 0.38f,
                                maxScale = 1.035f,
                            )
                            .border(1.dp, cardBorder, dockShape)
                            .padding(horizontal = 10.dp, vertical = 6.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(999.dp))
                                    .background(accent)
                                    .padding(horizontal = 12.dp, vertical = 6.dp),
                            ) {
                                Text("💖 Hôm nay", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(999.dp))
                                    .border(1.dp, cardBorder, RoundedCornerShape(999.dp))
                                    .padding(horizontal = 12.dp, vertical = 6.dp),
                            ) {
                                Text("🗺️ Bản đồ hẹn hò", color = textSecondary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }

                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            listOf("☀️", "↻").forEach { icon ->
                                Box(
                                    modifier = Modifier
                                        .size(32.dp)
                                        .liquidGlass(
                                            backdrop = backdrop,
                                            shape = CircleShape,
                                            isInteractive = true,
                                            tintColor = Color.White,
                                            surfaceAlpha = 0.15f,
                                            maxScale = 1.28f,
                                        )
                                        .border(1.dp, cardBorder, CircleShape),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Text(icon, color = textPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }

                    // Bottom Navigation Bar with Sliding Frosted Blob & Center + Button
                    val navShape = RoundedCornerShape(999.dp)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(64.dp)
                            .liquidGlass(
                                backdrop = backdrop,
                                shape = navShape,
                                isInteractive = true,
                                tintColor = accent,
                                surfaceAlpha = if (isDark) 0.18f else 0.42f,
                                maxScale = 1.035f,
                            )
                            .border(1.dp, cardBorder, navShape)
                            .padding(horizontal = 8.dp),
                        horizontalArrangement = Arrangement.SpaceEvenly,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        // Active Tab with Frosted Sliding Blob
                        Box(
                            modifier = Modifier
                                .height(50.dp)
                                .clip(RoundedCornerShape(999.dp))
                                .background(
                                    Brush.linearGradient(
                                        colors = if (isDark) {
                                            listOf(Color(0x55FF5C93), Color(0x449D4EDD))
                                        } else {
                                            listOf(Color(0x99FFFFFF), Color(0x77FFD6E6))
                                        },
                                    ),
                                )
                                .border(1.dp, cardBorder, RoundedCornerShape(999.dp))
                                .padding(horizontal = 14.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text("🏠 Home", color = accent, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold)
                        }

                        Text("📸 Kỷ niệm", color = textSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)

                        // Center Check-in + Button
                        Surface(
                            modifier = Modifier.size(48.dp),
                            shape = CircleShape,
                            color = accent,
                            shadowElevation = 8.dp,
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text("+", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.ExtraBold)
                            }
                        }

                        Text("💬 Tin nhắn", color = textSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                        Text("👤 Profile", color = textSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }
}

@Preview(
    name = "LoveCheckLiquidGlassDark",
    showBackground = true,
    widthDp = 412,
    heightDp = 840,
)
@Composable
fun LoveCheckLiquidGlassDarkPreview() {
    LoveCheckLiquidGlassShowcase(isDark = true)
}

@Preview(
    name = "LoveCheckLiquidGlassLight",
    showBackground = true,
    widthDp = 412,
    heightDp = 840,
)
@Composable
fun LoveCheckLiquidGlassLightPreview() {
    LoveCheckLiquidGlassShowcase(isDark = false)
}
