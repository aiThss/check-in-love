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

        // Install the Android-only occasion-card workaround repeatedly while the SPA
        // boots. A WebView navigation replaces the JS world, so later passes make sure
        // the hook exists in the final document before the automatic card can open.
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
              if (!document || !document.documentElement || typeof Node === 'undefined') return;

              var STYLE_ID = 'lovecheck-android-occasion-card-fix-v3';
              var style = document.getElementById(STYLE_ID);
              if (!style) {
                style = document.createElement('style');
                style.id = STYLE_ID;
                style.textContent =
                  '.android-wrapper .occasion-overlay{' +
                    'box-sizing:border-box!important;' +
                    'width:auto!important;height:auto!important;min-height:0!important;' +
                    'overflow:hidden!important;' +
                    'align-items:center!important;justify-content:center!important;' +
                  '}' +
                  '.android-wrapper .occasion-shell{' +
                    'box-sizing:border-box!important;' +
                    'overflow:auto!important;' +
                    'animation:none!important;transform:none!important;' +
                    'flex:0 1 auto!important;' +
                  '}' +
                  '.android-wrapper .occasion-scratch{' +
                    'display:block!important;position:absolute!important;' +
                    'top:0!important;left:0!important;right:auto!important;bottom:auto!important;' +
                    'max-width:none!important;max-height:none!important;' +
                    'box-sizing:border-box!important;' +
                  '}';
                (document.head || document.documentElement).appendChild(style);
              }

              var readCssPx = function (name) {
                try {
                  var value = getComputedStyle(document.documentElement).getPropertyValue(name);
                  var parsed = parseFloat(value || '0');
                  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
                } catch (_) {
                  return 0;
                }
              };

              var pruneDuplicateCardToasts = function () {
                var matching = Array.prototype.filter.call(
                  document.querySelectorAll('.toast'),
                  function (toast) {
                    var message = toast.querySelector('.toast-message');
                    return message && message.textContent &&
                      message.textContent.trim() === 'Thiệp chưa tải xong, bạn thử lại nhé.';
                  }
                );
                matching.slice(1).forEach(function (toast) { toast.remove(); });
              };

              var normalizeCard = function (root) {
                var overlay = null;
                if (root && root.nodeType === 1 && root.matches && root.matches('.occasion-overlay')) {
                  overlay = root;
                } else if (root && root.querySelector) {
                  overlay = root.querySelector('.occasion-overlay');
                }
                if (!overlay) overlay = document.querySelector('.occasion-overlay');
                if (!overlay || !overlay.isConnected) return;

                var shell = overlay.querySelector('.occasion-shell');
                var paper = overlay.querySelector('.occasion-paper');
                var canvas = overlay.querySelector('.occasion-scratch');
                if (!shell || !paper || !canvas) return;

                var statusBar = readCssPx('--android-status-bar');
                var navBar = readCssPx('--android-nav-bar');
                var viewportHeight = Math.max(
                  1,
                  Math.round(window.innerHeight || document.documentElement.clientHeight || 1)
                );
                var topPadding = Math.max(16, Math.round(statusBar + 8));
                var bottomPadding = Math.max(16, Math.round(navBar + 8));
                var availableHeight = Math.max(240, viewportHeight - topPadding - bottomPadding);

                // MainActivity used to inject 100dvh/min-height rules. Inline !important
                // values here deliberately win over that older guard so the modal stays
                // inside the real WebView viewport and below the status bar.
                overlay.style.setProperty('position', 'fixed', 'important');
                overlay.style.setProperty('inset', '0px', 'important');
                overlay.style.setProperty('width', 'auto', 'important');
                overlay.style.setProperty('height', 'auto', 'important');
                overlay.style.setProperty('min-height', '0px', 'important');
                overlay.style.setProperty('box-sizing', 'border-box', 'important');
                overlay.style.setProperty('padding-top', topPadding + 'px', 'important');
                overlay.style.setProperty('padding-bottom', bottomPadding + 'px', 'important');
                overlay.style.setProperty('padding-left', '16px', 'important');
                overlay.style.setProperty('padding-right', '16px', 'important');
                overlay.style.setProperty('overflow', 'hidden', 'important');
                overlay.style.setProperty('align-items', 'center', 'important');
                overlay.style.setProperty('justify-content', 'center', 'important');

                shell.style.setProperty('position', 'relative', 'important');
                shell.style.setProperty('max-height', availableHeight + 'px', 'important');
                shell.style.setProperty('overflow', 'auto', 'important');
                shell.style.setProperty('animation', 'none', 'important');
                shell.style.setProperty('transform', 'none', 'important');

                // Force layout only after the modal has the Android-safe box above.
                var shellRect = shell.getBoundingClientRect();
                var paperRect = paper.getBoundingClientRect();
                var width = Math.max(1, Math.round(shellRect.width || paperRect.width || 1));
                var height = Math.max(1, Math.round(shellRect.height || paperRect.height || 1));

                // If this WebView briefly reports an empty auto-height shell, the paper
                // already has a 540px minimum height. Use that actual paper box once,
                // but never force the shell taller than the safe viewport.
                if (height < 2 && paperRect.height >= 2) {
                  height = Math.min(availableHeight, Math.round(paperRect.height));
                  shell.style.setProperty('height', height + 'px', 'important');
                  shellRect = shell.getBoundingClientRect();
                  width = Math.max(1, Math.round(shellRect.width || paperRect.width || 1));
                  height = Math.max(1, Math.round(shellRect.height || height));
                }

                var widthText = String(width);
                var heightText = String(height);
                if (
                  canvas.getAttribute('data-android-layout-width') !== widthText ||
                  canvas.getAttribute('data-android-layout-height') !== heightText
                ) {
                  // This is the core fix. Android WebView intermittently resolves the
                  // PWA's absolute canvas height:100% as a tiny strip. Give the canvas
                  // the exact rendered shell box in CSS pixels before drawScratchCover
                  // calls getBoundingClientRect().
                  canvas.style.setProperty('position', 'absolute', 'important');
                  canvas.style.setProperty('top', '0px', 'important');
                  canvas.style.setProperty('left', '0px', 'important');
                  canvas.style.setProperty('right', 'auto', 'important');
                  canvas.style.setProperty('bottom', 'auto', 'important');
                  canvas.style.setProperty('width', width + 'px', 'important');
                  canvas.style.setProperty('height', height + 'px', 'important');
                  canvas.setAttribute('data-android-layout-width', widthText);
                  canvas.setAttribute('data-android-layout-height', heightText);
                }

                // Materialize the corrected rectangle synchronously. openCard() calls
                // initializeScratch() immediately after appendChild returns, so this
                // must happen in the same JS turn rather than in a MutationObserver.
                canvas.getBoundingClientRect();

                if (!shell.__loveCheckAndroidCardResizeV3 && typeof ResizeObserver !== 'undefined') {
                  var resizeObserver = new ResizeObserver(function () {
                    if (!overlay.isConnected) {
                      resizeObserver.disconnect();
                      return;
                    }
                    normalizeCard(overlay);
                  });
                  resizeObserver.observe(shell);
                  resizeObserver.observe(paper);
                  shell.__loveCheckAndroidCardResizeV3 = resizeObserver;
                }

                // Fonts and the 100-day cover image can settle after the first layout.
                // Re-measure a few times, without touching PWA source or forcing a
                // global resize event that could recursively redraw the canvas.
                if (!overlay.__loveCheckAndroidSettlesV3) {
                  overlay.__loveCheckAndroidSettlesV3 = true;
                  [0, 80, 240].forEach(function (delay) {
                    setTimeout(function () {
                      if (overlay.isConnected) normalizeCard(overlay);
                    }, delay);
                  });
                }
              };

              // MutationObserver is retained as a fallback and for toast cleanup, but
              // it is too late for the first canvas measurement by itself.
              if (!window.__loveCheckAndroidOccasionObserverV3) {
                window.__loveCheckAndroidOccasionObserverV3 = new MutationObserver(function (records) {
                  records.forEach(function (record) {
                    record.addedNodes.forEach(function (node) {
                      if (node && node.nodeType === 1) normalizeCard(node);
                    });
                  });
                  pruneDuplicateCardToasts();
                });
                window.__loveCheckAndroidOccasionObserverV3.observe(
                  document.documentElement,
                  { childList: true, subtree: true }
                );
              }

              // Intercept appendChild once. The PWA appends .occasion-overlay directly
              // to document.body and then initializes its canvas in the same call stack.
              // Normalizing immediately after the native append, before appendChild
              // returns, guarantees the canvas has a real width/height on that first draw.
              if (!window.__loveCheckAndroidAppendChildV3) {
                var nativeAppendChild = Node.prototype.appendChild;
                window.__loveCheckAndroidAppendChildV3 = nativeAppendChild;
                Node.prototype.appendChild = function (child) {
                  var result = nativeAppendChild.call(this, child);
                  try {
                    if (child && child.nodeType === 1) {
                      var isOverlay = child.matches && child.matches('.occasion-overlay');
                      var containsOverlay = child.querySelector && child.querySelector('.occasion-overlay');
                      if (isOverlay || containsOverlay) normalizeCard(child);
                    }
                  } catch (_) {
                    // Never interfere with normal DOM insertion if the guard itself fails.
                  }
                  return result;
                };
              }

              if (!window.__loveCheckAndroidViewportFixV3) {
                window.__loveCheckAndroidViewportFixV3 = function () { normalizeCard(document); };
                window.addEventListener('resize', window.__loveCheckAndroidViewportFixV3, { passive: true });
                window.addEventListener('orientationchange', window.__loveCheckAndroidViewportFixV3, { passive: true });
              }

              normalizeCard(document);
              pruneDuplicateCardToasts();
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
        private val CARD_FIX_DELAYS_MS = longArrayOf(0L, 50L, 150L, 500L, 1_500L, 3_000L)
        private const val MAX_STICKER_BYTES = 6 * 1024 * 1024
    }
}
