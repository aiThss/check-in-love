package com.example.lovecheck.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkColorScheme = darkColorScheme(
    primary = LoveMusicPinkPrimary,
    onPrimary = Color.White,
    primaryContainer = Color(0xFF4A1040),
    onPrimaryContainer = Color(0xFFFFD9E4),
    secondary = LoveMusicPurpleSecondary,
    onSecondary = Color.White,
    tertiary = LoveMusicRoseTertiary,
    background = LoveMusicDarkBg,
    onBackground = LoveMusicTextPrimary,
    surface = LoveMusicDarkSurface,
    onSurface = LoveMusicTextPrimary,
    surfaceVariant = Color(0xFF3A1056),
    onSurfaceVariant = LoveMusicTextSecondary,
)

private val LightColorScheme = lightColorScheme(
    primary = LightAccent,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFFFE5EE),
    onPrimaryContainer = LightTextPrimary,
    secondary = LightAccentSecondary,
    onSecondary = Color.White,
    tertiary = LoveMusicRoseTertiary,
    background = LightBg,
    onBackground = LightTextPrimary,
    surface = LightSurface,
    onSurface = LightTextPrimary,
    surfaceVariant = Color(0xFFF6D2DC),
    onSurfaceVariant = LightTextSecondary,
)

@Composable
fun LoveCheckTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit,
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    MaterialTheme(colorScheme = colorScheme, typography = Typography, content = content)
}
