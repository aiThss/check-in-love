import { apiFetch } from '../api/client';
import { mapChatMessage, type RawMessage } from '../api/messages';
import { invalidateQueries } from '../api/query-cache';
import { showToast } from '../components/toast';
import { invalidateRoutes } from '../route-invalidation';

const DUPLICATE_WINDOW_MS = 900;

interface StickerUploadResponse {
  message: RawMessage;
}

interface ClipboardItemLike {
  types: readonly string[];
  getType(type: string): Promise<Blob>;
}

interface NativeStickerPayload {
  base64: string;
  mimeType?: string;
  fileName?: string;
}

declare global {
  interface Window {
    onNativeStickerReceived?: (payload: NativeStickerPayload) => void;
    onNativeStickerError?: (message: string) => void;
    __pendingNativeStickers?: NativeStickerPayload[];
  }
}

let initialized = false;
let sendingSticker = false;
let lastMediaSignature = '';
let lastMediaAcceptedAt = 0;

function getActiveMessagesPage(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.route-page.is-active .messages-page')
    ?? document.querySelector<HTMLElement>('.messages-page');
}

function getActiveMessageInput(): HTMLInputElement | HTMLTextAreaElement | null {
  const page = getActiveMessagesPage();
  return page?.querySelector<HTMLInputElement | HTMLTextAreaElement>('#message-input') ?? null;
}

function isInsideActiveChat(target: EventTarget | null): boolean {
  const page = getActiveMessagesPage();
  if (!page) return false;
  if (!(target instanceof Node)) return true;
  if (target === document || target === document.body || target === document.documentElement) {
    return !document.querySelector('.modal-overlay, .c-dialog-wrap, .c-sheet.is-open, .journey-modal-backdrop');
  }
  return page.contains(target);
}

function extensionFromMime(mime: string): string {
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  return 'png';
}

function normalizeImageFile(file: File | Blob, preferredName?: string): File {
  const type = file.type && file.type.startsWith('image/') ? file.type : 'image/png';
  const ext = extensionFromMime(type);
  const rawName = preferredName?.trim() || (file instanceof File ? file.name : '');
  const finalName = rawName || `pasted-image-${Date.now()}.${ext}`;
  return new File([file], finalName, { type, lastModified: Date.now() });
}

function dataUrlToFile(dataUrl: string): File | null {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  try {
    const binary = window.atob(match[2].replace(/\s+/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return normalizeImageFile(new Blob([bytes], { type: mime }), `clipboard-${Date.now()}.${extensionFromMime(mime)}`);
  } catch {
    return null;
  }
}

export function extractImageFromDataTransfer(data: DataTransfer | null | undefined): File | null {
  if (!data) return null;

  for (const file of Array.from(data.files ?? [])) {
    if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(file.name)) {
      return normalizeImageFile(file, file.name);
    }
  }

  for (const item of Array.from(data.items ?? [])) {
    if (item.kind !== 'file') continue;
    if (item.type && !item.type.startsWith('image/')) continue;
    const file = item.getAsFile();
    if (file) return normalizeImageFile(file, file.name);
  }

  try {
    const html = data.getData('text/html');
    if (html) {
      const srcMatch = html.match(/<img[^>]+src=["'](data:image\/[^"']+)["']/i);
      if (srcMatch?.[1]) {
        const parsed = dataUrlToFile(srcMatch[1]);
        if (parsed) return parsed;
      }
    }
  } catch {
    // Accessing getData can throw in synthetic test events.
  }

  return null;
}

async function imageFromClipboardApi(): Promise<File | null> {
  const clipboard = navigator.clipboard as Clipboard & {
    read?: () => Promise<ClipboardItemLike[]>;
  };
  if (!clipboard?.read || !window.isSecureContext) return null;

  try {
    const items = await clipboard.read();
    for (const item of items) {
      const imageType = item.types.find((type) => type.startsWith('image/'));
      if (!imageType) continue;
      return normalizeImageFile(await item.getType(imageType));
    }
  } catch {
    // Ignore clipboard permission denials.
  }

  return null;
}

function fileFromNativePayload(payload: NativeStickerPayload): File | null {
  const mimeType = payload.mimeType?.startsWith('image/')
    ? payload.mimeType
    : 'image/png';

  try {
    const binary = window.atob(payload.base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    const fallbackName = `keyboard-media-${Date.now()}.${extensionFromMime(mimeType)}`;
    return new File(
      [bytes],
      payload.fileName?.trim() || fallbackName,
      { type: mimeType, lastModified: Date.now() },
    );
  } catch {
    return null;
  }
}

function isDuplicateMedia(file: File): boolean {
  const signature = `${file.type}:${file.size}:${file.name}`;
  const now = Date.now();
  const duplicate = signature === lastMediaSignature && now - lastMediaAcceptedAt < DUPLICATE_WINDOW_MS;
  lastMediaSignature = signature;
  lastMediaAcceptedAt = now;
  return duplicate;
}

async function classifyAsKeyboardSticker(file: File, fromNativeIme: boolean): Promise<boolean> {
  const lowerName = file.name.toLowerCase();
  const mime = file.type.toLowerCase();

  if (lowerName.includes('screenshot') || lowerName.includes('snip') || lowerName.startsWith('img_')) {
    return false;
  }
  if (mime.includes('gif') || mime.includes('webp')) {
    return true;
  }
  if (mime.includes('jpeg') || mime.includes('jpg') || mime.includes('heic') || mime.includes('heif')) {
    return false;
  }
  if (lowerName.includes('sticker') || lowerName.includes('bitmoji') || lowerName.includes('emoji')) {
    return true;
  }

  // For PNGs: check dimensions + corner transparency so Snipping Tool / phone screenshots
  // attach as photos while small transparent keyboard stickers send as stickers.
  if (typeof document !== 'undefined' && typeof Image !== 'undefined' && typeof URL?.createObjectURL === 'function') {
    const objectUrl = URL.createObjectURL(file);
    try {
      const isTransparentSmallSticker = await new Promise<boolean>((resolve) => {
        const img = new Image();
        const timer = window.setTimeout(() => resolve(false), 350);
        img.onload = () => {
          window.clearTimeout(timer);
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          if (!w || !h || Math.max(w, h) > 560) {
            resolve(false);
            return;
          }
          try {
            const sampleSize = Math.min(64, w, h);
            const canvas = document.createElement('canvas');
            canvas.width = sampleSize;
            canvas.height = sampleSize;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(fromNativeIme && file.size < 260_000);
              return;
            }
            ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
            const data = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
            let transparentPixels = 0;
            for (let i = 3; i < data.length; i += 16) {
              if (data[i] < 245) transparentPixels += 1;
            }
            resolve(transparentPixels >= 3);
          } catch {
            resolve(fromNativeIme && file.size < 260_000);
          }
        };
        img.onerror = () => {
          window.clearTimeout(timer);
          resolve(false);
        };
        img.src = objectUrl;
      });
      return isTransparentSmallSticker;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  return fromNativeIme && file.size < 260_000;
}

function emitPastedPhotoToChat(file: File): void {
  window.dispatchEvent(new CustomEvent('lovecheck:chat-paste-photo', { detail: { file } }));
}

async function sendSticker(file: File): Promise<void> {
  if (sendingSticker) return;

  const page = getActiveMessagesPage();
  const form = page?.querySelector<HTMLFormElement>('.messages-composer');
  if (!form) return;

  sendingSticker = true;
  form.classList.add('is-sending-sticker');

  const clientMutationId = `sticker:${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
  const payload = new FormData();
  payload.append('file', file, file.name);
  payload.append('clientMutationId', clientMutationId);

  try {
    const response = await apiFetch<StickerUploadResponse>('/messages/sticker', {
      method: 'POST',
      body: payload,
    });

    invalidateQueries('messages:list:');
    invalidateRoutes('/app/messages');

    const created = mapChatMessage(response.message);
    window.dispatchEvent(new CustomEvent('lovecheck:sticker-created', { detail: { message: created } }));
  } catch {
    showToast('Không gửi được sticker, thử lại nhé', 'error');
  } finally {
    sendingSticker = false;
    form.classList.remove('is-sending-sticker');
  }
}

async function handleIncomingClipboardImage(file: File, fromNativeIme: boolean): Promise<void> {
  if (isDuplicateMedia(file)) return;
  const isSticker = await classifyAsKeyboardSticker(file, fromNativeIme);
  if (isSticker) {
    await sendSticker(file);
  } else {
    emitPastedPhotoToChat(file);
  }
}

function receiveNativeSticker(payload: NativeStickerPayload): void {
  if (!getActiveMessagesPage()) {
    showToast('Mở Tin nhắn rồi chọn lại ảnh/sticker nhé', 'info');
    return;
  }

  const file = fileFromNativePayload(payload);
  if (!file) {
    showToast('Không đọc được ảnh từ bàn phím', 'error');
    return;
  }

  void handleIncomingClipboardImage(file, true);
}

function installNativeStickerBridge(): void {
  window.onNativeStickerReceived = receiveNativeSticker;
  window.onNativeStickerError = (message: string) => {
    showToast(message || 'Không đọc được nội dung từ bàn phím', 'error');
  };

  const pending = window.__pendingNativeStickers?.splice(0) ?? [];
  pending.forEach(receiveNativeSticker);
}

function onPaste(event: ClipboardEvent): void {
  if (!isInsideActiveChat(event.target)) return;
  const image = extractImageFromDataTransfer(event.clipboardData);
  if (!image) return;

  event.preventDefault();
  event.stopPropagation();
  void handleIncomingClipboardImage(image, false);
}

function onBeforeInput(event: InputEvent): void {
  if (!isInsideActiveChat(event.target)) return;
  if (event.inputType !== 'insertFromPaste' && event.inputType !== 'insertReplacementText') return;

  const richInput = event as InputEvent & { dataTransfer?: DataTransfer | null };
  const image = extractImageFromDataTransfer(richInput.dataTransfer);
  if (!image) return;

  event.preventDefault();
  void handleIncomingClipboardImage(image, false);
}

function onInput(event: Event): void {
  const input = getActiveMessageInput();
  if (!input || event.target !== input) return;

  if (!input.value.includes('\uFFFC')) return;
  input.value = input.value.replace(/\uFFFC/g, '');

  void imageFromClipboardApi().then((image) => {
    if (image) void handleIncomingClipboardImage(image, true);
  });
}

export function initMessageStickerInput(): void {
  if (initialized) return;
  initialized = true;

  installNativeStickerBridge();
  document.addEventListener('paste', onPaste, true);
  document.addEventListener('beforeinput', onBeforeInput, true);
  document.addEventListener('input', onInput, true);
}
