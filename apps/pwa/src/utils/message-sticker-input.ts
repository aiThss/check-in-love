import { apiFetch } from '../api/client';
import { getMessages } from '../api/messages';
import { invalidateQueries } from '../api/query-cache';
import { showToast } from '../components/toast';
import { invalidateRoutes } from '../route-invalidation';
import { navigate } from '../router';

const STICKER_URL_MARKER = 'lc-media=sticker';
const MESSAGE_DRAFT_KEY = 'lovecheck_message_draft_after_sticker';
const DUPLICATE_WINDOW_MS = 1_200;

interface StickerUploadResponse {
  message: {
    _id?: string;
    id?: string;
    imageUrl?: string;
  };
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
let lastStickerSignature = '';
let lastStickerAcceptedAt = 0;
let styleFrame: number | null = null;

function isMessageInput(target: EventTarget | null): target is (HTMLInputElement | HTMLTextAreaElement) {
  return (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
    && Boolean(target.closest('.messages-page .messages-input-wrap'));
}

function getActiveMessageInput(): HTMLInputElement | HTMLTextAreaElement | null {
  return document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    '.route-page.is-active .messages-page #message-input',
  ) ?? document.querySelector<HTMLInputElement | HTMLTextAreaElement>('.messages-page #message-input');
}

function extensionFromMime(mime: string): string {
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  return 'png';
}

function normalizeStickerFile(file: File | Blob): File {
  const type = file.type.startsWith('image/') ? file.type : 'image/png';
  const extension = extensionFromMime(type);
  return new File(
    [file],
    `keyboard-sticker-${Date.now()}.${extension}`,
    { type, lastModified: Date.now() },
  );
}

function imageFromDataTransfer(data: DataTransfer | null | undefined): File | null {
  if (!data) return null;

  for (const file of Array.from(data.files ?? [])) {
    if (file.type.startsWith('image/')) return normalizeStickerFile(file);
  }

  for (const item of Array.from(data.items ?? [])) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue;
    const file = item.getAsFile();
    if (file) return normalizeStickerFile(file);
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
      return normalizeStickerFile(await item.getType(imageType));
    }
  } catch {
    // Clipboard read can be denied by the browser. The native input connection and
    // normal paste payload remain available without an extra permission prompt.
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

    const fallbackName = `keyboard-sticker-${Date.now()}.${extensionFromMime(mimeType)}`;
    return new File(
      [bytes],
      payload.fileName?.trim() || fallbackName,
      { type: mimeType, lastModified: Date.now() },
    );
  } catch {
    return null;
  }
}

function isDuplicateSticker(file: File): boolean {
  // Android can dispatch commitContent, beforeinput and paste for the same sticker.
  const signature = `${file.type}:${file.size}`;
  const now = Date.now();
  const duplicate = signature === lastStickerSignature
    && now - lastStickerAcceptedAt < DUPLICATE_WINDOW_MS;

  lastStickerSignature = signature;
  lastStickerAcceptedAt = now;
  return duplicate;
}

function restoreDraftWhenMounted(): void {
  const draft = sessionStorage.getItem(MESSAGE_DRAFT_KEY);
  if (draft === null) return;

  const input = getActiveMessageInput();
  if (!input) return;

  input.value = draft;
  sessionStorage.removeItem(MESSAGE_DRAFT_KEY);
  try {
    input.focus({ preventScroll: true });
  } catch {
    input.focus();
  }
}

async function sendSticker(file: File, input: HTMLInputElement | HTMLTextAreaElement): Promise<void> {
  if (sendingSticker || isDuplicateSticker(file)) return;

  const form = input.closest<HTMLFormElement>('.messages-composer');
  if (!form) return;

  sendingSticker = true;
  form.classList.add('is-sending-sticker');
  sessionStorage.setItem(MESSAGE_DRAFT_KEY, input.value);

  const clientMutationId = `sticker:${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
  const payload = new FormData();
  payload.append('file', file, file.name);
  payload.append('clientMutationId', clientMutationId);

  try {
    await apiFetch<StickerUploadResponse>('/messages/sticker', {
      method: 'POST',
      body: payload,
    });

    invalidateQueries('messages:list:');
    invalidateRoutes('/app/messages');

    // Rebuild the active cached route immediately. This keeps Messages as the single
    // source of truth and avoids a second optimistic renderer just for stickers.
    navigate('/app/messages');
    window.setTimeout(restoreDraftWhenMounted, 120);
  } catch {
    sessionStorage.removeItem(MESSAGE_DRAFT_KEY);
    showToast('Không gửi được sticker, thử lại nhé', 'error');
  } finally {
    sendingSticker = false;
    form.classList.remove('is-sending-sticker');
  }
}

function receiveNativeSticker(payload: NativeStickerPayload): void {
  const input = getActiveMessageInput();
  if (!input) {
    showToast('Mở Tin nhắn rồi chọn lại sticker nhé', 'info');
    return;
  }

  const file = fileFromNativePayload(payload);
  if (!file) {
    showToast('Không đọc được sticker từ bàn phím', 'error');
    return;
  }

  void sendSticker(file, input);
}

function installNativeStickerBridge(): void {
  window.onNativeStickerReceived = receiveNativeSticker;
  window.onNativeStickerError = (message: string) => {
    showToast(message || 'Không đọc được sticker từ bàn phím', 'error');
  };

  const pending = window.__pendingNativeStickers?.splice(0) ?? [];
  pending.forEach(receiveNativeSticker);
}

function enhanceStickerImage(image: HTMLImageElement): void {
  if (!image.src.includes(STICKER_URL_MARKER)) return;

  const bubble = image.closest<HTMLElement>('.chat-bubble.has-photo');
  const message = image.closest<HTMLElement>('[data-message-id]');
  if (!bubble || !message) return;

  bubble.classList.add('is-sticker');
  message.classList.add('chat-sticker-message');
  image.alt = 'Sticker';
  image.draggable = false;
}

async function syncStickerOwnership(): Promise<void> {
  const stickerElements = Array.from(
    document.querySelectorAll<HTMLElement>('.chat-sticker-message[data-message-id]'),
  );
  if (stickerElements.length === 0) return;

  try {
    const page = await getMessages({ limit: 50 });
    const ownership = new Map(
      page.data
        .filter((message) => message.imageUrl?.includes(STICKER_URL_MARKER))
        .map((message) => [message.id, message.isOwn]),
    );

    stickerElements.forEach((element) => {
      const isOwn = ownership.get(element.dataset.messageId ?? '');
      if (isOwn !== undefined) element.classList.toggle('own', isOwn);
    });
  } catch {
    // Sticker sizing does not depend on ownership; alignment can wait for next sync.
  }
}

function styleStickerMessages(): void {
  document
    .querySelectorAll<HTMLImageElement>(`.messages-thread img[src*="${STICKER_URL_MARKER}"]`)
    .forEach(enhanceStickerImage);

  void syncStickerOwnership();
  restoreDraftWhenMounted();
}

function scheduleStickerStyling(): void {
  if (styleFrame !== null) return;
  styleFrame = window.requestAnimationFrame(() => {
    styleFrame = null;
    styleStickerMessages();
  });
}

function onPaste(event: ClipboardEvent): void {
  if (!isMessageInput(event.target)) return;
  const image = imageFromDataTransfer(event.clipboardData);
  if (!image) return;

  event.preventDefault();
  event.stopPropagation();
  void sendSticker(image, event.target);
}

function onBeforeInput(event: InputEvent): void {
  if (!isMessageInput(event.target)) return;
  if (event.inputType !== 'insertFromPaste' && event.inputType !== 'insertReplacementText') return;

  const richInput = event as InputEvent & { dataTransfer?: DataTransfer | null };
  const image = imageFromDataTransfer(richInput.dataTransfer);
  if (!image) return;

  event.preventDefault();
  void sendSticker(image, event.target);
}

function onInput(event: Event): void {
  if (!isMessageInput(event.target)) return;
  const input = event.target;

  // Some keyboards insert an object-replacement character and leave the actual
  // image in the clipboard rather than exposing it on the paste event.
  if (!input.value.includes('\uFFFC')) return;
  input.value = input.value.replace(/\uFFFC/g, '');

  void imageFromClipboardApi().then((image) => {
    if (image) void sendSticker(image, input);
  });
}

export function initMessageStickerInput(): void {
  if (initialized) return;
  initialized = true;

  installNativeStickerBridge();
  document.addEventListener('paste', onPaste, true);
  document.addEventListener('beforeinput', onBeforeInput, true);
  document.addEventListener('input', onInput, true);

  const observer = new MutationObserver(scheduleStickerStyling);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  scheduleStickerStyling();
}
