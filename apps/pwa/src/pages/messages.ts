import { openPolaroidCoverModal } from '../components/polaroid-cover';
import { openMessageImageViewer } from '../components/message-image-viewer';
import { createMessage, getMessageContext, getMessages } from '../api/messages';
import * as messageApi from '../api/messages';
import { enqueueMessage, flushMessageOutbox, type QueuedMessage } from '../api/message-outbox';
import { createCheckin } from '../api/checkins';
import { openCamera, processImage, revokePreviewUrl } from '../components/camera';
import { showToast } from '../components/toast';
import type { ChatMessage } from '../api/types';
import { navigate, type RoutePage } from '../router';
import { store } from '../store/index';

const NEAR_BOTTOM_DISTANCE = 80;
const SWIPE_INTENT_DISTANCE = 10;
const SWIPE_REPLY_THRESHOLD = 56;
const SWIPE_MAX_TRANSLATE = 76;
const POLL_INTERVAL = 10_000;

interface PendingReply {
  messageId: string;
  senderName: string;
  type: ChatMessage['type'];
  textSnippet?: string;
  mediaThumbnailUrl?: string;
}

interface ScrollState {
  initialized: boolean;
  isNearBottom: boolean;
  pendingIncomingCount: number;
  isLoadingOlder: boolean;
}

interface MessageView {
  item: ChatMessage;
  element: HTMLElement;
  bubble: HTMLElement;
  content: HTMLParagraphElement;
  time: HTMLTimeElement;
  quote: HTMLButtonElement | null;
  editedTag: HTMLButtonElement;
  editHistory: HTMLElement;
  reactions: HTMLElement;
  readStatus: HTMLElement;
  replyKeys: Set<string>;
}

function escapeHtml(value: string | undefined): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function formatMessageTime(value: string, now = new Date()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  if (localDayKey(date) === localDayKey(now)) return time;

  const day = date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return `${day} ${time}`;
}

function getLatestActivityTime(item: ChatMessage): number {
  return new Date(item.createdAt).getTime();
}

function messageText(item: ChatMessage): string {
  return item.text ?? '';
}

function isReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function clampSwipe(distance: number): number {
  if (distance <= SWIPE_MAX_TRANSLATE) return distance;
  return SWIPE_MAX_TRANSLATE + (distance - SWIPE_MAX_TRANSLATE) * 0.18;
}

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '👍'];

function optionalMessageApiFunction(name: string): ((...args: any[]) => any) | undefined {
  try {
    return (messageApi as unknown as Record<string, unknown>)[name] as ((...args: any[]) => any) | undefined;
  } catch {
    return undefined;
  }
}

interface PendingShare {
  text?: string;
  files?: Array<{ blob: Blob; name?: string; type?: string }>;
}

interface AndroidPendingShare {
  text?: string;
  images?: Array<{ dataUrl: string; name?: string; type?: string }>;
}

function readAndroidPendingShare(): AndroidPendingShare | null {
  try {
    const raw = window.LoveCheckAndroid?.getPendingShareData?.();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AndroidPendingShare;
    return parsed.text || parsed.images?.length ? parsed : null;
  } catch {
    return null;
  }
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob | null> {
  try {
    const response = await fetch(dataUrl);
    return await response.blob();
  } catch {
    return null;
  }
}

async function consumePendingShare(): Promise<PendingShare | null> {
  if (!new URLSearchParams(window.location.search).has('share')) return null;
  if (!('serviceWorker' in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    const worker = navigator.serviceWorker.controller ?? registration.active;
    if (!worker) return null;
    return await new Promise<PendingShare | null>((resolve) => {
      const channel = new MessageChannel();
      const timeout = window.setTimeout(() => resolve(null), 2_000);
      channel.port1.onmessage = (event) => {
        window.clearTimeout(timeout);
        resolve((event.data as PendingShare | null) ?? null);
      };
      worker.postMessage({ type: 'GET_PENDING_SHARE' }, [channel.port2]);
    });
  } catch {
    return null;
  }
}

export function renderMessagesPage(): RoutePage {
  const page = document.createElement('div');
  page.className = 'page messages-page animate-fade-in';
  // Android WebView + adjustResize can leave 100dvh stuck at the keyboard-sized
  // viewport. Use the largest visual viewport measured by keyboard.ts instead.
  if (document.documentElement.classList.contains('android-wrapper')) {
    const stableViewportHeight = 'var(--app-viewport-height, 100vh)';
    page.style.minHeight = stableViewportHeight;
    page.style.height = stableViewportHeight;
    page.style.maxHeight = stableViewportHeight;
  }
  page.innerHTML = `
    <header class="messages-header">
      <div>
        <span class="messages-eyebrow">Hai đứa mình</span>
        <h1>Tin nhắn</h1>
        <span class="messages-presence" aria-live="polite"></span>
      </div>
    </header>
    <main class="messages-thread" aria-live="polite" aria-label="Cuộc trò chuyện"></main>
    <button class="messages-new-indicator" type="button" hidden aria-live="polite"></button>
    <form class="messages-composer" autocomplete="off">
      <div class="messages-reply-preview" hidden></div>
      <div class="messages-composer-row">
        <input id="message-photo" type="file" accept="image/*" hidden />
        <button class="messages-photo-button" type="button" aria-label="Mở tùy chọn đính kèm">+</button>
        <div class="messages-attach-menu" hidden>
          <button type="button" data-attach="gallery">Chọn ảnh</button>
          <button type="button" data-attach="camera">Chụp check-in</button>
        </div>
        <div class="messages-input-wrap">
          <button class="messages-photo-preview" type="button" hidden aria-label="Xem ảnh đã chọn"></button>
          <input
            id="message-input"
            type="text"
            name="chat_message_input"
            maxlength="280"
            placeholder="Gửi tin nhắn..."
            aria-label="Nội dung tin nhắn"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="sentences"
            spellcheck="false"
            data-lpignore="true"
            data-form-type="other"
            data-1p-ignore="true"
          />
        </div>
        <button class="messages-send" type="submit" aria-label="Gửi tin nhắn">↑</button>
      </div>
    </form>
  `;

  const thread = page.querySelector<HTMLElement>('.messages-thread')!;
  const indicator = page.querySelector<HTMLButtonElement>('.messages-new-indicator')!;
  const form = page.querySelector<HTMLFormElement>('.messages-composer')!;
  const replyPreview = page.querySelector<HTMLElement>('.messages-reply-preview')!;
  const messageInput = page.querySelector<HTMLInputElement>('#message-input')!;
  const photoInput = page.querySelector<HTMLInputElement>('#message-photo')!;
  const photoButton = page.querySelector<HTMLButtonElement>('.messages-photo-button')!;
  const attachMenu = page.querySelector<HTMLElement>('.messages-attach-menu')!;
  const preview = page.querySelector<HTMLElement>('.messages-photo-preview')!;
  const sendButton = page.querySelector<HTMLButtonElement>('.messages-send')!;
  const presence = page.querySelector<HTMLElement>('.messages-presence')!;
  const bottomSentinel = document.createElement('div');
  bottomSentinel.dataset.messageBottomSentinel = '';
  bottomSentinel.className = 'messages-bottom-sentinel';

  const scrollState: ScrollState = {
    initialized: false,
    isNearBottom: true,
    pendingIncomingCount: 0,
    isLoadingOlder: false,
  };
  const messageViews = new Map<string, MessageView>();
  const messages = new Map<string, ChatMessage>();
  const pickerStates = new WeakMap<MessageView, { ignoreNextClick: boolean }>();
  let selectedPhoto: File | null = null;
  let previewUrl: string | null = null;
  let pendingReply: PendingReply | null = null;
  let beforeCursor: string | null = null;
  let afterCursor: string | null = null;
  let hasMoreOlder = false;
  let active = false;
  let pollTimer: number | null = null;
  let scrollFrame: number | null = null;
  let observer: IntersectionObserver | null = null;
  let typingTimer: number | null = null;
  let typingStopTimer: number | null = null;
  let lastReadMessageId: string | null = null;
  let partnerOnline = false;

  const safePresence = (online: boolean): Promise<void> => (
    optionalMessageApiFunction('setMessagePresence')?.(online) ?? Promise.resolve()
  );
  const safeTyping = (isTyping: boolean): Promise<void> => (
    optionalMessageApiFunction('setMessageTyping')?.(isTyping) ?? Promise.resolve()
  );
  const safeRead = (options: { upTo: string }): Promise<void> => (
    optionalMessageApiFunction('markMessagesRead')?.(options) ?? Promise.resolve()
  );

  async function sendQueuedMessage(queued: QueuedMessage): Promise<ChatMessage> {
    if (queued.file) {
      const formData = new FormData();
      formData.append('file', queued.file, queued.fileName || 'shared-image.jpg');
      if (queued.text) formData.append('text', queued.text);
      if (queued.replyToMessageId) formData.append('replyToMessageId', queued.replyToMessageId);
      formData.append('clientMutationId', queued.clientMutationId);
      return createMessage(formData);
    }
    return createMessage({
      type: 'text',
      text: queued.text,
      ...(queued.replyToMessageId ? { replyToMessageId: queued.replyToMessageId } : {}),
      clientMutationId: queued.clientMutationId,
    });
  }

  function flushOutbox(): void {
    void flushMessageOutbox(sendQueuedMessage, (message) => {
      replaceTemporaryMessage(`optimistic-${message.clientMutationId}`, message);
    });
  }


  function ensureSentinel(): void {
    if (!bottomSentinel.isConnected) thread.appendChild(bottomSentinel);
  }

  function distanceFromBottom(): number {
    return thread.scrollHeight - thread.scrollTop - thread.clientHeight;
  }

  function updateIndicator(): void {
    if (scrollState.isNearBottom && scrollState.pendingIncomingCount === 0) {
      indicator.hidden = true;
      return;
    }

    const count = scrollState.pendingIncomingCount;
    const isScrolledUp = distanceFromBottom() > 160;

    if (count > 0) {
      indicator.hidden = false;
      indicator.classList.add('has-badge');
      indicator.innerHTML = `
        <span class="indicator-badge">${count}</span>
        <span class="indicator-text">${count === 1 ? '1 tin nhắn mới' : `${count} tin nhắn mới`}</span>
        <svg class="indicator-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      `;
    } else if (isScrolledUp && !scrollState.isNearBottom) {
      indicator.hidden = false;
      indicator.classList.remove('has-badge');
      indicator.innerHTML = `
        <svg class="indicator-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <polyline points="19 12 12 19 5 12"></polyline>
        </svg>
      `;
    } else {
      indicator.hidden = true;
    }
  }

  function setNearBottom(nextValue: boolean): void {
    scrollState.isNearBottom = nextValue;
    if (nextValue) {
      scrollState.pendingIncomingCount = 0;
    }
    updateIndicator();
  }

  function scrollToBottom(mode: 'initial' | 'follow' | 'send' = 'follow'): void {
    const top = thread.scrollHeight;
    setNearBottom(true);
    indicator.hidden = true;
    if (mode === 'initial' || isReducedMotion() || typeof thread.scrollTo !== 'function') {
      thread.scrollTop = top;
      return;
    }
    thread.scrollTo({ top, behavior: 'smooth' });
  }

  function replySummary(item: ChatMessage): string {
    return messageText(item) || (item.imageUrl ? 'Ảnh' : 'Tin nhắn');
  }

  function createQuote(item: ChatMessage): HTMLButtonElement | null {
    if (!item.replyTo) return null;
    const quote = document.createElement('button');
    quote.type = 'button';
    quote.className = 'message-quote';
    quote.dataset.replyToMessageId = item.replyTo.messageId;
    quote.setAttribute('aria-label', `Đi tới tin nhắn của ${item.replyTo.senderName}`);
    const sender = document.createElement('strong');
    sender.textContent = item.replyTo.senderName;
    const content = document.createElement('span');
    content.className = 'message-quote-content';
    if (item.replyTo.mediaUrl) {
      const thumbnail = document.createElement('img');
      thumbnail.className = 'message-quote-thumb';
      thumbnail.src = item.replyTo.mediaUrl;
      thumbnail.alt = 'Ảnh được trả lời';
      thumbnail.loading = 'lazy';
      content.appendChild(thumbnail);
    }
    const summary = document.createElement('span');
    summary.className = 'message-quote-text';
    summary.textContent = item.replyTo.textSnippet || (item.replyTo.mediaUrl ? 'Ảnh' : 'Tin nhắn');
    content.appendChild(summary);
    quote.append(sender, content);
    return quote;
  }

  function createReferencedCheckin(item: ChatMessage): HTMLButtonElement | null {
    const reference = item.referencedCheckin;
    if (!reference || (reference.imageUrl && reference.imageUrl === item.imageUrl)) return null;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'message-referenced-checkin';
    card.setAttribute('aria-label', 'Xem ảnh kỷ niệm');
    if (reference.imageUrl) {
      const image = document.createElement('img');
      image.src = reference.imageUrl;
      image.alt = '';
      image.loading = 'lazy';
      card.appendChild(image);
    }
    const copy = document.createElement('span');
    const label = document.createElement('strong');
    label.textContent = 'Kỷ niệm';
    const detail = document.createElement('small');
    detail.textContent = `${reference.ownerName} · ${reference.caption || reference.mood || 'Khoảnh khắc đã chia sẻ'}`;
    copy.append(label, detail);
    card.appendChild(copy);

    card.addEventListener('click', (event) => {
      event.stopPropagation();
      // 1. Check if the matching photo is already visible in the current chat thread
      let targetView: MessageView | undefined;
      if (reference.imageUrl) {
        for (const view of messageViews.values()) {
          if (view.item.id !== item.id && view.item.imageUrl && view.item.imageUrl === reference.imageUrl) {
            targetView = view;
            break;
          }
        }
      }

      if (targetView) {
        // Smoothly scroll to the photo inside the chat!
        targetView.element.scrollIntoView({
          behavior: isReducedMotion() ? 'auto' : 'smooth',
          block: 'center',
        });
        targetView.element.classList.add('message-highlight');
        window.setTimeout(() => targetView?.element.classList.remove('message-highlight'), 1_500);
      } else if (reference.imageUrl) {
        // If not in chat thread, open the clean Polaroid photo viewer without scratch
        openPolaroidCoverModal({
          imageUrl: reference.imageUrl,
          title: reference.caption || `Kỷ niệm của ${reference.ownerName} 💖`,
          dateText: `${reference.ownerName} · Kỷ niệm`,
          forceScratch: false,
        });
      } else {
        navigate('/app/memories');
      }
    });
    return card;
  }

  function renderReactions(view: MessageView, item: ChatMessage): void {
    view.reactions.replaceChildren();
    for (const reaction of item.reactions ?? []) {
      if (reaction.count <= 0) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `message-reaction${reaction.reactedByMe ? ' reacted' : ''}`;
      button.textContent = `${reaction.type} ${reaction.count > 1 ? reaction.count : ''}`.trim();
      button.setAttribute('aria-label', `${reaction.type} ${reaction.count}`);
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const toggleReaction = optionalMessageApiFunction('toggleMessageReaction');
        const request = toggleReaction
          ? toggleReaction(item.id, reaction.type)
          : Promise.resolve([]);
        void request
          .then((reactions: ChatMessage['reactions'] = []) => {
            const latest = messages.get(item.id);
            if (!latest) return;
            latest.reactions = reactions;
            renderReactions(view, latest);
          })
          .catch(() => showToast('Chưa cập nhật được cảm xúc', 'error'));
      });
      view.reactions.appendChild(button);
    }
    view.reactions.hidden = view.reactions.childElementCount === 0;
  }

  function wasReadByPartner(item: ChatMessage): boolean {
    if (!item.isOwn || !item.readBy?.length) return false;
    const currentUserId = store.get().user?.id;
    // The read endpoint also records the current user's own id while they are
    // viewing the thread. Only a different member's id is a partner read.
    return item.readBy.some((userId) => userId !== currentUserId);
  }

  function renderReadStatus(view: MessageView, item: ChatMessage, visible = false): void {
    view.readStatus.hidden = !visible;
    view.readStatus.textContent = visible ? 'Đã đọc' : '';
  }

  function renderEditHistory(view: MessageView, item: ChatMessage): void {
    const edited = Boolean(item.editedAt);
    view.editedTag.hidden = !edited;
    view.editedTag.setAttribute('aria-expanded', edited && !view.editHistory.hidden ? 'true' : 'false');
    if (!edited) {
      view.editHistory.hidden = true;
      view.editHistory.replaceChildren();
      return;
    }

    const wasOpen = !view.editHistory.hidden;
    view.editHistory.replaceChildren();
    const heading = document.createElement('small');
    heading.className = 'message-edit-history-title';
    heading.textContent = 'Lịch sử chỉnh sửa';
    view.editHistory.appendChild(heading);

    const history = item.editHistory ?? [];
    if (history.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'message-edit-history-empty';
      empty.textContent = 'Chưa có bản lưu trước đó';
      view.editHistory.appendChild(empty);
    } else {
      history.slice().reverse().forEach((entry) => {
        const row = document.createElement('div');
        row.className = 'message-edit-history-item';
        const text = document.createElement('span');
        text.textContent = entry.text;
        const time = document.createElement('time');
        time.dateTime = entry.editedAt;
        time.textContent = formatMessageTime(entry.editedAt);
        row.append(text, time);
        view.editHistory.appendChild(row);
      });
    }

    const hide = document.createElement('button');
    hide.type = 'button';
    hide.className = 'message-edit-history-hide';
    hide.textContent = 'Ẩn lịch sử chỉnh sửa';
    hide.addEventListener('click', (event) => {
      event.stopPropagation();
      view.editHistory.hidden = true;
      view.editedTag.setAttribute('aria-expanded', 'false');
    });
    view.editHistory.appendChild(hide);
    view.editHistory.hidden = !wasOpen;
  }

  function openReactionPicker(view: MessageView, openedByLongPress = false): void {
    const existing = view.bubble.querySelector('.message-reaction-picker');
    if (existing) return;
    const pickerState = pickerStates.get(view) ?? { ignoreNextClick: false };
    pickerState.ignoreNextClick = openedByLongPress;
    pickerStates.set(view, pickerState);
    const picker = document.createElement('div');
    picker.className = 'message-reaction-picker';
    picker.setAttribute('role', 'menu');
    const reactionRow = document.createElement('div');
    reactionRow.className = 'message-reaction-options';
    picker.appendChild(reactionRow);
    let removeOutsideListener: (() => void) | null = null;
    const closePicker = () => {
      pickerState.ignoreNextClick = false;
      picker.remove();
      removeOutsideListener?.();
    };
    QUICK_REACTIONS.forEach((type) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = type;
      button.setAttribute('aria-label', `Bày tỏ ${type}`);
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        closePicker();
        const toggleReaction = optionalMessageApiFunction('toggleMessageReaction');
        const request = toggleReaction
          ? toggleReaction(view.item.id, type)
          : Promise.resolve([]);
        void request
          .then((reactions: ChatMessage['reactions'] = []) => {
            const latest = messages.get(view.item.id);
            if (!latest) return;
            latest.reactions = reactions;
            renderReactions(view, latest);
          })
          .catch(() => showToast('Chưa cập nhật được cảm xúc', 'error'));
      });
      reactionRow.appendChild(button);
    });
    if (view.item.isOwn) {
      const actionRow = document.createElement('div');
      actionRow.className = 'message-action-row';
      if (view.item.type === 'text') {
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'message-action-button';
        edit.textContent = 'Sửa';
        edit.addEventListener('click', (event) => {
          event.stopPropagation();
          closePicker();
          const nextText = window.prompt('Chỉnh sửa tin nhắn', messageText(view.item));
          if (!nextText?.trim()) return;
          const editMessage = optionalMessageApiFunction('editMessage');
          if (!editMessage) return;
          void editMessage(view.item.id, nextText.trim())
            .then((updated: ChatMessage) => {
              messages.set(updated.id, updated);
              patchView(view, updated);
            })
            .catch(() => showToast('Chưa sửa được tin nhắn', 'error'));
        });
        actionRow.appendChild(edit);
      }
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'message-action-button';
      remove.textContent = 'Thu hồi';
      remove.addEventListener('click', (event) => {
        event.stopPropagation();
        closePicker();
        if (!window.confirm('Thu hồi tin nhắn này?')) return;
        const deleteMessage = optionalMessageApiFunction('deleteMessage');
        if (!deleteMessage) return;
        void deleteMessage(view.item.id)
          .then(() => {
            view.element.remove();
            messageViews.delete(view.item.id);
            messages.delete(view.item.id);
          })
          .catch(() => showToast('Chưa thu hồi được tin nhắn', 'error'));
      });
      actionRow.appendChild(remove);
      picker.appendChild(actionRow);
    }
    view.bubble.appendChild(picker);
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      // Mobile browsers emit a synthetic click after a long-press. Consume only
      // that click so the newly opened picker remains visible for the user.
      if (pickerState.ignoreNextClick) {
        pickerState.ignoreNextClick = false;
        return;
      }
      if (!target || !picker.contains(target)) closePicker();
    };
    removeOutsideListener = () => document.removeEventListener('click', onDocumentClick, true);
    document.addEventListener('click', onDocumentClick, true);
  }

  function refreshReadStatuses(): void {
    const latestReadMessage = [...messages.values()]
      .filter((item) => wasReadByPartner(item))
      .sort((left, right) => getLatestActivityTime(right) - getLatestActivityTime(left))[0];

    for (const view of messageViews.values()) {
      renderReadStatus(view, view.item, view.item.id === latestReadMessage?.id);
    }
  }

  function patchView(view: MessageView, item: ChatMessage): void {
    view.item = item;
    view.element.dataset.messageId = item.id;
    view.element.dataset.messageCreatedAt = item.createdAt;
    view.element.classList.toggle('own', item.isOwn);
    view.content.textContent = messageText(item);
    view.content.hidden = !messageText(item);
    view.time.textContent = formatMessageTime(item.createdAt);
    view.time.dateTime = item.createdAt;
    view.time.title = new Date(item.createdAt).toLocaleString('vi-VN');
    renderEditHistory(view, item);
    const image = view.bubble.querySelector<HTMLImageElement>('img');
    if (image && item.imageUrl && image.src !== item.imageUrl) image.src = item.imageUrl;

    const nextQuote = createQuote(item);
    if (view.quote && !nextQuote) {
      view.quote.remove();
      view.quote = null;
    } else if (!view.quote && nextQuote) {
      view.bubble.prepend(nextQuote);
      view.quote = nextQuote;
    } else if (view.quote && nextQuote) {
      view.quote.replaceChildren(...Array.from(nextQuote.childNodes));
      view.quote.dataset.replyToMessageId = nextQuote.dataset.replyToMessageId;
    }
    renderReactions(view, item);
    renderReadStatus(view, item);
  }

  function beginReply(item: ChatMessage): void {
    pendingReply = {
      messageId: item.id,
      senderName: item.senderName,
      type: item.type,
      textSnippet: replySummary(item),
      mediaThumbnailUrl: item.imageUrl,
    };
    replyPreview.hidden = false;
    replyPreview.innerHTML = `
      <span class="messages-reply-copy"><strong>Trả lời ${escapeHtml(pendingReply.senderName)}</strong><span>${escapeHtml(pendingReply.textSnippet || 'Tin nhắn')}</span></span>
      <button type="button" class="messages-reply-cancel" aria-label="Hủy trả lời tin nhắn">×</button>
    `;
    replyPreview.querySelector('button')?.addEventListener('click', clearPendingReply);
    window.requestAnimationFrame(() => messageInput.focus());
  }

  function clearPendingReply(): void {
    pendingReply = null;
    replyPreview.hidden = true;
    replyPreview.replaceChildren();
  }

  function installSwipeReply(view: MessageView): void {
    const bubble = view.bubble;
    let pointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let horizontalIntent = false;
    let activated = false;
    let suppressClickUntil = 0;

    const reset = () => {
      pointerId = null;
      horizontalIntent = false;
      bubble.classList.remove('is-swiping', 'is-swipe-ready');
      bubble.style.transform = '';
    };

    bubble.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || pointerId !== null || event.clientX < 24) return;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      activated = false;
    });
    bubble.addEventListener('pointermove', (event) => {
      if (event.pointerId !== pointerId) return;
      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      if (!horizontalIntent && Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= SWIPE_INTENT_DISTANCE) {
        if (Math.abs(deltaX) <= Math.abs(deltaY) * 1.2 || deltaX <= 0) {
          pointerId = null;
          return;
        }
        horizontalIntent = true;
        bubble.setPointerCapture?.(event.pointerId);
      }
      if (!horizontalIntent) return;
      event.preventDefault();
      const translate = clampSwipe(Math.max(0, deltaX));
      activated = translate >= SWIPE_REPLY_THRESHOLD;
      bubble.classList.add('is-swiping');
      bubble.classList.toggle('is-swipe-ready', activated);
      bubble.style.transform = `translateX(${translate}px)`;
    });
    const complete = (event: PointerEvent, cancelled = false) => {
      if (event.pointerId !== pointerId) return;
      const shouldReply = horizontalIntent && activated && !cancelled;
      if (horizontalIntent) suppressClickUntil = Date.now() + 250;
      bubble.releasePointerCapture?.(event.pointerId);
      reset();
      if (shouldReply) beginReply(view.item);
    };
    bubble.addEventListener('pointerup', (event) => complete(event));
    bubble.addEventListener('pointercancel', (event) => complete(event, true));
    bubble.addEventListener('click', (event) => {
      if (Date.now() < suppressClickUntil) event.preventDefault();
    }, true);
  }

  function createView(item: ChatMessage): MessageView {
    const hasPhoto = Boolean(item.imageUrl);
    const element = document.createElement(hasPhoto ? 'section' : 'article');
    element.className = hasPhoto
      ? `chat-checkin-group${item.isOwn ? ' own' : ''}`
      : `chat-text-message${item.isOwn ? ' own' : ''}`;
    element.dataset.messageId = item.id;

    const primary = hasPhoto ? document.createElement('article') : element;
    if (hasPhoto) {
      primary.className = 'chat-checkin';
      element.appendChild(primary);
    }
    const editedTag = document.createElement('button');
    editedTag.type = 'button';
    editedTag.className = 'message-edited-tag';
    editedTag.textContent = 'Đã chỉnh sửa';
    editedTag.hidden = true;
    editedTag.setAttribute('aria-expanded', 'false');
    const editHistory = document.createElement('div');
    editHistory.className = 'message-edit-history';
    editHistory.hidden = true;
    editedTag.addEventListener('click', (event) => {
      event.stopPropagation();
      if (editedTag.hidden) return;
      editHistory.hidden = !editHistory.hidden;
      editedTag.setAttribute('aria-expanded', editHistory.hidden ? 'false' : 'true');
    });
    primary.append(editedTag, editHistory);
    const bubble = document.createElement('div');
    bubble.className = hasPhoto ? 'chat-bubble has-photo' : 'chat-text-bubble';
    const quote = createQuote(item);
    if (quote) bubble.appendChild(quote);
    const referencedCheckin = createReferencedCheckin(item);
    if (referencedCheckin) bubble.appendChild(referencedCheckin);
    if (hasPhoto) {
      const image = document.createElement('img');
      image.src = item.imageUrl!;
      image.alt = 'Ảnh tin nhắn';
      image.loading = 'lazy';
      image.addEventListener('load', () => {
        // Never force-scroll a reader upward in history while the image settles.
        if (scrollState.isNearBottom) scrollToBottom('follow');
      });
      image.addEventListener('click', (event) => {
        event.stopPropagation();
        openMessageImageViewer(item.imageUrl!, item.text || `Ảnh từ ${item.senderName}`);
      });
      bubble.appendChild(image);
    }
    const content = document.createElement('p');
    content.textContent = messageText(item);
    content.hidden = !content.textContent;
    bubble.appendChild(content);
    primary.appendChild(bubble);
    const time = document.createElement('time');
    time.textContent = formatMessageTime(item.createdAt);
    time.dateTime = item.createdAt;
    time.title = new Date(item.createdAt).toLocaleString('vi-VN');
    primary.appendChild(time);
    element.dataset.messageCreatedAt = item.createdAt;

    const reactions = document.createElement('div');
    reactions.className = 'message-reactions';
    reactions.hidden = true;
    bubble.appendChild(reactions);
    const readStatus = document.createElement('small');
    readStatus.className = 'message-read-status';
    readStatus.hidden = true;
    primary.appendChild(readStatus);

    const view: MessageView = {
      item, element, bubble, content, time, quote, editedTag, editHistory, reactions, readStatus,
      replyKeys: new Set(),
    };
    renderReactions(view, item);
    renderReadStatus(view, item);
    renderEditHistory(view, item);
    let longPressTimer: number | null = null;
    bubble.addEventListener('pointerdown', () => {
      longPressTimer = window.setTimeout(() => openReactionPicker(view, true), 560);
    }, { passive: true });
    const clearLongPress = () => {
      if (longPressTimer !== null) window.clearTimeout(longPressTimer);
      longPressTimer = null;
    };
    bubble.addEventListener('pointerup', clearLongPress, { passive: true });
    bubble.addEventListener('pointercancel', clearLongPress, { passive: true });
    bubble.addEventListener('pointermove', clearLongPress, { passive: true });
    bubble.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      openReactionPicker(view);
    });
    primary.addEventListener('click', () => element.classList.toggle('show-timestamp'));
    installSwipeReply(view);
    return view;
  }

  function insertMessage(item: ChatMessage, position: 'append' | 'prepend' = 'append'): MessageView {
    const view = createView(item);
    messageViews.set(item.id, view);
    messages.set(item.id, item);
    const firstMessage = thread.querySelector<HTMLElement>('[data-message-id]');
    if (position === 'prepend' && firstMessage) thread.insertBefore(view.element, firstMessage);
    else thread.insertBefore(view.element, bottomSentinel);
    return view;
  }

  function replaceTemporaryMessage(tempId: string, item: ChatMessage): void {
    const view = messageViews.get(tempId);
    if (!view) {
      insertMessage(item);
      return;
    }
    messageViews.delete(tempId);
    messages.delete(tempId);
    messageViews.set(item.id, view);
    messages.set(item.id, item);
    patchView(view, item);
  }

  function mergeMessages(incoming: ChatMessage[], source: 'initial' | 'refresh' | 'older'): number {
    const wasNearBottom = scrollState.isNearBottom;
    let newIncoming = 0;
    const sorted = [...incoming].sort((a, b) => getLatestActivityTime(a) - getLatestActivityTime(b));
    sorted.forEach((item) => {
      const existing = messageViews.get(item.id);
      if (existing) {
        patchView(existing, item);
        messages.set(item.id, item);
        return;
      }
      const temporary = item.clientMutationId
        ? [...messageViews.entries()].find(([id, view]) => id.startsWith('optimistic-') && view.item.clientMutationId === item.clientMutationId)
        : undefined;
      if (temporary) {
        replaceTemporaryMessage(temporary[0], item);
        return;
      }
      insertMessage(item, source === 'older' ? 'prepend' : 'append');
      if (source === 'refresh' && !item.isOwn) newIncoming++;
    });
    refreshReadStatuses();

    if (source === 'initial') {
      scrollToBottom('initial');
    } else if (source === 'refresh' && newIncoming > 0) {
      if (wasNearBottom) scrollToBottom('follow');
      else {
        scrollState.pendingIncomingCount += newIncoming;
        updateIndicator();
      }
    }
    if (scrollState.isNearBottom) {
      const latest = sorted.at(-1);
      if (latest && !latest.isOwn && latest.id !== lastReadMessageId) {
        lastReadMessageId = latest.id;
        void safeRead({ upTo: latest.id }).catch(() => {
          // A transient offline read receipt can be retried on the next refresh.
          lastReadMessageId = null;
        });
      }
    }
    return newIncoming;
  }

  async function focusReplyFromQuery(): Promise<void> {
    const messageId = new URLSearchParams(window.location.search).get('replyTo');
    if (!messageId || !active) return;

    let target = messages.get(messageId);
    if (!target) {
      try {
        const context = await getMessageContext(messageId);
        if (active && context.length > 0) {
          mergeMessages(context, 'older');
          target = messages.get(messageId);
        }
      } catch {
        // The notification can still open the conversation if the context is unavailable.
      }
    }

    if (target) {
      beginReply(target);
      const view = messageViews.get(messageId);
      view?.element.scrollIntoView({
        behavior: isReducedMotion() ? 'auto' : 'smooth',
        block: 'center',
      });
    } else {
      showToast('Không tìm thấy tin nhắn cần trả lời', 'info');
    }

    const url = new URL(window.location.href);
    url.searchParams.delete('replyTo');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }

  async function loadInitialMessages(): Promise<void> {
    thread.replaceChildren(document.createElement('div'));
    thread.firstElementChild?.classList.add('messages-loading', 'skeleton');
    try {
      const response = await getMessages({ limit: 50, force: true });
      if (!active) return;
      thread.replaceChildren();
      ensureSentinel();
      if (response.data.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'messages-empty';
        empty.textContent = 'Gửi một điều nhỏ đầu tiên cho người ấy nhé.';
        thread.insertBefore(empty, bottomSentinel);
      } else {
        mergeMessages(response.data, 'initial');
      }
      beforeCursor = response.beforeCursor;
      afterCursor = response.afterCursor;
      hasMoreOlder = response.hasMore;
      scrollState.initialized = true;
    } catch {
      thread.replaceChildren();
      const empty = document.createElement('p');
      empty.className = 'messages-empty';
      empty.textContent = 'Chưa tải được tin nhắn.\nHãy thử lại nhé.';
      thread.append(empty, bottomSentinel);
    }
  }

  async function refreshMessages(): Promise<void> {
    if (!scrollState.initialized || !active) return;
    try {
      const response = await getMessages({ limit: 50, after: afterCursor ?? undefined, force: true });
      if (active) {
        mergeMessages(response.data, 'refresh');
        afterCursor = response.afterCursor ?? afterCursor;
      }
    } catch {
      // Keep the existing conversation visible while a background refresh fails.
    }
  }

  async function refreshLatestMessages(): Promise<void> {
    if (!scrollState.initialized || !active) return;
    try {
      const response = await getMessages({ limit: 50, force: true });
      if (!active) return;
      mergeMessages(response.data, 'refresh');
      beforeCursor = response.beforeCursor ?? beforeCursor;
      afterCursor = response.afterCursor ?? afterCursor;
    } catch {
      // Keep the current conversation when the stream reconnects during a blip.
    }
  }

  async function loadOlderMessages(): Promise<void> {
    if (!hasMoreOlder || !beforeCursor || scrollState.isLoadingOlder) return;
    scrollState.isLoadingOlder = true;
    const previousHeight = thread.scrollHeight;
    const previousTop = thread.scrollTop;
    try {
      const response = await getMessages({ limit: 50, before: beforeCursor, force: true });
      mergeMessages(response.data, 'older');
      thread.scrollTop = previousTop + (thread.scrollHeight - previousHeight);
      beforeCursor = response.beforeCursor ?? beforeCursor;
      hasMoreOlder = response.hasMore;
    } catch {
      showToast('Chưa tải được tin nhắn cũ', 'error');
    } finally {
      scrollState.isLoadingOlder = false;
    }
  }

  function handleScroll(): void {
    if (scrollFrame !== null) return;
    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = null;
      setNearBottom(distanceFromBottom() <= NEAR_BOTTOM_DISTANCE);
      updateIndicator();
      if (thread.scrollTop <= 32) void loadOlderMessages();
    });
  }

  function startPolling(): void {
    if (pollTimer !== null) return;
    pollTimer = window.setInterval(() => void refreshMessages(), POLL_INTERVAL);
  }

  function stopPolling(): void {
    if (pollTimer === null) return;
    window.clearInterval(pollTimer);
    pollTimer = null;
  }

  async function handlePendingShare(): Promise<void> {
    const pending = await consumePendingShare();
    const android = readAndroidPendingShare();
    if ((!pending && !android) || !active) return;
    const clientMutationId = crypto.randomUUID?.() ?? `share-${Date.now()}`;
    try {
      let result: ChatMessage;
      const nativeImage = android?.images?.[0];
      const nativeBlob = nativeImage ? await dataUrlToBlob(nativeImage.dataUrl) : null;
      const file = pending?.files?.[0] ?? (nativeBlob ? {
        blob: nativeBlob,
        name: nativeImage?.name || 'shared-image.jpg',
      } : undefined);
      const sharedText = pending?.text || android?.text || '';
      if (file?.blob) {
        const formData = new FormData();
        formData.append('file', file.blob, file.name || 'shared-image.jpg');
        if (sharedText) formData.append('text', sharedText);
        formData.append('clientMutationId', clientMutationId);
        result = await createMessage(formData);
      } else if (sharedText) {
        result = await createMessage({ type: 'text', text: sharedText, clientMutationId });
      } else {
        return;
      }
      mergeMessages([result], 'refresh');
      scrollToBottom('send');
      showToast('Đã gửi nội dung được chia sẻ', 'success');
    } catch {
      showToast('Chưa gửi được nội dung chia sẻ', 'error');
    } finally {
      const url = new URL(window.location.href);
      url.searchParams.delete('share');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }

  function handleRealtimeEvent(event: Event): void {
    const data = (event as CustomEvent).detail as {
      type?: string;
      isTyping?: boolean;
      online?: boolean;
      senderName?: string;
      messageId?: string;
      deleted?: boolean;
    } | undefined;
    if (!data) return;
    if (data.type === 'message.typing') {
      presence.textContent = data.isTyping ? `${data.senderName || 'Người ấy'} đang nhập...` : (partnerOnline ? 'Đang hoạt động' : '');
      presence.classList.toggle('typing', Boolean(data.isTyping));
      return;
    }
    if (data.type === 'message.presence') {
      partnerOnline = Boolean(data.online);
      presence.textContent = partnerOnline ? 'Đang hoạt động' : 'Đã offline';
      presence.classList.toggle('typing', false);
      return;
    }
    if (data.type === 'message.updated' && data.deleted && data.messageId) {
      messageViews.get(data.messageId)?.element.remove();
      messageViews.delete(data.messageId);
      messages.delete(data.messageId);
      return;
    }
    if (data.type === 'message' || data.type?.startsWith('message.')) {
      void refreshLatestMessages();
    }
  }

  function clearSelectedPhoto(): void {
    selectedPhoto = null;
    revokePreviewUrl(previewUrl);
    previewUrl = null;
    preview.hidden = true;
    preview.replaceChildren();
    photoInput.value = '';
  }

  function setSelectedPhoto(file: File, previewSource: string): void {
    clearSelectedPhoto();
    selectedPhoto = file;
    previewUrl = previewSource;
    const thumbnail = document.createElement('img');
    thumbnail.src = previewSource;
    thumbnail.alt = 'Ảnh đã chọn';
    thumbnail.loading = 'lazy';
    const label = document.createElement('span');
    label.textContent = 'Ảnh đã chọn';
    preview.append(thumbnail, label);
    preview.hidden = false;
  }

  async function sendMessage(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const text = messageInput.value.trim();
    if (!text && !selectedPhoto) return;

    const replyAtSend = pendingReply;
    const clientMutationId = crypto.randomUUID?.() ?? String(Date.now());
    const temporaryId = `optimistic-${clientMutationId}`;
    const now = new Date().toISOString();
    const currentUser = store.get().user;
    const optimistic: ChatMessage = {
      id: temporaryId,
      senderId: currentUser?.id ?? '',
      coupleId: store.get().couple?.id ?? '',
      type: selectedPhoto ? 'image' : 'text',
      imageUrl: selectedPhoto ? previewUrl ?? undefined : undefined,
      text,
      senderName: currentUser?.displayName ?? 'Bạn',
      isOwn: true,
      createdAt: now,
      updatedAt: now,
      clientMutationId,
      replyTo: replyAtSend ? {
        messageId: replyAtSend.messageId,
        senderId: '',
        senderName: replyAtSend.senderName,
        type: replyAtSend.type,
        textSnippet: replyAtSend.textSnippet,
        mediaUrl: replyAtSend.mediaThumbnailUrl,
      } : undefined,
    };

    thread.querySelector('.messages-empty')?.remove();
    insertMessage(optimistic);
    scrollToBottom('send');
    sendButton.disabled = true;
    try {
      if (selectedPhoto) {
        const formData = new FormData();
        formData.append('type', 'photo');
        formData.append('file', selectedPhoto, selectedPhoto.name || 'checkin-photo.jpg');
        if (text) formData.append('caption', text);
        if (replyAtSend) formData.append('chatReplyToMessageId', replyAtSend.messageId);
        const result = await createCheckin(formData);
        if (!result.chatMessage) throw new Error('Photo topic was not created');
        replaceTemporaryMessage(temporaryId, result.chatMessage);
      } else {
        const result = await createMessage({
          type: 'text',
          text,
          clientMutationId,
          ...(replyAtSend ? { replyToMessageId: replyAtSend.messageId } : {}),
        });
        replaceTemporaryMessage(temporaryId, result);
      }
      messageInput.value = '';
      clearSelectedPhoto();
      clearPendingReply();
    } catch {
      messageViews.get(temporaryId)?.element.classList.add('message-send-failed');
      if (navigator.onLine === false) {
        await enqueueMessage({
          text,
          file: selectedPhoto ?? undefined,
          fileName: selectedPhoto?.name,
          replyToMessageId: replyAtSend?.messageId,
          clientMutationId,
        });
        showToast('Đã lưu tin nhắn, sẽ tự gửi khi có mạng', 'info');
      } else {
        showToast('Không gửi được tin nhắn, thử lại nhé', 'error');
      }
    } finally {
      sendButton.disabled = false;
    }
  }

  async function onQuoteClick(event: MouseEvent): Promise<void> {
    const quote = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-reply-to-message-id]');
    if (!quote) return;
    const replyToMessageId = quote.dataset.replyToMessageId ?? '';
    let target = messageViews.get(replyToMessageId);
    if (!target) {
      try {
        mergeMessages(await getMessageContext(replyToMessageId), 'older');
        target = messageViews.get(replyToMessageId);
      } catch {
        // Preserve the current thread when a deleted or unavailable context cannot load.
      }
    }
    if (!target) {
      showToast('Tin nhắn gốc chưa được tải', 'info');
      return;
    }
    target.element.scrollIntoView({ behavior: isReducedMotion() ? 'auto' : 'smooth', block: 'center' });
    target.element.classList.add('message-highlight');
    window.setTimeout(() => target.element.classList.remove('message-highlight'), 1_500);
  }

  const onThreadClick = (event: MouseEvent) => void onQuoteClick(event);
  thread.addEventListener('scroll', handleScroll, { passive: true });
  thread.addEventListener('click', onThreadClick);
  indicator.addEventListener('click', () => {
    scrollState.pendingIncomingCount = 0;
    updateIndicator();
    scrollToBottom('follow');
  });
  form.addEventListener('submit', sendMessage);
  window.addEventListener('lovecheck:realtime-event', handleRealtimeEvent);
  const handleAndroidShare = () => { void handlePendingShare(); };
  window.addEventListener('lovecheck:android-share', handleAndroidShare);
  const handleOnline = () => flushOutbox();
  window.addEventListener('online', handleOnline);
  messageInput.addEventListener('input', () => {
    if (!active) return;
    if (typingStopTimer !== null) window.clearTimeout(typingStopTimer);
    if (typingTimer === null) {
      typingTimer = window.setTimeout(() => {
        typingTimer = null;
        void safeTyping(true).catch(() => {});
      }, 250);
    }
    typingStopTimer = window.setTimeout(() => {
      typingStopTimer = null;
      void safeTyping(false).catch(() => {});
    }, 1_500);
  });
  messageInput.addEventListener('focus', () => {
    window.setTimeout(() => {
      scrollToBottom('follow');
    }, 280);
  });
  page.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && pendingReply) clearPendingReply();
  });
  photoButton.addEventListener('click', () => { attachMenu.hidden = !attachMenu.hidden; });
  preview.addEventListener('click', () => {
    if (!previewUrl) return;
    openMessageImageViewer(previewUrl, 'Ảnh đã chọn');
  });
  attachMenu.querySelector('[data-attach="gallery"]')?.addEventListener('click', () => {
    attachMenu.hidden = true;
    photoInput.click();
  });
  attachMenu.querySelector('[data-attach="camera"]')?.addEventListener('click', () => {
    attachMenu.hidden = true;
    openCamera((result) => {
      void (async () => {
        try {
          const processed = await processImage(result.file, { maxSize: 1600, quality: 0.85 });
          revokePreviewUrl(result.preview);
          setSelectedPhoto(processed.file, processed.preview);
        } catch {
          showToast('Không xử lý được ảnh này', 'error');
        }
      })();
    });
  });
  photoInput.addEventListener('change', async () => {
    const source = photoInput.files?.[0];
    if (!source) return;
    try {
      photoButton.disabled = true;
      const processed = await processImage(source, { maxSize: 1600, quality: 0.85 });
      setSelectedPhoto(processed.file, processed.preview);
    } catch {
      showToast('Không xử lý được ảnh này, thử ảnh khác nhé', 'error');
    } finally {
      photoButton.disabled = false;
    }
  });

  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(([entry]) => setNearBottom(entry.isIntersecting), {
      root: thread,
      threshold: 0.9,
    });
    observer.observe(bottomSentinel);
  }

  return {
    element: page,
    activate: () => {
      active = true;
      void safePresence(true).catch(() => {});
      if (!scrollState.initialized) {
        void loadInitialMessages().then(() => focusReplyFromQuery());
      } else {
        startPolling();
        void refreshMessages();
        void focusReplyFromQuery();
      }
      startPolling();
      void handlePendingShare();
      flushOutbox();
    },
    deactivate: () => {
      stopPolling();
      void safeTyping(false).catch(() => {});
      void safePresence(false).catch(() => {});
    },
    destroy: () => {
      active = false;
      stopPolling();
      window.removeEventListener('lovecheck:realtime-event', handleRealtimeEvent);
      window.removeEventListener('lovecheck:android-share', handleAndroidShare);
      window.removeEventListener('online', handleOnline);
      if (typingTimer !== null) window.clearTimeout(typingTimer);
      if (typingStopTimer !== null) window.clearTimeout(typingStopTimer);
      if (scrollFrame !== null) window.cancelAnimationFrame(scrollFrame);
      observer?.disconnect();
      thread.removeEventListener('scroll', handleScroll);
      thread.removeEventListener('click', onThreadClick);
      form.removeEventListener('submit', sendMessage);
      clearSelectedPhoto();
    },
  };
}
