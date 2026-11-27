import * as messageApi from '../../api/messages';
import type { ChatMessage } from '../../api/types';
import { openMessageImageViewer } from '../../components/message-image-viewer';
import { showToast } from '../../components/toast';
import { navigate } from '../../router';
import { store } from '../../store/index';
import { createField } from '../../ui/forms';
import { triggerHaptic } from '../../ui/haptics';
import { icon, type IconName } from '../../ui/icons/icons';
import { openDialog } from '../../ui/overlays';
import { formatMessageTime, isEmojiOnlyText, messageText } from './format';

const SWIPE_INTENT_DISTANCE = 10;
const SWIPE_REPLY_THRESHOLD = 56;
const SWIPE_MAX_TRANSLATE = 76;

export const QUICK_REACTION_ITEMS: ReadonlyArray<{ key: string; label: string }> = [
  { key: '❤️', label: 'Thả tim' },
  { key: '🥰', label: 'Thương thương' },
  { key: '😘', label: 'Hôn' },
  { key: '😂', label: 'Haha' },
  { key: '😮', label: 'Bất ngờ' },
  { key: '😢', label: 'Thương quá' },
  { key: '🔥', label: 'Bùng cháy' },
];

export interface MessageView {
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
  deliveryIcon: HTMLElement | null;
  replyKeys: Set<string>;
  systemEvent?: boolean;
}

export interface BubbleFactoryContext {
  isActive: () => boolean;
  isNearBottom: () => boolean;
  scrollToBottom: (mode: 'follow' | 'send') => void;
  scrollToMessage: (el: HTMLElement) => void;
  beginReply: (item: ChatMessage) => void;
  messages: Map<string, ChatMessage>;
  messageViews: Map<string, MessageView>;
}

export function optionalMessageApiFunction(name: string): ((...args: any[]) => any) | undefined {
  try {
    return (messageApi as unknown as Record<string, unknown>)[name] as ((...args: any[]) => any) | undefined;
  } catch {
    return undefined;
  }
}

function clampSwipe(distance: number): number {
  if (distance <= SWIPE_MAX_TRANSLATE) return distance;
  return SWIPE_MAX_TRANSLATE + (distance - SWIPE_MAX_TRANSLATE) * 0.18;
}

export function wasReadByPartner(item: ChatMessage): boolean {
  if (!item.isOwn || !item.readBy?.length) return false;
  const currentUserId = store.get().user?.id;
  return item.readBy.some((userId) => userId !== currentUserId);
}

function resolveDeliveryState(item: ChatMessage, failed: boolean): { iconName: IconName; isRead: boolean } {
  if (failed) return { iconName: 'alert', isRead: false };
  if (item.id.startsWith('optimistic-')) return { iconName: 'clock', isRead: false };
  if (wasReadByPartner(item)) return { iconName: 'double-check', isRead: true };
  return { iconName: 'check', isRead: false };
}

export function updateDeliveryIcon(view: MessageView): void {
  if (!view.deliveryIcon || !view.item.isOwn || view.systemEvent) return;
  const failed = view.element.classList.contains('message-send-failed');
  const { iconName, isRead } = resolveDeliveryState(view.item, failed);
  view.deliveryIcon.classList.toggle('is-read', isRead);
  const existingSvg = view.deliveryIcon.querySelector<SVGSVGElement>('svg[data-cil-icon]');
  if (existingSvg?.dataset.cilIcon === iconName) return;
  view.deliveryIcon.replaceChildren(icon(iconName, { size: 16 }));
}

export function renderReadStatus(view: MessageView, _item: ChatMessage, visible = false): void {
  if (view.systemEvent) return;
  updateDeliveryIcon(view);
  if (view.readStatus.hidden === !visible && view.readStatus.textContent === (visible ? 'Đã đọc' : '')) return;
  view.readStatus.hidden = !visible;
  view.readStatus.textContent = visible ? 'Đã đọc' : '';
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

function createReferencedCheckin(item: ChatMessage, ctx: BubbleFactoryContext): HTMLButtonElement | null {
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
    let targetView: MessageView | undefined;
    if (reference.imageUrl) {
      for (const view of ctx.messageViews.values()) {
        if (view.item.id !== item.id && view.item.imageUrl && view.item.imageUrl === reference.imageUrl) {
          targetView = view;
          break;
        }
      }
    }

    if (targetView) {
      ctx.scrollToMessage(targetView.element);
      targetView.element.classList.add('message-highlight');
      window.setTimeout(() => targetView?.element.classList.remove('message-highlight'), 1_500);
    } else if (reference.imageUrl) {
      const imageUrl = reference.imageUrl;
      void import('../../components/polaroid-cover').then(({ openPolaroidCoverModal }) => {
        if (!ctx.isActive()) return;
        openPolaroidCoverModal({
          imageUrl,
          title: reference.caption || `Kỷ niệm của ${reference.ownerName}`,
          dateText: `${reference.ownerName} · Kỷ niệm`,
          forceScratch: false,
        });
      }).catch(() => showToast('Chưa mở được ảnh, thử lại nhé', 'error'));
    } else {
      navigate('/app/memories');
    }
  });
  return card;
}

export function renderReactions(view: MessageView, item: ChatMessage, ctx: BubbleFactoryContext): void {
  if (view.systemEvent) return;
  view.reactions.replaceChildren();
  for (const reaction of item.reactions ?? []) {
    if (reaction.count <= 0) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `message-reaction${reaction.reactedByMe ? ' reacted' : ''}`;
    button.textContent = `${reaction.type}${reaction.count > 1 ? ` ${reaction.count}` : ''}`;
    button.setAttribute('aria-label', `${reaction.type} ${reaction.count}`);
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      triggerHaptic('tap');
      const toggleReaction = optionalMessageApiFunction('toggleMessageReaction');
      const request = toggleReaction
        ? toggleReaction(item.id, reaction.type)
        : Promise.resolve([]);
      void request
        .then((reactions: ChatMessage['reactions'] = []) => {
          const latest = ctx.messages.get(item.id);
          if (!latest) return;
          latest.reactions = reactions;
          renderReactions(view, latest, ctx);
        })
        .catch(() => showToast('Chưa cập nhật được cảm xúc', 'error'));
    });
    view.reactions.appendChild(button);
  }
  view.reactions.hidden = view.reactions.childElementCount === 0;
}

export function renderEditHistory(view: MessageView, item: ChatMessage): void {
  if (view.systemEvent) return;
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

const STICKER_URL_MARKER = 'lc-media=sticker';

export function isStickerMessage(item: Pick<ChatMessage, 'type' | 'imageUrl'>): boolean {
  return (
    (item.type as string) === 'sticker' ||
    Boolean(item.imageUrl?.includes(STICKER_URL_MARKER)) ||
    Boolean(item.imageUrl && /\/(chat-)?stickers\//i.test(item.imageUrl))
  );
}

export function patchView(view: MessageView, item: ChatMessage, ctx: BubbleFactoryContext): void {
  if (JSON.stringify(view.item) === JSON.stringify(item)) return;
  view.item = item;
  view.element.dataset.messageId = item.id;
  view.element.dataset.messageCreatedAt = item.createdAt;
  view.element.classList.toggle('own', item.isOwn);
  view.element.classList.remove('message-send-failed');

  if (view.systemEvent) {
    view.content.textContent = messageText(item);
    view.time.textContent = formatMessageTime(item.createdAt);
    view.time.dateTime = item.createdAt;
    view.time.title = new Date(item.createdAt).toLocaleString('vi-VN');
    return;
  }

  const isSticker = Boolean(item.imageUrl) && isStickerMessage(item);
  view.element.classList.toggle('chat-sticker-message', isSticker);
  view.bubble.classList.toggle('is-sticker', isSticker);

  const text = messageText(item);
  view.content.textContent = text;
  view.content.hidden = !text;
  view.element.classList.toggle('is-emoji-only', !item.imageUrl && !item.replyTo && isEmojiOnlyText(text));

  view.time.textContent = formatMessageTime(item.createdAt);
  view.time.dateTime = item.createdAt;
  view.time.title = new Date(item.createdAt).toLocaleString('vi-VN');
  renderEditHistory(view, item);

  const image = view.bubble.querySelector<HTMLImageElement>('img:not(.message-quote-thumb)');
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
  renderReactions(view, item, ctx);
  updateDeliveryIcon(view);
}

function createSystemEventView(item: ChatMessage): MessageView {
  const element = document.createElement('div');
  element.className = 'message-system-event';
  element.dataset.messageId = item.id;
  element.dataset.messageCreatedAt = item.createdAt;

  const content = document.createElement('p');
  content.className = 'message-system-event-copy';
  content.textContent = messageText(item);
  const time = document.createElement('time');
  time.className = 'message-system-event-time';
  time.textContent = formatMessageTime(item.createdAt);
  time.dateTime = item.createdAt;
  time.title = new Date(item.createdAt).toLocaleString('vi-VN');
  element.append(content, time);

  return {
    item,
    element,
    bubble: document.createElement('div'),
    content,
    time,
    quote: null,
    editedTag: document.createElement('button'),
    editHistory: document.createElement('div'),
    reactions: document.createElement('div'),
    readStatus: document.createElement('small'),
    deliveryIcon: null,
    replyKeys: new Set(),
    systemEvent: true,
  };
}

export function createMessageView(
  item: ChatMessage,
  ctx: BubbleFactoryContext,
  pickerStates: WeakMap<MessageView, { ignoreNextClick: boolean }>,
): MessageView {
  if (item.systemEvent?.kind === 'background_changed') return createSystemEventView(item);

  const hasPhoto = Boolean(item.imageUrl);
  const isSticker = hasPhoto && isStickerMessage(item);
  const text = messageText(item);
  const emojiOnly = !hasPhoto && !item.replyTo && isEmojiOnlyText(text);

  const element = document.createElement(hasPhoto ? 'section' : 'article');
  element.className = [
    hasPhoto ? 'chat-checkin-group' : 'chat-text-message',
    isSticker ? 'chat-sticker-message' : '',
    item.isOwn ? 'own' : '',
    emojiOnly ? 'is-emoji-only' : '',
  ].filter(Boolean).join(' ');
  element.dataset.messageId = item.id;
  element.dataset.messageCreatedAt = item.createdAt;

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
  bubble.className = hasPhoto
    ? `chat-bubble has-photo${isSticker ? ' is-sticker' : ''}`
    : 'chat-text-bubble';
  const quote = createQuote(item);
  if (quote) bubble.appendChild(quote);
  const referencedCheckin = createReferencedCheckin(item, ctx);
  if (referencedCheckin) bubble.appendChild(referencedCheckin);

  if (hasPhoto) {
    const image = document.createElement('img');
    image.src = item.imageUrl!;
    image.alt = isSticker ? 'Sticker' : 'Ảnh tin nhắn';
    image.loading = 'lazy';
    image.decoding = 'async';
    if (isSticker) {
      image.draggable = false;
    }
    image.addEventListener('load', () => {
      if (ctx.isNearBottom()) ctx.scrollToBottom('follow');
    });
    image.addEventListener('click', (event) => {
      event.stopPropagation();
      openMessageImageViewer(item.imageUrl!, item.text || `Ảnh từ ${item.senderName}`);
    });
    bubble.appendChild(image);
  }

  const content = document.createElement('p');
  content.textContent = text;
  content.hidden = !content.textContent;
  bubble.appendChild(content);
  primary.appendChild(bubble);

  const time = document.createElement('time');
  time.textContent = formatMessageTime(item.createdAt);
  time.dateTime = item.createdAt;
  time.title = new Date(item.createdAt).toLocaleString('vi-VN');
  primary.appendChild(time);

  const reactions = document.createElement('div');
  reactions.className = 'message-reactions';
  reactions.hidden = true;
  if (hasPhoto) primary.appendChild(reactions);
  else bubble.appendChild(reactions);

  let deliveryIcon: HTMLElement | null = null;
  const readStatus = document.createElement('small');
  readStatus.className = 'message-read-status';
  readStatus.hidden = true;

  if (item.isOwn) {
    const statusRow = document.createElement('div');
    statusRow.className = 'message-status-row';
    deliveryIcon = document.createElement('span');
    deliveryIcon.className = 'message-delivery-icon';
    deliveryIcon.setAttribute('aria-hidden', 'true');
    statusRow.append(deliveryIcon, readStatus);
    primary.appendChild(statusRow);
  } else {
    primary.appendChild(readStatus);
  }

  const view: MessageView = {
    item,
    element,
    bubble,
    content,
    time,
    quote,
    editedTag,
    editHistory,
    reactions,
    readStatus,
    deliveryIcon,
    replyKeys: new Set(),
  };

  renderReactions(view, item, ctx);
  updateDeliveryIcon(view);
  renderEditHistory(view, item);

  const triggerQuickReaction = (reactionKey: string): void => {
    triggerHaptic('confirm');
    const toggleReaction = optionalMessageApiFunction('toggleMessageReaction');
    const request = toggleReaction ? toggleReaction(view.item.id, reactionKey) : Promise.resolve([]);
    void request
      .then((nextReactions: ChatMessage['reactions'] = []) => {
        const latest = ctx.messages.get(view.item.id);
        if (!latest) return;
        latest.reactions = nextReactions;
        renderReactions(view, latest, ctx);
      })
      .catch(() => showToast('Chưa cập nhật được cảm xúc', 'error'));
  };

  const openReactionPicker = (openedByLongPress = false): void => {
    if (view.bubble.querySelector('.message-reaction-picker')) return;
    triggerHaptic('select');
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

    for (const r of QUICK_REACTION_ITEMS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-label', r.label);
      btn.textContent = r.key;
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        closePicker();
        triggerQuickReaction(r.key);
      });
      reactionRow.appendChild(btn);
    }

    if (view.item.isOwn) {
      const actionRow = document.createElement('div');
      actionRow.className = 'message-action-row';
      if (view.item.type === 'text' || view.item.type === 'checkin_reply') {
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'message-action-button';
        editBtn.textContent = 'Sửa';
        editBtn.addEventListener('click', (event) => {
          event.stopPropagation();
          closePicker();
          const field = createField({
            label: 'Nội dung tin nhắn',
            multiline: true,
            rows: 3,
            value: messageText(view.item),
          });
          openDialog({
            title: 'Chỉnh sửa tin nhắn',
            description: field.element,
            confirmLabel: 'Lưu',
            onConfirm: async () => {
              const nextText = field.getValue().trim();
              if (!nextText) return;
              const editFn = optionalMessageApiFunction('editMessage');
              if (!editFn) return;
              const updated = (await editFn(view.item.id, nextText)) as ChatMessage;
              ctx.messages.set(updated.id, updated);
              patchView(view, updated, ctx);
            },
          });
        });
        actionRow.appendChild(editBtn);
      }

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'message-action-button message-action-button--danger';
      removeBtn.textContent = 'Thu hồi';
      removeBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        closePicker();
        openDialog({
          title: 'Thu hồi tin nhắn?',
          description: 'Tin nhắn này sẽ được thu hồi khỏi cuộc trò chuyện của hai đứa.',
          confirmLabel: 'Thu hồi',
          danger: true,
          onConfirm: async () => {
            const deleteFn = optionalMessageApiFunction('deleteMessage');
            if (!deleteFn) return;
            await deleteFn(view.item.id);
            view.element.remove();
            ctx.messageViews.delete(view.item.id);
            ctx.messages.delete(view.item.id);
          },
        });
      });
      actionRow.appendChild(removeBtn);
      picker.appendChild(actionRow);
    }

    view.bubble.appendChild(picker);
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (pickerState.ignoreNextClick) {
        pickerState.ignoreNextClick = false;
        return;
      }
      if (!target || !picker.contains(target)) closePicker();
    };
    removeOutsideListener = () => document.removeEventListener('click', onDocumentClick, true);
    document.addEventListener('click', onDocumentClick, true);
  };

  let longPressTimer: number | null = null;
  bubble.addEventListener('pointerdown', () => {
    longPressTimer = window.setTimeout(() => openReactionPicker(true), 560);
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
    openReactionPicker();
  });
  bubble.addEventListener('dblclick', (event) => {
    if (hasPhoto) return;
    event.stopPropagation();
    triggerQuickReaction('❤️');
  });

  primary.addEventListener('click', () => element.classList.toggle('show-timestamp'));

  // Swipe-to-Reply with Threshold Haptic
  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let horizontalIntent = false;
  let activated = false;
  let suppressClickUntil = 0;

  const resetSwipe = () => {
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
    const nowActive = translate >= SWIPE_REPLY_THRESHOLD;
    if (nowActive && !activated) triggerHaptic('threshold');
    activated = nowActive;
    bubble.classList.add('is-swiping');
    bubble.classList.toggle('is-swipe-ready', activated);
    bubble.style.transform = `translateX(${translate}px)`;
  });

  const completeSwipe = (event: PointerEvent, cancelled = false) => {
    if (event.pointerId !== pointerId) return;
    const shouldReply = horizontalIntent && activated && !cancelled;
    if (horizontalIntent) suppressClickUntil = Date.now() + 250;
    bubble.releasePointerCapture?.(event.pointerId);
    resetSwipe();
    if (shouldReply) ctx.beginReply(view.item);
  };

  bubble.addEventListener('pointerup', (event) => completeSwipe(event));
  bubble.addEventListener('pointercancel', (event) => completeSwipe(event, true));
  bubble.addEventListener('click', (event) => {
    if (Date.now() < suppressClickUntil) event.preventDefault();
  }, true);

  return view;
}
