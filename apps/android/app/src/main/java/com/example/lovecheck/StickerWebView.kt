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

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()

        // Install the Android-only occasion-card workaround several times during
        // startup. The first callback can run before the SPA has created <head>, while
        // later callbacks make sure the guard survives a WebView navigation/reload.
        CARD_FIX_DELAYS_MS.forEach { delayMs ->
            postDelayed({ installAndroidOccasionCardFix() }, delayMs)
        }
    }

    override fun onWindowFocusChanged(hasWindowFocus: Boolean) {
        super.onWindowFocusChanged(hasWindowFocus)
        if (hasWindowFocus) {
            post { installAndroidOccasionCardFix() }
        }
    }

    private fun installAndroidOccasionCardFix() {
        evaluateJavascript(
            """
            (function () {
              if (!document || !document.documentElement) return;

              var STYLE_ID = 'lovecheck-android-occasion-card-fix-v2';
              var style = document.getElementById(STYLE_ID);
              if (!style) {
                style = document.createElement('style');
                style.id = STYLE_ID;
                style.textContent =
                  '.android-wrapper .occasion-overlay{' +
                    'overflow-x:hidden!important;overflow-y:auto!important;' +
                    'align-items:flex-start!important;' +
                    'padding-top:max(16px,var(--android-status-bar,0px))!important;' +
                    'padding-bottom:max(16px,var(--android-nav-bar,0px))!important;' +
                  '}' +
                  '.android-wrapper .occasion-shell{' +
                    'overflow:visible!important;max-height:none!important;' +
                    'animation:none!important;transform:none!important;' +
                    'flex:0 0 auto!important;' +
                  '}' +
                  '.android-wrapper .occasion-scratch{' +
                    'display:block!important;' +
                    'top:0!important;left:0!important;right:auto!important;bottom:auto!important;' +
                    'max-width:none!important;max-height:none!important;' +
                  '}';
                (document.head || document.documentElement).appendChild(style);
              }

              var normalizeCard = function (root) {
                var overlay = null;
                if (root && root.nodeType === 1 && root.matches && root.matches('.occasion-overlay')) {
                  overlay = root;
                } else if (root && root.querySelector) {
                  overlay = root.querySelector('.occasion-overlay');
                }
                if (!overlay) overlay = document.querySelector('.occasion-overlay');
                if (!overlay) return;

                var shell = overlay.querySelector('.occasion-shell');
                var paper = overlay.querySelector('.occasion-paper');
                var canvas = overlay.querySelector('.occasion-scratch');
                if (!shell || !paper || !canvas) return;

                // The broken Android WebView state visible on-device is a full-width
                // canvas collapsed into a short horizontal strip. Percentage height on
                // an absolutely positioned canvas inside an auto-height overflow
                // container is the trigger. Give the scratch surface an explicit pixel
                // box derived from the actual card instead of relying on height:100%.
                shell.style.setProperty('overflow', 'visible', 'important');
                shell.style.setProperty('max-height', 'none', 'important');
                shell.style.setProperty('animation', 'none', 'important');
                shell.style.setProperty('transform', 'none', 'important');

                var shellRect = shell.getBoundingClientRect();
                var paperRect = paper.getBoundingClientRect();
                var width = Math.max(1, Math.round(shellRect.width || paperRect.width));
                var height = Math.max(
                  540,
                  Math.round(shell.scrollHeight || 0),
                  Math.round(paper.scrollHeight || 0),
                  Math.round(shellRect.height || 0),
                  Math.round(paperRect.height || 0)
                );

                var previousWidth = canvas.getAttribute('data-android-layout-width');
                var previousHeight = canvas.getAttribute('data-android-layout-height');
                if (previousWidth !== String(width) || previousHeight !== String(height)) {
                  canvas.style.setProperty('position', 'absolute', 'important');
                  canvas.style.setProperty('top', '0px', 'important');
                  canvas.style.setProperty('left', '0px', 'important');
                  canvas.style.setProperty('right', 'auto', 'important');
                  canvas.style.setProperty('bottom', 'auto', 'important');
                  canvas.style.setProperty('width', width + 'px', 'important');
                  canvas.style.setProperty('height', height + 'px', 'important');
                  canvas.setAttribute('data-android-layout-width', String(width));
                  canvas.setAttribute('data-android-layout-height', String(height));

                  // The PWA already owns redraw logic on window resize. Dispatching a
                  // resize after fixing the CSS box makes that existing renderer redraw
                  // against the corrected dimensions without modifying PWA source.
                  requestAnimationFrame(function () {
                    try { window.dispatchEvent(new Event('resize')); } catch (_) {}
                  });
                }

                // Force layout immediately so the PWA's next requestAnimationFrame
                // retry observes the corrected rectangle.
                canvas.getBoundingClientRect();
              };

              if (!window.__loveCheckAndroidOccasionObserverV2) {
                window.__loveCheckAndroidOccasionObserverV2 = new MutationObserver(function (records) {
                  records.forEach(function (record) {
                    record.addedNodes.forEach(function (node) {
                      if (node && node.nodeType === 1) normalizeCard(node);
                    });
                  });

                  // Do not let a failed card render fill the whole screen with the same
                  // error toast. Keep the first one only; this is an APK-side safety net.
                  var matching = Array.prototype.filter.call(
                    document.querySelectorAll('.toast'),
                    function (toast) {
                      var message = toast.querySelector('.toast-message');
                      return message && message.textContent &&
                        message.textContent.trim() === 'Thiệp chưa tải xong, bạn thử lại nhé.';
                    }
                  );
                  matching.slice(1).forEach(function (toast) { toast.remove(); });
                });
                window.__loveCheckAndroidOccasionObserverV2.observe(
                  document.documentElement,
                  { childList: true, subtree: true }
                );
              }

              if (!window.__loveCheckAndroidResizeFixV2) {
                window.__loveCheckAndroidResizeFixV2 = function () { normalizeCard(document); };
                window.addEventListener('orientationchange', window.__loveCheckAndroidResizeFixV2, { passive: true });
              }

              // The card component dispatches this event after a failed initialization,
              // and its own listener immediately attempts to open the same card again.
              // On Android that turned one layout failure into an endless toast loop.
              // Swallow only this synthetic re-open signal in the wrapper; focus and
              // pageshow still perform the normal occasion-card checks later.
              if (!window.__loveCheckAndroidDispatchWrappedV2) {
                window.__loveCheckAndroidDispatchWrappedV2 = true;
                var originalDispatchEvent = window.dispatchEvent.bind(window);
                window.dispatchEvent = function (event) {
                  if (event && event.type === 'lovecheck:special-modal-closed') return true;
                  return originalDispatchEvent(event);
                };
              }

              normalizeCard(document);
            })();
            """.trimIndent(),
            null,
        )
    }

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
        private val CARD_FIX_DELAYS_MS = longArrayOf(100L, 300L, 700L, 1_500L, 3_000L)
        private const val MAX_STICKER_BYTES = 6 * 1024 * 1024
    }
}
