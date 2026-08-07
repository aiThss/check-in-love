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
 *
 * It also installs Android-only layout guards for the two canvas-based scratch UIs.
 * Chromium WebView on some devices intermittently resolves their percentage/aspect
 * ratio heights as a tiny horizontal strip even though normal Chrome/PWA is fine.
 */
@SuppressLint("ViewConstructor")
class StickerWebView(context: Context) : WebView(context) {

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()

        // A SPA navigation can replace the JavaScript world. Install the Android-only
        // guards repeatedly during startup so the final document always receives them.
        WEB_FIX_DELAYS_MS.forEach { delayMs ->
            postDelayed({ installAndroidWebViewFixes() }, delayMs)
        }
    }

    override fun onWindowFocusChanged(hasWindowFocus: Boolean) {
        super.onWindowFocusChanged(hasWindowFocus)
        if (hasWindowFocus) {
            post { installAndroidWebViewFixes() }
        }
    }

    private fun installAndroidWebViewFixes() {
        evaluateJavascript(
            """
            (function () {
              if (!document || !document.documentElement || typeof Node === 'undefined') return;

              var STYLE_ID = 'lovecheck-android-canvas-layout-fix-v4';
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
                  '}' +
                  '.android-wrapper .polaroid-modal-backdrop{' +
                    'box-sizing:border-box!important;overflow:hidden!important;' +
                    'align-items:center!important;justify-content:center!important;' +
                  '}' +
                  '.android-wrapper .polaroid-modal-container{' +
                    'box-sizing:border-box!important;' +
                    'animation:none!important;transform:none!important;' +
                  '}' +
                  '.android-wrapper .polaroid-stage-view{' +
                    'box-sizing:border-box!important;aspect-ratio:auto!important;' +
                    'flex:none!important;min-height:1px!important;' +
                    'animation:none!important;transform:none!important;' +
                  '}' +
                  '.android-wrapper .polaroid-stage-photo,' +
                  '.android-wrapper .polaroid-stage-canvas{' +
                    'box-sizing:border-box!important;display:block!important;' +
                    'top:0!important;left:0!important;right:auto!important;bottom:auto!important;' +
                    'max-width:none!important;max-height:none!important;' +
                  '}';
                (document.head || document.documentElement).appendChild(style);
              }

              var px = function (value) {
                var parsed = parseFloat(value || '0');
                return Number.isFinite(parsed) ? parsed : 0;
              };

              var readCssPx = function (name) {
                try {
                  return Math.max(
                    0,
                    px(getComputedStyle(document.documentElement).getPropertyValue(name))
                  );
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

              var findFromRoot = function (root, selector) {
                if (root && root.nodeType === 1 && root.matches && root.matches(selector)) return root;
                if (root && root.querySelector) {
                  var nested = root.querySelector(selector);
                  if (nested) return nested;
                }
                return document.querySelector(selector);
              };

              // Occasion-card guard. This fixes the separate anniversary/birthday card
              // without touching its PWA source.
              var normalizeOccasionCard = function (root) {
                var overlay = findFromRoot(root, '.occasion-overlay');
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

                var shellRect = shell.getBoundingClientRect();
                var paperRect = paper.getBoundingClientRect();
                var width = Math.max(1, Math.round(shellRect.width || paperRect.width || 1));
                var height = Math.max(1, Math.round(shellRect.height || paperRect.height || 1));

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

                canvas.getBoundingClientRect();

                if (!shell.__loveCheckAndroidCardResizeV4 && typeof ResizeObserver !== 'undefined') {
                  var observer = new ResizeObserver(function () {
                    if (!overlay.isConnected) {
                      observer.disconnect();
                      return;
                    }
                    normalizeOccasionCard(overlay);
                  });
                  observer.observe(shell);
                  observer.observe(paper);
                  shell.__loveCheckAndroidCardResizeV4 = observer;
                }
              };

              // Daily-photo Love Foil guard. This is intentionally separate from the
              // occasion-card fix: the broken horizontal strip in Android is the HUD +
              // canvas of .polaroid-stage-view, whose CSS height comes only from
              // aspect-ratio. Some WebViews collapse that flex item's aspect-ratio.
              var normalizePolaroid = function (root) {
                var backdrop = findFromRoot(root, '.polaroid-modal-backdrop');
                if (!backdrop || !backdrop.isConnected) return;

                var modal = backdrop.querySelector('.polaroid-modal-container');
                var stage = backdrop.querySelector('.polaroid-stage-view');
                var canvas = backdrop.querySelector('.polaroid-stage-canvas');
                var photo = backdrop.querySelector('.polaroid-stage-photo');
                var footer = backdrop.querySelector('.polaroid-love-foil-footer');
                if (!modal || !stage || !canvas || !photo) return;

                var viewportWidth = Math.max(
                  1,
                  Math.round(window.innerWidth || document.documentElement.clientWidth || 1)
                );
                var viewportHeight = Math.max(
                  1,
                  Math.round(window.innerHeight || document.documentElement.clientHeight || 1)
                );
                var statusBar = readCssPx('--android-status-bar');
                var navBar = readCssPx('--android-nav-bar');
                var topPadding = Math.max(18, Math.round(statusBar + 10));
                var bottomPadding = Math.max(18, Math.round(navBar + 10));
                var sidePadding = 14;
                var usableHeight = Math.max(180, viewportHeight - topPadding - bottomPadding);
                var modalWidth = Math.max(180, Math.min(420, viewportWidth - sidePadding * 2));

                backdrop.style.setProperty('position', 'fixed', 'important');
                backdrop.style.setProperty('inset', '0px', 'important');
                backdrop.style.setProperty('box-sizing', 'border-box', 'important');
                backdrop.style.setProperty('padding-top', topPadding + 'px', 'important');
                backdrop.style.setProperty('padding-bottom', bottomPadding + 'px', 'important');
                backdrop.style.setProperty('padding-left', sidePadding + 'px', 'important');
                backdrop.style.setProperty('padding-right', sidePadding + 'px', 'important');
                backdrop.style.setProperty('overflow', 'hidden', 'important');
                backdrop.style.setProperty('align-items', 'center', 'important');
                backdrop.style.setProperty('justify-content', 'center', 'important');

                modal.style.setProperty('width', modalWidth + 'px', 'important');
                modal.style.setProperty('max-width', modalWidth + 'px', 'important');
                modal.style.setProperty('max-height', usableHeight + 'px', 'important');
                modal.style.setProperty('box-sizing', 'border-box', 'important');
                modal.style.setProperty('animation', 'none', 'important');
                modal.style.setProperty('transform', 'none', 'important');

                // Read the actual content box after fixing modal width. The footer is
                // included so a short/landscape viewport still gets a square stage that
                // fits without being clipped.
                var modalStyle = getComputedStyle(modal);
                var horizontalPadding = px(modalStyle.paddingLeft) + px(modalStyle.paddingRight);
                var verticalPadding = px(modalStyle.paddingTop) + px(modalStyle.paddingBottom);
                var gap = px(modalStyle.rowGap || modalStyle.gap) || 10;
                var contentWidth = Math.max(1, Math.floor(modal.clientWidth - horizontalPadding));
                var footerHeight = footer ? Math.max(0, Math.round(footer.offsetHeight)) : 0;
                if (footerHeight < 1) footerHeight = 68;
                var maxStageFromHeight = Math.max(
                  1,
                  Math.floor(usableHeight - verticalPadding - gap - footerHeight - 2)
                );
                var stageSize = Math.max(1, Math.min(contentWidth, maxStageFromHeight));

                // Never trust aspect-ratio for this WebView. Give the stage, image and
                // canvas the same explicit square CSS box before the PWA's rAF resize()
                // reads stage.offsetWidth/offsetHeight.
                stage.style.setProperty('aspect-ratio', 'auto', 'important');
                stage.style.setProperty('flex', 'none', 'important');
                stage.style.setProperty('align-self', 'center', 'important');
                stage.style.setProperty('width', stageSize + 'px', 'important');
                stage.style.setProperty('height', stageSize + 'px', 'important');
                stage.style.setProperty('min-width', stageSize + 'px', 'important');
                stage.style.setProperty('min-height', stageSize + 'px', 'important');
                stage.style.setProperty('max-width', stageSize + 'px', 'important');
                stage.style.setProperty('max-height', stageSize + 'px', 'important');
                stage.style.setProperty('animation', 'none', 'important');
                stage.style.setProperty('transform', 'none', 'important');

                [photo, canvas].forEach(function (element) {
                  element.style.setProperty('position', 'absolute', 'important');
                  element.style.setProperty('top', '0px', 'important');
                  element.style.setProperty('left', '0px', 'important');
                  element.style.setProperty('right', 'auto', 'important');
                  element.style.setProperty('bottom', 'auto', 'important');
                  element.style.setProperty('width', stageSize + 'px', 'important');
                  element.style.setProperty('height', stageSize + 'px', 'important');
                  element.style.setProperty('max-width', 'none', 'important');
                  element.style.setProperty('max-height', 'none', 'important');
                });

                stage.setAttribute('data-android-stage-size', String(stageSize));
                stage.getBoundingClientRect();
                canvas.getBoundingClientRect();

                // The PWA has its own ResizeObserver on the stage. Changing the explicit
                // box above wakes that observer so it redraws the foil at the corrected
                // dimensions; no global resize event or PWA modification is required.
                if (!backdrop.__loveCheckAndroidPolaroidSettlesV4) {
                  backdrop.__loveCheckAndroidPolaroidSettlesV4 = true;
                  [0, 50, 160].forEach(function (delay) {
                    setTimeout(function () {
                      if (backdrop.isConnected) normalizePolaroid(backdrop);
                    }, delay);
                  });
                }
              };

              if (!window.__loveCheckAndroidCanvasObserverV4) {
                window.__loveCheckAndroidCanvasObserverV4 = new MutationObserver(function (records) {
                  records.forEach(function (record) {
                    record.addedNodes.forEach(function (node) {
                      if (!node || node.nodeType !== 1) return;
                      normalizeOccasionCard(node);
                      normalizePolaroid(node);
                    });
                  });
                  pruneDuplicateCardToasts();
                });
                window.__loveCheckAndroidCanvasObserverV4.observe(
                  document.documentElement,
                  { childList: true, subtree: true }
                );
              }

              // Both modals are appended directly to body. Hook appendChild so layout is
              // normalized synchronously before either renderer can measure its canvas.
              if (!window.__loveCheckAndroidAppendChildV4) {
                var nativeAppendChild = Node.prototype.appendChild;
                window.__loveCheckAndroidAppendChildV4 = nativeAppendChild;
                Node.prototype.appendChild = function (child) {
                  var result = nativeAppendChild.call(this, child);
                  try {
                    if (child && child.nodeType === 1) {
                      normalizeOccasionCard(child);
                      normalizePolaroid(child);
                    }
                  } catch (_) {
                    // The guard must never interfere with normal DOM insertion.
                  }
                  return result;
                };
              }

              if (!window.__loveCheckAndroidViewportFixV4) {
                window.__loveCheckAndroidViewportFixV4 = function () {
                  normalizeOccasionCard(document);
                  normalizePolaroid(document);
                };
                window.addEventListener('resize', window.__loveCheckAndroidViewportFixV4, { passive: true });
                window.addEventListener('orientationchange', window.__loveCheckAndroidViewportFixV4, { passive: true });
              }

              normalizeOccasionCard(document);
              normalizePolaroid(document);
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
        private val WEB_FIX_DELAYS_MS = longArrayOf(0L, 50L, 150L, 500L, 1_500L, 3_000L)
        private const val MAX_STICKER_BYTES = 6 * 1024 * 1024
    }
}
