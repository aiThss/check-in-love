import { createCheckin, getCheckins } from '../api/checkins';
import { openCamera, processImage, revokePreviewUrl } from '../components/camera';
import { showToast } from '../components/toast';
import type { CheckIn } from '../api/types';
import type { RoutePage } from '../router';
import { store } from '../store/index';

const MESSAGE_START_KEY = 'lovecheck_messages_started_at_v2';
const NEAR_BOTTOM_DISTANCE = 80;
const SWIPE_INTENT_DISTANCE = 10;
const SWIPE_REPLY_THRESHOLD = 56;
const SWIPE_MAX_TRANSLATE = 76;
const POLL_INTERVAL = 10_000;

interface PendingReply {
  messageId: string;
  senderName: string;
  type: CheckIn['type'];
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
  item: CheckIn;
  element: HTMLElement;
  bubble: HTMLElement;
  content: HTMLParagraphElement;
  quote: HTMLButtonElement | null;
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

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function getLatestActivityTime(item: CheckIn): number {
  const replyTimes = (item.replies ?? []).map((reply) => new Date(reply.createdAt).getTime());
  return Math.max(new Date(item.createdAt).getTime(), ...replyTimes);
}

function messageText(item: CheckIn): string {
  return item.caption || (item.type === 'mood' ? 'Đang gửi một cảm xúc' : '');
}

function isReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function clampSwipe(distance: number): number {
  if (distance <= SWIPE_MAX_TRANSLATE) return distance;
  return SWIPE_MAX_TRANSLATE + (distance - SWIPE_MAX_TRANSLATE) * 0.18;
}

export function renderMessagesPage(): RoutePage {
  const page = document.createElement('div');
  page.className = 'page messages-page animate-fade-in';
  page.innerHTML = `
    <header class="messages-header">
      <div>
        <span class="messages-eyebrow">Hai đứa mình</span>
        <h1>Tin nhắn</h1>
      </div>
    </header>
    <main class="messages-thread" aria-live="polite" aria-label="Cuộc trò chuyện"></main>
    <button class="messages-new-indicator" type="button" hidden aria-live="polite"></button>
    <form class="messages-composer">
      <div class="messages-reply-preview" hidden></div>
      <div class="messages-composer-row">
        <input id="message-photo" type="file" accept="image/*" hidden />
        <button class="messages-photo-button" type="button" aria-label="Mở tùy chọn đính kèm">+</button>
        <div class="messages-attach-menu" hidden>
          <button type="button" data-attach="gallery">Chọn ảnh</button>
          <button type="button" data-attach="camera">Chụp check-in</button>
        </div>
        <div class="messages-input-wrap">
          <span class="messages-photo-preview" hidden>Ảnh đã chọn</span>
          <input id="message-input" maxlength="280" placeholder="Gửi tin nhắn..." aria-label="Nội dung tin nhắn" />
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
  const messages = new Map<string, CheckIn>();
  const messageStartedAt = localStorage.getItem(MESSAGE_START_KEY) ?? new Date().toISOString();
  let selectedPhoto: File | null = null;
  let previewUrl: string | null = null;
  let pendingReply: PendingReply | null = null;
  let nextPage = 2;
  let hasMore = false;
  let active = false;
  let pollTimer: number | null = null;
  let scrollFrame: number | null = null;
  let observer: IntersectionObserver | null = null;

  localStorage.setItem(MESSAGE_START_KEY, messageStartedAt);

  function ensureSentinel(): void {
    if (!bottomSentinel.isConnected) thread.appendChild(bottomSentinel);
  }

  function distanceFromBottom(): number {
    return thread.scrollHeight - thread.scrollTop - thread.clientHeight;
  }

  function updateIndicator(): void {
    const count = scrollState.pendingIncomingCount;
    indicator.hidden = count === 0;
    indicator.textContent = count === 1 ? '1 tin nhắn mới' : `${count} tin nhắn mới`;
  }

  function setNearBottom(nextValue: boolean): void {
    scrollState.isNearBottom = nextValue;
    if (nextValue && scrollState.pendingIncomingCount > 0) {
      scrollState.pendingIncomingCount = 0;
      updateIndicator();
    }
  }

  function scrollToBottom(mode: 'initial' | 'follow' | 'send' = 'follow'): void {
    const top = thread.scrollHeight;
    setNearBottom(true);
    if (mode === 'initial' || isReducedMotion() || typeof thread.scrollTo !== 'function') {
      thread.scrollTop = top;
      return;
    }
    thread.scrollTo({ top, behavior: 'smooth' });
  }

  function replySummary(item: CheckIn): string {
    return messageText(item) || (item.photoUrl ? 'Ảnh' : 'Tin nhắn');
  }

  function createQuote(item: CheckIn): HTMLButtonElement | null {
    if (!item.replyTo) return null;
    const quote = document.createElement('button');
    quote.type = 'button';
    quote.className = 'message-quote';
    quote.dataset.replyToMessageId = item.replyTo.messageId;
    quote.setAttribute('aria-label', `Đi tới tin nhắn của ${item.replyTo.senderName}`);
    quote.innerHTML = `<strong>${escapeHtml(item.replyTo.senderName)}</strong><span>${escapeHtml(item.replyTo.textSnippet || (item.replyTo.mediaUrl ? 'Ảnh' : 'Tin nhắn'))}</span>`;
    return quote;
  }

  function appendReplyBubbles(view: MessageView): void {
    const replies = view.item.replies ?? [];
    replies.forEach((reply, index) => {
      const key = `${reply.userId}:${reply.createdAt}:${index}`;
      if (view.replyKeys.has(key)) return;
      view.replyKeys.add(key);
      const bubble = document.createElement('article');
      bubble.className = `chat-reply${reply.isOwn ? ' own' : ''}`;
      bubble.dataset.messageId = view.item.id;
      bubble.innerHTML = `<div class="chat-reply-bubble"><p>${escapeHtml(reply.message)}</p></div><time>${formatTime(reply.createdAt)}</time>`;
      bubble.addEventListener('click', () => bubble.classList.toggle('show-timestamp'));
      view.element.appendChild(bubble);
    });
  }

  function patchView(view: MessageView, item: CheckIn): void {
    view.item = item;
    view.element.dataset.messageId = item.id;
    view.element.classList.toggle('own', item.isOwn);
    view.content.textContent = messageText(item);
    view.content.hidden = !messageText(item);
    const image = view.bubble.querySelector<HTMLImageElement>('img');
    if (image && item.photoUrl && image.src !== item.photoUrl) image.src = item.photoUrl;

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
    appendReplyBubbles(view);
  }

  function beginReply(item: CheckIn): void {
    pendingReply = {
      messageId: item.id,
      senderName: item.ownerName,
      type: item.type,
      textSnippet: replySummary(item),
      mediaThumbnailUrl: item.photoUrl,
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

  function createView(item: CheckIn): MessageView {
    const hasPhoto = Boolean(item.photoUrl);
    const element = document.createElement(hasPhoto ? 'section' : 'article');
    element.className = hasPhoto
      ? 'chat-checkin-group'
      : `chat-text-message${item.isOwn ? ' own' : ''}`;
    element.dataset.messageId = item.id;

    const primary = hasPhoto ? document.createElement('article') : element;
    if (hasPhoto) {
      primary.className = 'chat-checkin';
      element.appendChild(primary);
    }
    const bubble = document.createElement('div');
    bubble.className = hasPhoto ? 'chat-bubble has-photo' : 'chat-text-bubble';
    const quote = createQuote(item);
    if (quote) bubble.appendChild(quote);
    if (hasPhoto) {
      const image = document.createElement('img');
      image.src = item.photoUrl!;
      image.alt = 'Ảnh check-in';
      image.loading = 'lazy';
      image.addEventListener('load', () => {
        // The fixed aspect ratio prevents layout shift; never force-scroll a reader upward in history.
        if (scrollState.isNearBottom) scrollToBottom('follow');
      });
      bubble.appendChild(image);
    }
    const content = document.createElement('p');
    content.textContent = messageText(item);
    content.hidden = !content.textContent;
    bubble.appendChild(content);
    primary.appendChild(bubble);
    const time = document.createElement('time');
    time.textContent = formatTime(item.createdAt);
    primary.appendChild(time);

    const replyAction = document.createElement('button');
    replyAction.type = 'button';
    replyAction.className = 'message-reply-action';
    replyAction.textContent = '↩';
    replyAction.setAttribute('aria-label', `Trả lời tin nhắn của ${item.ownerName}`);
    primary.appendChild(replyAction);

    const view: MessageView = { item, element, bubble, content, quote, replyKeys: new Set() };
    replyAction.addEventListener('click', (event) => {
      event.stopPropagation();
      beginReply(view.item);
    });
    primary.addEventListener('click', () => element.classList.toggle('show-timestamp'));
    installSwipeReply(view);
    appendReplyBubbles(view);
    return view;
  }

  function insertMessage(item: CheckIn, position: 'append' | 'prepend' = 'append'): MessageView {
    const view = createView(item);
    messageViews.set(item.id, view);
    messages.set(item.id, item);
    const firstMessage = thread.querySelector<HTMLElement>('[data-message-id]');
    if (position === 'prepend' && firstMessage) thread.insertBefore(view.element, firstMessage);
    else thread.insertBefore(view.element, bottomSentinel);
    return view;
  }

  function replaceTemporaryMessage(tempId: string, item: CheckIn): void {
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

  function mergeMessages(incoming: CheckIn[], source: 'initial' | 'refresh' | 'older'): number {
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
      insertMessage(item, source === 'older' ? 'prepend' : 'append');
      if (source === 'refresh' && !item.isOwn) newIncoming++;
    });

    if (source === 'initial') {
      scrollToBottom('initial');
    } else if (source === 'refresh' && newIncoming > 0) {
      if (wasNearBottom) scrollToBottom('follow');
      else {
        scrollState.pendingIncomingCount += newIncoming;
        updateIndicator();
      }
    }
    return newIncoming;
  }

  async function loadInitialMessages(): Promise<void> {
    thread.replaceChildren(document.createElement('div'));
    thread.firstElementChild?.classList.add('messages-loading', 'skeleton');
    try {
      const response = await getCheckins(1, 50, messageStartedAt, undefined, { force: true });
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
      hasMore = response.hasMore;
      nextPage = 2;
      scrollState.initialized = true;
    } catch {
      thread.replaceChildren();
      const empty = document.createElement('p');
      empty.className = 'messages-empty';
      empty.textContent = 'Chưa tải được tin nhắn. Hãy thử lại nhé.';
      thread.append(empty, bottomSentinel);
    }
  }

  async function refreshMessages(): Promise<void> {
    if (!scrollState.initialized || !active) return;
    try {
      const response = await getCheckins(1, 50, messageStartedAt, undefined, { force: true });
      if (active) mergeMessages(response.data, 'refresh');
    } catch {
      // Keep the existing conversation visible while a background refresh fails.
    }
  }

  async function loadOlderMessages(): Promise<void> {
    if (!hasMore || scrollState.isLoadingOlder) return;
    scrollState.isLoadingOlder = true;
    const previousHeight = thread.scrollHeight;
    const previousTop = thread.scrollTop;
    try {
      const response = await getCheckins(nextPage, 50, messageStartedAt, undefined, { force: true });
      mergeMessages(response.data, 'older');
      thread.scrollTop = previousTop + (thread.scrollHeight - previousHeight);
      nextPage++;
      hasMore = response.hasMore;
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
    if (pollTimer !== null) return;
    pollTimer = window.setInterval(() => void refreshMessages(), POLL_INTERVAL);
  }

  function stopPolling(): void {
    if (pollTimer === null) return;
    window.clearInterval(pollTimer);
    pollTimer = null;
  }

  function clearSelectedPhoto(): void {
    selectedPhoto = null;
    revokePreviewUrl(previewUrl);
    previewUrl = null;
    preview.hidden = true;
    preview.textContent = '';
    photoInput.value = '';
  }

  async function sendMessage(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const text = messageInput.value.trim();
    if (!text && !selectedPhoto) return;

    const replyAtSend = pendingReply;
    const temporaryId = `optimistic-${crypto.randomUUID?.() ?? Date.now()}`;
    const now = new Date().toISOString();
    const currentUser = store.get().user;
    const optimistic: CheckIn = {
      id: temporaryId,
      userId: currentUser?.id ?? '',
      coupleId: store.get().couple?.id ?? '',
      type: selectedPhoto ? 'photo' : 'text',
      photoUrl: selectedPhoto ? previewUrl ?? undefined : undefined,
      caption: text,
      reactions: [],
      replies: [],
      ownerName: currentUser?.displayName ?? 'Bạn',
      isOwn: true,
      createdAt: now,
      updatedAt: now,
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
        formData.append('file', selectedPhoto, selectedPhoto.name || 'message-photo.jpg');
        if (text) formData.append('caption', text);
        if (replyAtSend) formData.append('replyToMessageId', replyAtSend.messageId);
        const result = await createCheckin(formData);
        replaceTemporaryMessage(temporaryId, result.checkIn);
      } else {
        const result = await createCheckin({
          type: 'text',
          caption: text,
          ...(replyAtSend ? { replyToMessageId: replyAtSend.messageId } : {}),
        });
        replaceTemporaryMessage(temporaryId, result.checkIn);
      }
      messageInput.value = '';
      clearSelectedPhoto();
      clearPendingReply();
    } catch {
      messageViews.get(temporaryId)?.element.classList.add('message-send-failed');
      showToast('Không gửi được tin nhắn, thử lại nhé', 'error');
    } finally {
      sendButton.disabled = false;
    }
  }

  function onQuoteClick(event: MouseEvent): void {
    const quote = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-reply-to-message-id]');
    if (!quote) return;
    const target = messageViews.get(quote.dataset.replyToMessageId ?? '');
    if (!target) {
      showToast('Tin nhắn gốc chưa được tải', 'info');
      return;
    }
    target.element.scrollIntoView({ behavior: isReducedMotion() ? 'auto' : 'smooth', block: 'center' });
    target.element.classList.add('message-highlight');
    window.setTimeout(() => target.element.classList.remove('message-highlight'), 1_500);
  }

  thread.addEventListener('scroll', handleScroll, { passive: true });
  thread.addEventListener('click', onQuoteClick);
  indicator.addEventListener('click', () => {
    scrollState.pendingIncomingCount = 0;
    updateIndicator();
    scrollToBottom('follow');
  });
  form.addEventListener('submit', sendMessage);
  page.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && pendingReply) clearPendingReply();
  });
  photoButton.addEventListener('click', () => { attachMenu.hidden = !attachMenu.hidden; });
  attachMenu.querySelector('[data-attach="gallery"]')?.addEventListener('click', () => {
    attachMenu.hidden = true;
    photoInput.click();
  });
  attachMenu.querySelector('[data-attach="camera"]')?.addEventListener('click', () => {
    attachMenu.hidden = true;
    openCamera((result) => {
      void (async () => {
        try {
          const processed = await processImage(result.file, { aspectRatio: 1, maxSize: 1600, quality: 0.85 });
          revokePreviewUrl(result.preview);
          clearSelectedPhoto();
          selectedPhoto = processed.file;
          preview.textContent = 'Ảnh đã chọn';
          preview.hidden = false;
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
      const processed = await processImage(source, { aspectRatio: 1, maxSize: 1600, quality: 0.85 });
      clearSelectedPhoto();
      selectedPhoto = processed.file;
      previewUrl = processed.preview;
      preview.textContent = 'Ảnh đã chọn';
      preview.hidden = false;
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
      if (!scrollState.initialized) void loadInitialMessages();
      else {
        startPolling();
        void refreshMessages();
      }
      startPolling();
    },
    deactivate: () => stopPolling(),
    destroy: () => {
      active = false;
      stopPolling();
      if (scrollFrame !== null) window.cancelAnimationFrame(scrollFrame);
      observer?.disconnect();
      thread.removeEventListener('scroll', handleScroll);
      thread.removeEventListener('click', onQuoteClick);
      form.removeEventListener('submit', sendMessage);
      clearSelectedPhoto();
    },
  };
}
