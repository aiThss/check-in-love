import '../../styles/20-pages/chat-layout.css';
import '../../styles/20-pages/chat-bubbles.css';
import '../../styles/20-pages/chat-menus.css';
import { getSharedChatBackground, updateSharedChatBackground } from '../../api/chat-background';
import { createCheckin } from '../../api/checkins';
import { enqueueMessage, flushMessageOutbox, type QueuedMessage } from '../../api/message-outbox';
import { createMessage, getMessageContext, getMessages, mapChatMessage } from '../../api/messages';
import type { ChatBackgroundSnapshot, ChatMessage } from '../../api/types';
import { openCamera, processImage, revokePreviewUrl } from '../../components/camera';
import { openMessageImageViewer } from '../../components/message-image-viewer';
import { closeModal } from '../../components/modal';
import { showToast } from '../../components/toast';
import type { RoutePage } from '../../router';
import { store } from '../../store/index';
import { createSkeleton } from '../../ui/feedback';
import { triggerHaptic } from '../../ui/haptics';
import { iconMarkup } from '../../ui/icons/icons';
import { isReducedMotionActive } from '../../ui/theme/index';
import { createAvatar } from '../../ui/primitives';
import {
  readChatBackground,
  saveChatBackground,
  type ChatBackgroundSelection,
} from '../../utils/message-background';
import {
  createMessageView,
  optionalMessageApiFunction,
  patchView,
  renderReadStatus,
  updateDeliveryIcon,
  wasReadByPartner,
  type BubbleFactoryContext,
  type MessageView,
} from './bubble';
import {
  decorateThreadGrouping,
  escapeHtml,
  formatMessageTime,
  getLatestActivityTime,
  replySummary,
} from './format';
import { createTypingIndicator } from './typing';
import {
  applyChatBackground,
  openChatBackgroundModal,
  selectionFromSharedBackground,
} from './wallpaper';

export { formatMessageTime };

const NEAR_BOTTOM_DISTANCE = 80;
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

  if (document.documentElement.classList.contains('android-wrapper')) {
    const stableViewportHeight = 'var(--app-viewport-height, 100vh)';
    page.style.minHeight = stableViewportHeight;
    page.style.height = stableViewportHeight;
    page.style.maxHeight = stableViewportHeight;
  }

  const stateUser = store.get().user;
  const partnerName = stateUser?.partnerName || 'Người ấy';

  page.innerHTML = `
    <div class="messages-wallpaper-layer" aria-hidden="true"></div>
    <header class="messages-header">
      <div class="messages-header-identity">
        <span class="messages-partner-avatar-slot"></span>
        <div class="messages-header-copy">
          <span class="messages-eyebrow">Hai đứa mình</span>
          <span class="messages-presence" aria-live="polite"></span>
        </div>
      </div>
      <div class="messages-header-menu-wrap">
        <button
          class="messages-menu-button"
          type="button"
          aria-label="Tùy chọn cuộc trò chuyện"
          aria-haspopup="menu"
          aria-expanded="false"
        >
          ${iconMarkup('more', { size: 20 })}
        </button>
        <div class="messages-header-menu" role="menu" hidden>
          <button class="messages-header-menu-item" type="button" role="menuitem" data-messages-action="background">
            ${iconMarkup('palette', { size: 20 })}
            <span>
              <strong>Đổi nền chat</strong>
              <small>Nền mẫu hoặc ảnh trong album</small>
            </span>
          </button>
        </div>
      </div>
    </header>
    <main class="messages-thread" aria-live="polite" aria-label="Cuộc trò chuyện"></main>
    <button class="messages-new-indicator" type="button" hidden aria-live="polite" aria-label="Đến tin nhắn mới nhất"></button>
    <div class="messages-attach-backdrop" hidden></div>
    <form class="messages-composer" autocomplete="off">
      <div class="messages-reply-preview" hidden></div>
      <div class="messages-attach-menu" hidden role="dialog" aria-label="Tùy chọn đính kèm">
        <button type="button" class="messages-attach-item" data-attach="camera">
          <span class="messages-attach-icon">${iconMarkup('camera', { size: 20 })}</span>
          <div class="messages-attach-info">
            <strong>Chụp check-in</strong>
            <small>Mở máy ảnh chụp khoảnh khắc</small>
          </div>
        </button>
        <button type="button" class="messages-attach-item" data-attach="gallery">
          <span class="messages-attach-icon">${iconMarkup('gallery', { size: 20 })}</span>
          <div class="messages-attach-info">
            <strong>Chọn ảnh</strong>
            <small>Từ thư viện ảnh chất lượng 2K</small>
          </div>
        </button>
      </div>
      <div class="messages-composer-row">
        <input id="message-photo" type="file" accept="image/*" hidden />
        <button class="messages-photo-button" type="button" aria-label="Mở tùy chọn đính kèm" aria-expanded="false">
          ${iconMarkup('attach', { size: 20 })}
        </button>
        <div class="messages-input-wrap">
          <div class="messages-photo-preview" hidden></div>
          <textarea
            id="message-input"
            name="chat_message_input"
            rows="1"
            maxlength="1000"
            placeholder="Nhắn điều nhỏ bé cho người ấy..."
            aria-label="Nội dung tin nhắn"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="sentences"
            spellcheck="false"
          ></textarea>
        </div>
        <button class="messages-send" type="submit" aria-label="Gửi tin nhắn">
          ${iconMarkup('send', { size: 20 })}
        </button>
      </div>
    </form>
  `;

  const avatarSlot = page.querySelector<HTMLElement>('.messages-partner-avatar-slot')!;
  avatarSlot.replaceWith(
    createAvatar({
      name: partnerName,
      src: stateUser?.partnerAvatarUrl ?? null,
      size: 'sm',
    }),
  );

  const thread = page.querySelector<HTMLElement>('.messages-thread')!;
  const indicator = page.querySelector<HTMLButtonElement>('.messages-new-indicator')!;
  const form = page.querySelector<HTMLFormElement>('.messages-composer')!;
  const replyPreview = page.querySelector<HTMLElement>('.messages-reply-preview')!;
  const messageInput = page.querySelector<HTMLTextAreaElement>('#message-input')!;
  const photoInput = page.querySelector<HTMLInputElement>('#message-photo')!;
  const photoButton = page.querySelector<HTMLButtonElement>('.messages-photo-button')!;
  const attachBackdrop = page.querySelector<HTMLElement>('.messages-attach-backdrop')!;
  const attachMenu = page.querySelector<HTMLElement>('.messages-attach-menu')!;
  const preview = page.querySelector<HTMLElement>('.messages-photo-preview')!;
  const sendButton = page.querySelector<HTMLButtonElement>('.messages-send')!;
  const presence = page.querySelector<HTMLElement>('.messages-presence')!;
  const headerMenuButton = page.querySelector<HTMLButtonElement>('.messages-menu-button')!;
  const headerMenu = page.querySelector<HTMLElement>('.messages-header-menu')!;
  const backgroundMenuItem = page.querySelector<HTMLButtonElement>('[data-messages-action="background"]')!;

  applyChatBackground(page, readChatBackground());

  const typingIndicator = createTypingIndicator();
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
  let latestRefreshInFlight: Promise<void> | null = null;
  let refreshInFlight: Promise<void> | null = null;
  let indicatorContent = '';
  let sharedBackgroundSyncInFlight: Promise<void> | null = null;

  const isReducedMotion = (): boolean => (
    isReducedMotionActive() || (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  );

  async function commitChatBackground(selection: ChatBackgroundSelection, successMessage: string): Promise<void> {
    const persisted = saveChatBackground(selection);
    applyChatBackground(page, selection);
    closeModal();
    showToast(
      persisted
        ? successMessage
        : `${successMessage} (chỉ áp dụng cho phiên này vì bộ nhớ thiết bị đầy)`,
      persisted ? 'success' : 'info',
    );

    try {
      const response = await updateSharedChatBackground(selection);
      const sharedSelection = selectionFromSharedBackground(response.background);
      if (sharedSelection) {
        saveChatBackground(sharedSelection);
        applyChatBackground(page, sharedSelection);
      }
      if (response.message) {
        mergeMessages([mapChatMessage(response.message)], 'refresh');
      }
    } catch {
      if (persisted) {
        showToast(`${successMessage}; chưa đồng bộ được với người ấy`, 'info');
      }
    }
  }

  async function syncSharedChatBackground(): Promise<void> {
    if (sharedBackgroundSyncInFlight) return sharedBackgroundSyncInFlight;
    sharedBackgroundSyncInFlight = (async () => {
      try {
        const response = await getSharedChatBackground();
        if (!active) return;
        const sharedSelection = selectionFromSharedBackground(response.background);
        if (!sharedSelection) return;
        saveChatBackground(sharedSelection);
        applyChatBackground(page, sharedSelection);
      } catch {
        // Keep local wallpaper fallback.
      } finally {
        sharedBackgroundSyncInFlight = null;
      }
    })();
    return sharedBackgroundSyncInFlight;
  }

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

  function ensureAnchors(): void {
    if (!typingIndicator.element.isConnected) thread.appendChild(typingIndicator.element);
    if (!bottomSentinel.isConnected) thread.appendChild(bottomSentinel);
  }

  function distanceFromBottom(): number {
    return thread.scrollHeight - thread.scrollTop - thread.clientHeight;
  }

  function scrollToMessage(element: HTMLElement): void {
    const threadRect = thread.getBoundingClientRect();
    const messageRect = element.getBoundingClientRect();
    const top = thread.scrollTop + messageRect.top - threadRect.top
      - Math.max(0, (thread.clientHeight - messageRect.height) / 2);
    const boundedTop = Math.max(0, Math.min(top, thread.scrollHeight - thread.clientHeight));
    if (typeof thread.scrollTo === 'function') {
      thread.scrollTo({
        top: boundedTop,
        behavior: isReducedMotion() ? 'auto' : 'smooth',
      });
    } else {
      thread.scrollTop = boundedTop;
    }
  }

  function updateIndicator(): void {
    if (scrollState.isNearBottom && scrollState.pendingIncomingCount === 0) {
      indicator.hidden = true;
      return;
    }

    const count = scrollState.pendingIncomingCount;
    const isScrolledUp = !scrollState.isNearBottom && distanceFromBottom() > NEAR_BOTTOM_DISTANCE;
    const nextContent = count > 0 ? String(count) : isScrolledUp ? 'latest' : '';
    indicator.hidden = !nextContent;
    if (nextContent === indicatorContent) return;
    indicatorContent = nextContent;
    indicator.setAttribute('aria-label', count > 0 ? `${count} tin nhắn mới` : 'Đến tin nhắn mới nhất');

    if (count > 0) {
      indicator.hidden = false;
      indicator.classList.add('has-badge');
      indicator.innerHTML = `
        <span class="indicator-badge">${count}</span>
        <span class="indicator-text">${count === 1 ? '1 tin nhắn mới' : `${count} tin nhắn mới`}</span>
        ${iconMarkup('chevron-down', { size: 16 })}
      `;
    } else if (isScrolledUp && !scrollState.isNearBottom) {
      indicator.hidden = false;
      indicator.classList.remove('has-badge');
      indicator.innerHTML = iconMarkup('chevron-down', { size: 20 });
    } else {
      indicator.hidden = true;
    }
  }

  function setNearBottom(nextValue: boolean): void {
    scrollState.isNearBottom = nextValue;
    if (nextValue) scrollState.pendingIncomingCount = 0;
    updateIndicator();
  }

  function scrollToBottom(mode: 'initial' | 'follow' | 'send' | 'jump' = 'follow'): void {
    const top = thread.scrollHeight;
    setNearBottom(true);
    indicator.hidden = true;
    if (mode === 'initial' || mode === 'follow' || isReducedMotion() || typeof thread.scrollTo !== 'function') {
      thread.scrollTop = top;
      return;
    }
    thread.scrollTo({ top, behavior: 'smooth' });
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
      <button type="button" class="messages-reply-cancel" aria-label="Hủy trả lời tin nhắn">${iconMarkup('close', { size: 16 })}</button>
    `;
    replyPreview.querySelector('button')?.addEventListener('click', clearPendingReply);
    window.requestAnimationFrame(() => messageInput.focus());
  }

  function clearPendingReply(): void {
    pendingReply = null;
    replyPreview.hidden = true;
    replyPreview.replaceChildren();
  }

  const bubbleCtx: BubbleFactoryContext = {
    isActive: () => active,
    isNearBottom: () => scrollState.isNearBottom,
    scrollToBottom,
    scrollToMessage,
    beginReply,
    messages,
    messageViews,
  };

  function insertMessage(item: ChatMessage, position: 'append' | 'prepend' = 'append'): MessageView {
    const view = createMessageView(item, bubbleCtx, pickerStates);
    messageViews.set(item.id, view);
    messages.set(item.id, item);
    ensureAnchors();
    const firstMessage = thread.querySelector<HTMLElement>('[data-message-id]');
    if (position === 'prepend' && firstMessage) {
      thread.insertBefore(view.element, firstMessage);
    } else {
      thread.insertBefore(view.element, typingIndicator.element);
    }
    return view;
  }

  function replaceTemporaryMessage(tempId: string, item: ChatMessage): void {
    const view = messageViews.get(tempId);
    if (!view) {
      insertMessage(item);
      decorateThreadGrouping(thread);
      return;
    }
    messageViews.delete(tempId);
    messages.delete(tempId);
    messageViews.set(item.id, view);
    messages.set(item.id, item);
    patchView(view, item, bubbleCtx);
    decorateThreadGrouping(thread);
  }

  function refreshReadStatuses(): void {
    let latestReadMessage: ChatMessage | undefined;
    for (const item of messages.values()) {
      if (
        !item.systemEvent
        && wasReadByPartner(item)
        && (!latestReadMessage || getLatestActivityTime(item) > getLatestActivityTime(latestReadMessage))
      ) {
        latestReadMessage = item;
      }
    }
    for (const view of messageViews.values()) {
      renderReadStatus(view, view.item, view.item.id === latestReadMessage?.id);
    }
  }

  function mergeMessages(incoming: ChatMessage[], source: 'initial' | 'refresh' | 'older'): number {
    const wasNearBottom = scrollState.isNearBottom;
    let newIncoming = 0;
    let structureChanged = false;
    if (incoming.length === 0) return 0;
    thread.querySelector('.messages-empty')?.remove();
    const sorted = [...incoming].sort((a, b) => getLatestActivityTime(a) - getLatestActivityTime(b));
    if (source === 'older') sorted.reverse();
    sorted.forEach((item) => {
      const existing = messageViews.get(item.id);
      if (existing) {
        patchView(existing, item, bubbleCtx);
        messages.set(item.id, item);
        return;
      }
      const temporary = item.clientMutationId
        ? [...messageViews.entries()].find(([id, view]) => id.startsWith('optimistic-') && view.item.clientMutationId === item.clientMutationId)
        : undefined;
      if (temporary) {
        replaceTemporaryMessage(temporary[0], item);
        structureChanged = true;
        return;
      }
      insertMessage(item, source === 'older' ? 'prepend' : 'append');
      structureChanged = true;
      if (source === 'refresh' && !item.isOwn && !item.systemEvent) newIncoming++;
    });

    if (structureChanged) {
      decorateThreadGrouping(thread);
    }
    refreshReadStatuses();

    if (source === 'initial') {
      scrollToBottom('initial');
    } else if (source === 'refresh' && newIncoming > 0) {
      typingIndicator.setPartnerTyping(false);
      if (wasNearBottom) scrollToBottom('follow');
      else {
        scrollState.pendingIncomingCount += newIncoming;
        updateIndicator();
      }
    }

    if (source !== 'older' && scrollState.isNearBottom) {
      const latest = sorted.at(-1);
      if (latest && !latest.isOwn && !latest.systemEvent && latest.id !== lastReadMessageId) {
        lastReadMessageId = latest.id;
        void safeRead({ upTo: latest.id }).catch(() => {
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
      } catch {}
    }

    if (target) {
      beginReply(target);
      const view = messageViews.get(messageId);
      if (view) scrollToMessage(view.element);
    } else {
      showToast('Không tìm thấy tin nhắn cần trả lời', 'info');
    }

    const url = new URL(window.location.href);
    url.searchParams.delete('replyTo');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }

  async function loadInitialMessages(): Promise<void> {
    const skelWrap = document.createElement('div');
    skelWrap.className = 'messages-loading u-stack-2';
    skelWrap.append(
      createSkeleton({ width: '58%', height: '42px' }),
      createSkeleton({ width: '68%', height: '48px' }),
      createSkeleton({ width: '48%', height: '42px' }),
    );
    thread.replaceChildren(skelWrap);

    try {
      const response = await getMessages({ limit: 50, force: true });
      if (!active) return;
      thread.replaceChildren();
      ensureAnchors();
      if (response.data.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'messages-empty';
        empty.textContent = 'Gửi một điều nhỏ đầu tiên cho người ấy nhé.';
        thread.insertBefore(empty, typingIndicator.element);
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
      thread.append(empty);
      ensureAnchors();
    }
  }

  async function refreshMessages(): Promise<void> {
    if (!scrollState.initialized || !active) return;
    if (latestRefreshInFlight) return latestRefreshInFlight;
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
      try {
        const response = await getMessages({ limit: 50, after: afterCursor ?? undefined, force: true });
        if (active) {
          mergeMessages(response.data, 'refresh');
          afterCursor = response.afterCursor ?? afterCursor;
        }
      } catch {} finally {
        refreshInFlight = null;
      }
    })();
    return refreshInFlight;
  }

  async function refreshLatestMessages(): Promise<void> {
    if (!scrollState.initialized || !active) return;
    if (latestRefreshInFlight) return latestRefreshInFlight;

    latestRefreshInFlight = (async () => {
      try {
        if (refreshInFlight) await refreshInFlight;
        if (!active) return;
        const response = await getMessages({ limit: 50, force: true });
        if (!active) return;
        mergeMessages(response.data, 'refresh');
        afterCursor = response.afterCursor ?? afterCursor;
      } catch {} finally {
        latestRefreshInFlight = null;
      }
    })();

    return latestRefreshInFlight;
  }

  async function loadOlderMessages(): Promise<void> {
    if (!hasMoreOlder || !beforeCursor || scrollState.isLoadingOlder) return;
    scrollState.isLoadingOlder = true;
    const previousHeight = thread.scrollHeight;
    const previousTop = thread.scrollTop;
    try {
      const response = await getMessages({ limit: 50, before: beforeCursor, force: true });
      if (!active) return;
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
      if (thread.scrollTop <= 32) void loadOlderMessages();
    });
  }

  function startPolling(): void {
    if (pollTimer !== null || !active || document.visibilityState === 'hidden') return;
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
    if (!active) return;
    const data = (event as CustomEvent).detail as {
      type?: string;
      isTyping?: boolean;
      online?: boolean;
      senderName?: string;
      messageId?: string;
      deleted?: boolean;
      chatBackground?: ChatBackgroundSnapshot;
    } | undefined;
    if (!data) return;

    if (data.type === 'message.typing') {
      const typing = Boolean(data.isTyping);
      presence.textContent = typing ? `${data.senderName || partnerName} đang nhập...` : (partnerOnline ? 'Đang hoạt động' : '');
      presence.classList.toggle('typing', typing);
      typingIndicator.setPartnerTyping(typing);
      if (typing && scrollState.isNearBottom) scrollToBottom('follow');
      return;
    }
    if (data.type === 'message.presence') {
      partnerOnline = Boolean(data.online);
      presence.textContent = partnerOnline ? 'Đang hoạt động' : 'Đã offline';
      presence.classList.toggle('typing', false);
      return;
    }
    if (data.type === 'chat.background.updated') {
      const sharedSelection = selectionFromSharedBackground(data.chatBackground);
      if (sharedSelection) {
        saveChatBackground(sharedSelection);
        applyChatBackground(page, sharedSelection);
      }
      void refreshLatestMessages();
      return;
    }
    if (((data.type === 'message.updated' && data.deleted) || data.type === 'message.deleted') && data.messageId) {
      messageViews.get(data.messageId)?.element.remove();
      messageViews.delete(data.messageId);
      messages.delete(data.messageId);
      decorateThreadGrouping(thread);
      return;
    }
    if (data.type === 'message' || data.type === 'reply' || data.type?.startsWith('message.')) {
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
    preview.innerHTML = `
      <div class="messages-photo-preview-body" role="button" tabindex="0" aria-label="Xem ảnh phóng to">
        <img src="${escapeHtml(previewSource)}" alt="Ảnh đã chọn" />
        <span>Ảnh đã chọn</span>
      </div>
      <button type="button" class="messages-photo-remove" aria-label="Bỏ chọn ảnh" title="Bỏ ảnh">${iconMarkup('close', { size: 16 })}</button>
    `;
    preview.hidden = false;
  }

  async function sendMessage(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (sendButton.disabled) return;
    const text = messageInput.value.trim();
    if (!text && !selectedPhoto) return;

    triggerHaptic('tap');
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
    decorateThreadGrouping(thread);
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
      resetInputHeight();
      clearSelectedPhoto();
      clearPendingReply();
    } catch {
      const failedView = messageViews.get(temporaryId);
      if (failedView) {
        failedView.element.classList.add('message-send-failed');
        updateDeliveryIcon(failedView);
      }
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
      } catch {}
    }
    if (!target) {
      showToast('Tin nhắn gốc chưa được tải', 'info');
      return;
    }
    scrollToMessage(target.element);
    target.element.classList.add('message-highlight');
    window.setTimeout(() => target?.element.classList.remove('message-highlight'), 1_500);
  }

  const onThreadClick = (event: MouseEvent) => void onQuoteClick(event);
  thread.addEventListener('scroll', handleScroll, { passive: true });
  thread.addEventListener('click', onThreadClick);
  indicator.addEventListener('click', () => {
    scrollState.pendingIncomingCount = 0;
    updateIndicator();
    scrollToBottom('jump');
  });

  const preserveComposerFocus = (event: MouseEvent) => {
    if (event.button === 0 && document.activeElement === messageInput) {
      event.preventDefault();
    }
  };
  sendButton.addEventListener('pointerdown', preserveComposerFocus);
  sendButton.addEventListener('mousedown', preserveComposerFocus);
  form.addEventListener('submit', sendMessage);

  // Drag & Drop image support onto page/composer
  page.addEventListener('dragover', (e) => {
    if (e.dataTransfer?.types.includes('Files')) {
      e.preventDefault();
      form.classList.add('is-drag-over');
    }
  });
  page.addEventListener('dragleave', () => form.classList.remove('is-drag-over'));
  page.addEventListener('drop', async (e) => {
    form.classList.remove('is-drag-over');
    const file = Array.from(e.dataTransfer?.files ?? []).find((f) => f.type.startsWith('image/'));
    if (!file) return;
    e.preventDefault();
    try {
      const processed = await processImage(file, { maxSize: 2560, quality: 0.92 });
      setSelectedPhoto(processed.file, processed.preview);
    } catch {
      showToast('Không xử lý được ảnh kéo thả', 'error');
    }
  });

  window.addEventListener('lovecheck:realtime-event', handleRealtimeEvent);
  const handleAndroidShare = () => { void handlePendingShare(); };
  window.addEventListener('lovecheck:android-share', handleAndroidShare);
  const handleOnline = () => {
    flushOutbox();
    if (active) {
      void refreshLatestMessages();
      void syncSharedChatBackground();
    }
  };
  const handleVisibilityChange = () => {
    if (document.visibilityState !== 'visible') {
      stopPolling();
      return;
    }
    if (!active) return;
    startPolling();
    void refreshLatestMessages();
    void syncSharedChatBackground();
    flushOutbox();
  };
  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  let inputResizeFrame: number | null = null;
  const autoExpandInput = () => {
    if (inputResizeFrame !== null) return;
    inputResizeFrame = window.requestAnimationFrame(() => {
      inputResizeFrame = null;
      messageInput.style.height = 'auto';
      const contentHeight = messageInput.scrollHeight;
      const nextHeight = Math.min(contentHeight, 120);
      messageInput.style.height = `${Math.max(24, nextHeight)}px`;
      messageInput.style.overflowY = contentHeight > 120 ? 'auto' : 'hidden';
    });
  };
  const resetInputHeight = () => {
    if (inputResizeFrame !== null) {
      window.cancelAnimationFrame(inputResizeFrame);
      inputResizeFrame = null;
    }
    messageInput.style.height = '24px';
    messageInput.style.overflowY = 'hidden';
  };

  let composerResizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    composerResizeObserver = new ResizeObserver(([entry]) => {
      const borderBoxHeight = entry?.borderBoxSize?.[0]?.blockSize;
      const height = Math.ceil(
        borderBoxHeight || form.getBoundingClientRect().height || entry?.contentRect.height || 0,
      );
      if (height > 0) page.style.setProperty('--messages-composer-height', `${height}px`);
    });
    composerResizeObserver.observe(form);
  }

  const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  messageInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && !e.shiftKey && !isTouchDevice) {
      e.preventDefault();
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    } else if (e.key === 'Backspace' && messageInput.value === '' && selectedPhoto) {
      clearSelectedPhoto();
      triggerHaptic('tap');
    }
  });

  messageInput.addEventListener('input', () => {
    autoExpandInput();
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

  const closeHeaderMenu = () => {
    headerMenu.hidden = true;
    headerMenuButton.setAttribute('aria-expanded', 'false');
  };
  const onHeaderMenuButtonClick = () => {
    const nextHidden = !headerMenu.hidden;
    headerMenu.hidden = nextHidden;
    headerMenuButton.setAttribute('aria-expanded', String(!nextHidden));
  };
  const onHeaderMenuItemClick = () => {
    closeHeaderMenu();
    openChatBackgroundModal(commitChatBackground);
  };
  const onPageClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('.messages-header-menu-wrap')) {
      closeHeaderMenu();
    }
  };
  const onPageKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    closeHeaderMenu();
    closeAttachMenu();
    if (pendingReply) clearPendingReply();
  };
  headerMenuButton.addEventListener('click', onHeaderMenuButtonClick);
  backgroundMenuItem.addEventListener('click', onHeaderMenuItemClick);
  page.addEventListener('click', onPageClick);
  page.addEventListener('keydown', onPageKeyDown);

  const openAttachMenu = () => {
    photoButton.setAttribute('aria-expanded', 'true');
    attachBackdrop.hidden = false;
    attachMenu.hidden = false;
    triggerHaptic('tap');
  };
  const closeAttachMenu = () => {
    photoButton.setAttribute('aria-expanded', 'false');
    attachBackdrop.hidden = true;
    attachMenu.hidden = true;
  };

  photoButton.addEventListener('click', () => {
    if (attachMenu.hidden) openAttachMenu();
    else closeAttachMenu();
  });
  attachBackdrop.addEventListener('click', closeAttachMenu);

  preview.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('.messages-photo-remove')) {
      event.stopPropagation();
      clearSelectedPhoto();
      triggerHaptic('tap');
      return;
    }
    if (!previewUrl) return;
    openMessageImageViewer(previewUrl, 'Ảnh đã chọn');
  });

  attachMenu.querySelector('[data-attach="gallery"]')?.addEventListener('click', () => {
    closeAttachMenu();
    photoInput.click();
  });
  attachMenu.querySelector('[data-attach="camera"]')?.addEventListener('click', () => {
    closeAttachMenu();
    openCamera((result) => {
      void (async () => {
        try {
          const processed = await processImage(result.file, { maxSize: 2560, quality: 0.92 });
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
      const processed = await processImage(source, { maxSize: 2560, quality: 0.92 });
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
      void syncSharedChatBackground();
      void safePresence(true).catch(() => {});
      if (!scrollState.initialized) {
        void loadInitialMessages().then(() => focusReplyFromQuery());
      } else {
        startPolling();
        void refreshLatestMessages();
        void focusReplyFromQuery();
      }
      startPolling();
      void handlePendingShare();
      flushOutbox();
    },
    deactivate: () => {
      active = false;
      stopPolling();
      typingIndicator.setPartnerTyping(false);
      if (typingTimer !== null) window.clearTimeout(typingTimer);
      if (typingStopTimer !== null) window.clearTimeout(typingStopTimer);
      typingTimer = typingStopTimer = null;
      void safeTyping(false).catch(() => {});
      void safePresence(false).catch(() => {});
    },
    destroy: () => {
      active = false;
      stopPolling();
      typingIndicator.destroy();
      window.removeEventListener('lovecheck:realtime-event', handleRealtimeEvent);
      window.removeEventListener('lovecheck:android-share', handleAndroidShare);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (typingTimer !== null) window.clearTimeout(typingTimer);
      if (typingStopTimer !== null) window.clearTimeout(typingStopTimer);
      if (scrollFrame !== null) window.cancelAnimationFrame(scrollFrame);
      if (inputResizeFrame !== null) window.cancelAnimationFrame(inputResizeFrame);
      composerResizeObserver?.disconnect();
      observer?.disconnect();
      thread.removeEventListener('scroll', handleScroll);
      thread.removeEventListener('click', onThreadClick);
      form.removeEventListener('submit', sendMessage);
      sendButton.removeEventListener('pointerdown', preserveComposerFocus);
      sendButton.removeEventListener('mousedown', preserveComposerFocus);
      headerMenuButton.removeEventListener('click', onHeaderMenuButtonClick);
      backgroundMenuItem.removeEventListener('click', onHeaderMenuItemClick);
      page.removeEventListener('click', onPageClick);
      page.removeEventListener('keydown', onPageKeyDown);
      clearSelectedPhoto();
    },
  };
}
