package com.example.lovecheck

import android.annotation.SuppressLint
import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Base64
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import android.webkit.WebView
import androidx.core.view.inputmethod.EditorInfoCompat
import androidx.core.view.inputmethod.InputConnectionCompat
import androidx.core.view.inputmethod.InputContentInfoCompat
import java.io.ByteArrayOutputStream
import org.json.JSONObject

/**
 * WebView does not advertise rich-content support by default, so Android keyboards
 * fall back to copying stickers into the clipboard. This wrapper advertises image
 * MIME types and forwards committed sticker bytes to the PWA JavaScript bridge.
 */
@SuppressLint("ViewConstructor")
class StickerWebView(context: Context) : WebView(context) {

    @Suppress("DEPRECATION")
    override fun onCreateInputConnection(outAttrs: EditorInfo): InputConnection? {
        val baseConnection = super.onCreateInputConnection(outAttrs) ?: return null
        EditorInfoCompat.setContentMimeTypes(outAttrs, SUPPORTED_MIME_TYPES)

        val listener = InputConnectionCompat.OnCommitContentListener { contentInfo, flags, _ ->
            acceptKeyboardSticker(contentInfo, flags)
        }

        return InputConnectionCompat.createWrapper(baseConnection, outAttrs, listener)
    }

    private fun acceptKeyboardSticker(
        contentInfo: InputContentInfoCompat,
        flags: Int,
    ): Boolean {
        val mimeType = contentInfo.description
            .filterMimeTypes("image/*")
            .firstOrNull()
            ?: return false

        val hasTemporaryPermission =
            flags and InputConnectionCompat.INPUT_CONTENT_GRANT_READ_URI_PERMISSION != 0

        if (hasTemporaryPermission) {
            try {
                contentInfo.requestPermission()
            } catch (_: Exception) {
                return false
            }
        }

        val uri = contentInfo.contentUri
        Thread {
            try {
                val bytes = context.contentResolver.openInputStream(uri)?.use(::readLimited)
                if (bytes == null || bytes.isEmpty()) {
                    emitStickerError("Không đọc được sticker từ bàn phím")
                    return@Thread
                }

                val payload = JSONObject()
                    .put("base64", Base64.encodeToString(bytes, Base64.NO_WRAP))
                    .put("mimeType", mimeType)
                    .put("fileName", resolveFileName(uri, mimeType))

                emitSticker(payload)
            } catch (_: Exception) {
                emitStickerError("Không đọc được sticker từ bàn phím")
            } finally {
                if (hasTemporaryPermission) {
                    try {
                        contentInfo.releasePermission()
                    } catch (_: Exception) {
                        // Permission may already have been released by the keyboard.
                    }
                }
            }
        }.start()

        return true
    }

    private fun readLimited(input: java.io.InputStream): ByteArray? {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
        var total = 0

        while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            total += count
            if (total > MAX_STICKER_BYTES) return null
            output.write(buffer, 0, count)
        }

        return output.toByteArray()
    }

    private fun resolveFileName(uri: Uri, mimeType: String): String {
        try {
            context.contentResolver.query(
                uri,
                arrayOf(OpenableColumns.DISPLAY_NAME),
                null,
                null,
                null,
            )?.use { cursor ->
                val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (index >= 0 && cursor.moveToFirst()) {
                    val value = cursor.getString(index)
                    if (!value.isNullOrBlank()) return value
                }
            }
        } catch (_: Exception) {
            // Some keyboard providers do not expose metadata; use a safe fallback.
        }

        return "keyboard-sticker-${System.currentTimeMillis()}.${extensionForMime(mimeType)}"
    }

    private fun extensionForMime(value: String): String {
        return when {
            value.contains("webp", ignoreCase = true) -> "webp"
            value.contains("gif", ignoreCase = true) -> "gif"
            value.contains("jpeg", ignoreCase = true) || value.contains("jpg", ignoreCase = true) -> "jpg"
            else -> "png"
        }
    }

    private fun emitSticker(payload: JSONObject) {
        val script = """
            (function(payload) {
              if (typeof window.onNativeStickerReceived === 'function') {
                window.onNativeStickerReceived(payload);
              } else {
                window.__pendingNativeStickers = window.__pendingNativeStickers || [];
                window.__pendingNativeStickers.push(payload);
              }
            })(${payload});
        """.trimIndent()

        post { evaluateJavascript(script, null) }
    }

    private fun emitStickerError(message: String) {
        val quoted = JSONObject.quote(message)
        val script = """
            if (typeof window.onNativeStickerError === 'function') {
              window.onNativeStickerError($quoted);
            }
        """.trimIndent()

        post { evaluateJavascript(script, null) }
    }

    companion object {
        private val SUPPORTED_MIME_TYPES = arrayOf(
            "image/png",
            "image/webp",
            "image/gif",
            "image/jpeg",
            "image/*",
        )
        private const val MAX_STICKER_BYTES = 6 * 1024 * 1024
    }
}
