import '../styles/20-pages/home.css';
import { navigate } from '../router';
import { store, applyTheme } from '../store/index';
import {
  getLatestPartnerCheckin,
  getCachedLatestPartnerCheckin,
  getCheckins,
  addReaction,
  addReply,
} from '../api/checkins';
import { ensurePushSubscription, getPushSetupState } from '../api/push';
import { showModal } from '../components/modal';
import { showToast } from '../components/toast';
import { openReactionPicker } from '../components/reaction-picker';
import { BESPOKE_REACTIONS, MOOD_ICON_LOOKUP, createReactionTray } from '../ui/reactions';
import { refreshIconMarkup, setRefreshButtonLoading } from '../components/refresh-icon';
import { smilePlusIconMarkup } from '../components/smile-plus-icon';
import { openPolaroidCoverModal } from '../components/polaroid-cover';
import { createReplyToggle, getReplyPagePath } from '../components/reply-toggle';
import { createMessage } from '../api/messages';
import { icon, iconMarkup, type IconName } from '../ui/icons/icons';
import { createAvatarPair, createButton } from '../ui/primitives';
import { attachPullToRefresh, createEmptyState, createSkeleton } from '../ui/feedback';
import { triggerHaptic } from '../ui/haptics';
import { setUiTheme, type UiThemePreference } from '../ui/theme/index';
import type { CheckIn, CheckInReply, Reaction, ReactionType } from '../api/types';
import type { PushSetupResult } from '../api/push';

function escapeHtml(value: string | undefined): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);

  if (diffMin < 1) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffH < 24) return `${diffH} giờ trước`;

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  if (year === now.getFullYear()) {
    return `Lúc ${hours}:${minutes} · ${day} thg ${month}`;
  }
  return `Lúc ${hours}:${minutes} · ${day}/${month}/${year}`;
}

function calcStreak(couple: { streak?: number } | null): number {
  return couple?.streak ?? 0;
}

function calcDaysTogether(loveStartDate?: string): number {
  if (!loveStartDate) return 0;
  const start = new Date(loveStartDate);
  const diff = Date.now() - start.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

function getThemeIconName(theme: UiThemePreference): IconName {
  if (theme === 'dark') return 'sun';
  if (theme === 'light') return 'moon';
  return 'palette';
}

function getReaction(checkin: CheckIn, type: ReactionType): Reaction | undefined {
  return checkin.reactions.find((reaction) => reaction.type === type);
}

function renderSkeleton(): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'p-home-polaroid-wrap skeleton';
  const frame = document.createElement('div');
  frame.className = 'p-home-polaroid';
  frame.appendChild(createSkeleton({ height: '310px', className: 'p-home-skel-media' }));
  const lineWrap = document.createElement('div');
  lineWrap.className = 'p-home-polaroid__caption-bar';
  lineWrap.appendChild(createSkeleton({ width: '68%', height: '18px' }));
  lineWrap.appendChild(createSkeleton({ width: '42%', height: '13px' }));
  frame.appendChild(lineWrap);
  wrapper.appendChild(frame);
  return wrapper;
}

function attachLongPress(target: HTMLElement, onLongPress: () => void): void {
  let timer: number | undefined;
  let longPressed = false;
  let startX = 0;
  let startY = 0;

  const clear = () => {
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timer = undefined;
    }
  };

  target.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    longPressed = false;
    startX = event.clientX;
    startY = event.clientY;
    clear();
    timer = window.setTimeout(() => {
      longPressed = true;
      triggerHaptic('threshold');
      onLongPress();
    }, 420);
  });

  target.addEventListener('pointermove', (event) => {
    if (timer === undefined) return;
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > 8) {
      clear();
    }
  }, { passive: true });

  target.addEventListener('pointerup', clear);
  target.addEventListener('pointerleave', clear);
  target.addEventListener('pointercancel', clear);
  target.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    if (!longPressed) onLongPress();
  });
}

function buildReactionPicker(
  checkin: CheckIn,
  onReact: (type: ReactionType) => void,
): HTMLElement {
  const picker = document.createElement('div');
  picker.className = 'reaction-picker p-reaction-drawer';

  BESPOKE_REACTIONS.forEach(({ type, label }) => {
    const existing = getReaction(checkin, type);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `reaction-option${existing?.reactedByMe ? ' selected' : ''}`;
    btn.dataset.type = type;
    btn.setAttribute('aria-label', `Thả cảm xúc ${label}`);
    btn.innerHTML = `<span class="c-reaction-emoji" aria-hidden="true">${escapeHtml(type)}</span>`;
    btn.addEventListener('click', () => {
      triggerHaptic('tap');
      onReact(type);
    });
    picker.appendChild(btn);
  });

  const custom = document.createElement('form');
  custom.className = 'reaction-custom-form';
  custom.innerHTML = `
    <input aria-label="Cảm xúc tùy chọn" maxlength="24" placeholder="Thả emoji / icon / sticker..." />
    <button type="submit">Thả</button>
  `;
  custom.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = custom.querySelector<HTMLInputElement>('input');
    const value = input?.value.trim();
    if (!value) return;
    triggerHaptic('tap');
    onReact(value);
    if (input) input.value = '';
  });
  picker.appendChild(custom);

  return picker;
}

function showReplyComposer(
  checkin: CheckIn,
  onSaved: (replies: CheckInReply[]) => void,
): void {
  const form = document.createElement('div');
  form.className = 'reply-composer';
  form.innerHTML = `
    <textarea id="reply-message" class="reply-textarea c-textarea" rows="4" maxlength="500" placeholder="Viết đôi lời nhắn gửi cho khoảnh khắc này..."></textarea>
  `;

  showModal({
    title: 'Phản hồi khoảnh khắc',
    content: form,
    confirmText: 'Gửi phản hồi',
    cancelText: 'Huỷ',
    onConfirm: async () => {
      const textarea = form.querySelector<HTMLTextAreaElement>('#reply-message');
      const message = textarea?.value.trim() ?? '';
      if (!message) {
        showToast('Nhập nội dung phản hồi trước nhé', 'error');
        throw new Error('Reply message required');
      }

      let replies: CheckInReply[];
      try {
        await createMessage({
          type: 'text',
          text: message,
          referencedCheckinId: checkin.id,
          clientMutationId: crypto.randomUUID?.() ?? String(Date.now()),
        });
        const currentUser = store.get().user;
        replies = [
          ...checkin.replies,
          {
            userId: currentUser?.id ?? 'me',
            userName: currentUser?.displayName ?? 'Bạn',
            message,
            isOwn: true,
            createdAt: new Date().toISOString(),
          },
        ];
      } catch {
        replies = await addReply(checkin.id, message);
      }
      onSaved(replies);
      showToast('Đã gửi phản hồi', 'success');
    },
  });

  setTimeout(() => {
    form.querySelector<HTMLTextAreaElement>('#reply-message')?.focus();
  }, 50);
}

interface CheckinCardView {
  element: HTMLElement;
  patchInteractions: () => void;
}

function buildCheckinCard(
  checkin: CheckIn,
  onReact: (type: ReactionType) => void,
  onReply: () => void,
): CheckinCardView {
  const wrapper = document.createElement('div');
  wrapper.className = 'checkin-wrapper p-home-polaroid-wrap';

  const card = document.createElement('article');
  card.className = 'checkin-card p-home-polaroid u-grain-surface';

  const moodMeta = checkin.mood ? MOOD_ICON_LOOKUP[checkin.mood] : undefined;
  const moodBadgeHtml = moodMeta
    ? `<span class="p-home-mood-tag">${iconMarkup(moodMeta.icon, { size: 16, variant: 'filled' })}</span>`
    : '';

  if (checkin.type === 'photo' && checkin.photoUrl) {
    card.innerHTML = `
      <div class="p-home-polaroid__media">
        <img
          class="checkin-card-image"
          src="${escapeHtml(checkin.photoUrl)}"
          alt="Ảnh check-in của ${escapeHtml(checkin.ownerName)}"
          data-surprise-text="${escapeHtml(checkin.surpriseText || '')}"
          data-scratch-enabled="${checkin.includeScratch !== false ? 'true' : 'false'}"
          decoding="async"
        />
      </div>
      <div class="checkin-card-overlay p-home-polaroid__caption-bar">
        ${checkin.caption ? `<p class="checkin-card-overlay-text p-home-polaroid__caption">${escapeHtml(checkin.caption)}</p>` : ''}
        <p class="checkin-card-overlay-meta p-home-polaroid__meta">
          ${moodBadgeHtml}<span>${escapeHtml(checkin.ownerName)} · ${formatTime(checkin.createdAt)}</span>
        </p>
      </div>
    `;
    const mediaEl = card.querySelector<HTMLElement>('.p-home-polaroid__media');
    mediaEl?.addEventListener('click', () => {
      if (!checkin.photoUrl) return;
      const trimmedCaption = (checkin.caption ?? '').trim();
      openPolaroidCoverModal({
        imageUrl: checkin.photoUrl,
        title: trimmedCaption || checkin.ownerName,
        dateText: trimmedCaption ? `${checkin.ownerName} · ${formatTime(checkin.createdAt)}` : formatTime(checkin.createdAt),
        hasCustomCaption: Boolean(trimmedCaption),
        coverText: checkin.surpriseText,
        forceScratch: false,
      });
    });
  } else {
    card.classList.add('p-home-polaroid--text');
    card.innerHTML = `
      <div class="checkin-card-text">
        ${moodMeta ? `<div class="checkin-mood-icon">${iconMarkup(moodMeta.icon, { size: 28, variant: 'filled' })}</div>` : ''}
        ${checkin.caption ? `<p class="p-home-polaroid__caption">${escapeHtml(checkin.caption)}</p>` : ''}
        <p class="p-home-polaroid__meta">
          ${escapeHtml(checkin.ownerName)} · ${formatTime(checkin.createdAt)}
        </p>
      </div>
    `;
  }

  const picker = buildReactionPicker(checkin, (type) => {
    onReact(type);
    picker.classList.remove('open');
  });
  const showPicker = () => {
    picker.classList.toggle('open');
  };

  attachLongPress(card, showPicker);
  wrapper.appendChild(card);

  const composerForm = document.createElement('form');
  composerForm.className = 'rm-inline-composer p-home-inline-composer';
  composerForm.setAttribute('autocomplete', 'off');
  composerForm.innerHTML = `
    <input
      type="text"
      name="home_partner_msg"
      aria-label="Gửi tin nhắn cho khoảnh khắc này"
      maxlength="500"
      placeholder="Nhắn gì đó cho ảnh này..."
      autocomplete="off"
      autocorrect="off"
      autocapitalize="sentences"
      spellcheck="false"
      data-lpignore="true"
      data-form-type="other"
      data-1p-ignore="true"
    />
    <button type="button" class="rm-quick-react rm-reaction-choice react-button" data-icon="smile+" aria-label="Thả biểu tượng cảm xúc">${smilePlusIconMarkup}</button>
    <button type="submit" class="rm-send-message" aria-label="Gửi tin nhắn">${iconMarkup('send', { size: 16 })}</button>
  `;

  const composerInput = composerForm.querySelector<HTMLInputElement>('input');
  const composerSendBtn = composerForm.querySelector<HTMLButtonElement>('.rm-send-message');
  composerForm.querySelector<HTMLButtonElement>('.rm-reaction-choice')?.addEventListener('click', (event) => {
    event.stopPropagation();
    showPicker();
  });

  const reactionTray = createReactionTray(() => checkin.reactions, onReact);

  const replyToggle = createReplyToggle(
    () => checkin.replies,
    () => navigate(getReplyPagePath(checkin.id)),
    'Trả lời',
    onReply,
  );
  replyToggle.toggle.hidden = true;

  let sendingInline = false;
  composerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = composerInput?.value.trim() ?? '';
    if (!message || sendingInline) return;
    sendingInline = true;
    if (composerSendBtn) composerSendBtn.disabled = true;
    try {
      try {
        await createMessage({
          type: 'text',
          text: message,
          referencedCheckinId: checkin.id,
          clientMutationId: crypto.randomUUID?.() ?? String(Date.now()),
        });
        const currentUser = store.get().user;
        checkin.replies = [
          ...checkin.replies,
          {
            userId: currentUser?.id ?? 'me',
            userName: currentUser?.displayName ?? 'Bạn',
            message,
            isOwn: true,
            createdAt: new Date().toISOString(),
          },
        ];
      } catch {
        checkin.replies = await addReply(checkin.id, message);
      }
      replyToggle.sync();
      if (composerInput) composerInput.value = '';
      showToast('Đã gửi tin nhắn', 'success');
    } catch {
      showToast('Không gửi được tin nhắn, thử lại nhé', 'error');
    } finally {
      sendingInline = false;
      if (composerSendBtn) composerSendBtn.disabled = false;
    }
  });

  wrapper.append(composerForm, picker, reactionTray.element, replyToggle.toggle, replyToggle.panel);

  return {
    element: wrapper,
    patchInteractions: () => {
      reactionTray.sync();

      picker.querySelectorAll<HTMLButtonElement>('[data-type]').forEach((button) => {
        const type = button.dataset.type ?? '';
        const reaction = getReaction(checkin, type);
        button.classList.toggle('selected', Boolean(reaction?.reactedByMe));
      });

      replyToggle.sync();
    },
  };
}

type CheckInWithLegacyMedia = CheckIn & {
  cardUrl?: string;
  imageUrl?: string;
};

function getCheckinPhotoUrl(item: CheckIn): string | undefined {
  const media = item as CheckInWithLegacyMedia;
  return media.photoUrl || media.cardUrl || media.imageUrl;
}

function isToday(isoDate: string): boolean {
  const date = new Date(isoDate);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate()
  );
}

function buildRecentMemoriesSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'recent-memories-section p-home-recent';

  const header = document.createElement('div');
  header.className = 'recent-memories-header';
  header.innerHTML = `
    <div class="recent-memories-heading">
      <span class="recent-memories-eyebrow">Nhật ký hôm nay</span>
      <span class="recent-memories-title">Ảnh hai đứa đã gửi</span>
    </div>
  `;
  section.appendChild(header);

  const list = document.createElement('div');
  list.className = 'recent-memories-list p-home-recent__list';
  list.appendChild(createSkeleton({ height: '140px' }));
  section.appendChild(list);

  void (async () => {
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const res = await getCheckins(1, 12, startOfToday.toISOString());
      const items = (res.data || [])
        .filter((item) => isToday(item.createdAt) && Boolean(getCheckinPhotoUrl(item)))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      list.replaceChildren();

      if (items.length === 0) {
        const note = document.createElement('p');
        note.className = 'u-text-secondary';
        note.style.cssText = 'text-align:center;padding:16px 0;font-size:13px;';
        note.textContent = 'Hôm nay chưa có tấm ảnh nào được lưu vào cuốn album chung.';
        list.appendChild(note);
        return;
      }

      items.forEach((item, idx) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'recent-memory-item';

        const card = document.createElement('article');
        card.className = 'recent-memory-card p-home-recent-card';

        const photoUrl = getCheckinPhotoUrl(item);
        if (photoUrl) {
          const photoWrap = document.createElement('div');
          photoWrap.className = 'rm-photo-wrap';
          photoWrap.style.cursor = 'pointer';
          photoWrap.innerHTML = `
            <img src="${escapeHtml(photoUrl)}" alt="Ảnh kỷ niệm của ${escapeHtml(item.ownerName)}" loading="lazy" decoding="async" />
            <div class="rm-photo-overlay"></div>
          `;
          photoWrap.addEventListener('click', (event) => {
            event.stopPropagation();
            const trimmedCaption = (item.caption ?? '').trim();
            openPolaroidCoverModal({
              imageUrl: photoUrl,
              title: trimmedCaption || item.ownerName,
              dateText: trimmedCaption ? `${item.ownerName} · ${formatTime(item.createdAt)}` : formatTime(item.createdAt),
              hasCustomCaption: Boolean(trimmedCaption),
              coverText: item.surpriseText,
              forceScratch: false,
            });
          });
          card.appendChild(photoWrap);
        }

        const body = document.createElement('div');
        body.className = 'rm-body';

        const topRow = document.createElement('div');
        topRow.className = 'rm-top-row';

        const meta = document.createElement('div');
        meta.className = 'rm-meta';
        meta.innerHTML = `
          <span class="rm-owner">${escapeHtml(item.ownerName)}</span>
          <span class="rm-time">${formatTime(item.createdAt)}</span>
        `;
        topRow.appendChild(meta);

        const moodInfo = item.mood ? MOOD_ICON_LOOKUP[item.mood] : undefined;
        if (moodInfo) {
          const moodStamp = document.createElement('div');
          moodStamp.className = 'rm-mood-stamp';
          moodStamp.setAttribute('aria-label', moodInfo.label);
          moodStamp.innerHTML = iconMarkup(moodInfo.icon, { size: 16, variant: 'filled' });
          topRow.appendChild(moodStamp);
        }

        body.appendChild(topRow);

        if (item.caption) {
          const caption = document.createElement('p');
          caption.className = 'rm-caption';
          caption.textContent = item.caption;
          body.appendChild(caption);
        }

        const reactionRow = document.createElement('div');
        reactionRow.className = 'rm-reaction-row';

        const replyForm = document.createElement('form');
        replyForm.className = 'rm-inline-composer';
        replyForm.setAttribute('autocomplete', 'off');
        replyForm.innerHTML = `
          <input
            type="text"
            name="home_chat_msg"
            aria-label="Gửi tin nhắn cho ảnh này"
            maxlength="500"
            placeholder="Nhắn gì đó cho tấm ảnh này..."
            autocomplete="off"
            autocorrect="off"
            autocapitalize="sentences"
            spellcheck="false"
            data-lpignore="true"
            data-form-type="other"
            data-1p-ignore="true"
          />
          <button type="button" class="rm-quick-react rm-reaction-choice react-button" data-icon="smile+" aria-label="Chọn cảm xúc">${smilePlusIconMarkup}</button>
          <button type="submit" class="rm-send-message" aria-label="Gửi tin nhắn">${iconMarkup('send', { size: 16 })}</button>
        `;

        const replyInput = replyForm.querySelector<HTMLInputElement>('input');
        const reactionTray = createReactionTray(() => item.reactions, async (type) => {
          try {
            item.reactions = await addReaction(item.id, type);
            reactionTray.sync();
          } catch {
            showToast('Không thả cảm xúc được, thử lại nhé', 'error');
          }
        });

        replyForm.addEventListener('submit', async (event) => {
          event.preventDefault();
          event.stopPropagation();
          const message = replyInput?.value.trim() ?? '';
          if (!message) return;

          try {
            await createMessage({
              type: 'text',
              text: message,
              referencedCheckinId: item.id,
              clientMutationId: crypto.randomUUID?.() ?? String(Date.now()),
            });
            const currentUser = store.get().user;
            item.replies = [
              ...item.replies,
              {
                userId: currentUser?.id ?? 'me',
                userName: currentUser?.displayName ?? 'Bạn',
                message,
                isOwn: true,
                createdAt: new Date().toISOString(),
              },
            ];
            if (replyInput) replyInput.value = '';
            showToast('Đã gửi tin nhắn', 'success');
          } catch {
            showToast('Không gửi được tin nhắn, thử lại nhé', 'error');
          }
        });

        replyForm.querySelector<HTMLButtonElement>('.rm-reaction-choice')?.addEventListener('click', (event) => {
          event.stopPropagation();
          openReactionPicker(item, () => reactionTray.sync());
        });

        reactionRow.appendChild(replyForm);
        body.append(reactionRow, reactionTray.element);

        if (idx === items.length - 1) {
          const viewAllButton = createButton({
            label: 'Mở trọn bộ Kỷ niệm',
            variant: 'ghost',
            size: 'sm',
            trailingIcon: 'chevron-right',
            className: 'recent-memories-open-all',
            onClick: (event) => {
              event.stopPropagation();
              navigate('/app/memories');
            },
          });
          body.appendChild(viewAllButton.element);
        }

        card.appendChild(body);
        wrapper.appendChild(card);
        list.appendChild(wrapper);
      });
    } catch {
      list.replaceChildren();
    }
  })();

  return section;
}

export function renderHomePage(): HTMLElement {
  const state = store.get();
  const user = state.user;
  const couple = state.couple;
  const partnerName = user?.partnerName ?? 'Người ấy';
  const myName = user?.displayName ?? 'Bạn';

  const page = document.createElement('div');
  page.className = 'page p-home animate-fade-in';

  // ── 1. Top Editorial Bar ──
  const topBar = document.createElement('header');
  topBar.className = 'p-home-topbar';

  const brandWrap = document.createElement('div');
  brandWrap.className = 'p-home-brand';
  const streak = calcStreak(couple);
  const days = calcDaysTogether(couple?.loveStartDate);

  const streakChip = document.createElement('div');
  streakChip.className = 'p-home-streak';
  streakChip.appendChild(icon('streak', { size: 16, variant: 'filled' }));
  const streakVal = document.createElement('span');
  streakVal.className = 'p-home-streak__val';
  streakVal.textContent = `${streak} ngày`;
  streakChip.appendChild(streakVal);

  // Hidden legacy hook in case external callers inspect .streak-banner
  const legacyStreakHook = document.createElement('span');
  legacyStreakHook.className = 'streak-banner';
  legacyStreakHook.hidden = true;
  brandWrap.append(streakChip, legacyStreakHook);

  const daysSub = document.createElement('div');
  daysSub.className = 'p-home-days-sub';
  daysSub.textContent = days > 0 ? `${days} ngày bên nhau` : 'Mỗi ngày một khoảnh khắc';
  brandWrap.appendChild(daysSub);

  const rightActions = document.createElement('div');
  rightActions.className = 'p-home-actions';

  const themeBtn = document.createElement('button');
  themeBtn.type = 'button';
  themeBtn.className = 'c-icon-btn';
  themeBtn.setAttribute('aria-label', 'Đổi giao diện');
  themeBtn.innerHTML = iconMarkup(getThemeIconName(state.theme), { size: 20 });
  themeBtn.addEventListener('click', () => {
    const current = store.get().theme;
    const next: UiThemePreference = current === 'dark' ? 'light' : current === 'light' ? 'system' : 'dark';
    triggerHaptic('select');
    store.set({ theme: next });
    applyTheme(next);
    setUiTheme(next);
    themeBtn.innerHTML = iconMarkup(getThemeIconName(next), { size: 20 });
  });

  const refreshBtn = document.createElement('button');
  refreshBtn.type = 'button';
  refreshBtn.className = 'c-icon-btn';
  refreshBtn.setAttribute('aria-label', 'Làm mới');
  refreshBtn.innerHTML = refreshIconMarkup;
  refreshBtn.addEventListener('click', () => {
    triggerHaptic('tap');
    showToast('Đang tải lại check-in...', 'loading-spark');
    void loadCheckin(true);
  });

  rightActions.append(themeBtn, refreshBtn);
  topBar.append(brandWrap, rightActions);
  page.appendChild(topBar);

  // Live sync streak from store
  const unsubStore = store.subscribe?.((nextState) => {
    if (!page.isConnected) {
      unsubStore?.();
      return;
    }
    const nextStreak = calcStreak(nextState.couple);
    streakVal.textContent = `${nextStreak} ngày`;
  });

  // ── 2. Couple Hero Card ──
  const hero = document.createElement('section');
  hero.className = 'p-home-hero u-grain-surface';
  const heroRow = document.createElement('div');
  heroRow.className = 'p-home-hero__row';
  const heroCopy = document.createElement('div');
  heroCopy.className = 'p-home-hero__copy';
  heroCopy.innerHTML = `
    <span class="p-home-hero__eyebrow">Không gian hai đứa</span>
    <h1 class="p-home-hero__title">${days > 0 ? `Ngày thứ <em>${days}</em>` : `Thương chào <em>${escapeHtml(myName)}</em>`}</h1>
  `;
  const userMedia = user as { avatarUrl?: string; partnerAvatarUrl?: string; partnerAvatar?: string } | null;
  const avatars = createAvatarPair(
    { name: myName, src: userMedia?.avatarUrl, size: 'md' },
    { name: partnerName, src: userMedia?.partnerAvatarUrl || userMedia?.partnerAvatar, size: 'md', presence: 'online' },
    true,
  );
  heroRow.append(heroCopy, avatars);
  hero.appendChild(heroRow);

  const heroCtas = document.createElement('div');
  heroCtas.className = 'p-home-hero__cta-row';
  heroCtas.appendChild(
    createButton({
      label: 'Gửi khoảnh khắc',
      variant: 'primary',
      size: 'sm',
      pill: true,
      leadingIcon: 'checkin-lens',
      onClick: () => navigate('/app/checkin'),
    }).element,
  );
  heroCtas.appendChild(
    createButton({
      label: 'Nhắn tin',
      variant: 'secondary',
      size: 'sm',
      pill: true,
      leadingIcon: 'chat',
      onClick: () => navigate('/app/messages'),
    }).element,
  );
  hero.appendChild(heroCtas);
  page.appendChild(hero);

  // ── 3. Push Permission Slot ──
  const pushSlot = document.createElement('div');
  pushSlot.className = 'p-home-push-slot';
  page.appendChild(pushSlot);

  // ── 4. Partner Latest Check-in Section ──
  const sectionHead = document.createElement('div');
  sectionHead.className = 'p-home-section-head';
  sectionHead.innerHTML = `
    <h2 class="p-home-section-head__title">Từ <span class="p-home-section-head__accent">${escapeHtml(partnerName)}</span></h2>
  `;
  page.appendChild(sectionHead);

  const contentArea = document.createElement('div');
  contentArea.className = 'p-home-stage';
  page.appendChild(contentArea);

  // ── 5. Love Journey Card ──
  const journeyBanner = document.createElement('button');
  journeyBanner.type = 'button';
  journeyBanner.setAttribute('aria-label', 'Mở bản đồ hẹn hò và điều ước');
  journeyBanner.className = 'home-journey-banner p-home-journey';
  journeyBanner.innerHTML = `
    <div class="p-home-journey__lead">
      <div class="p-home-journey__icon">${iconMarkup('map', { size: 24, variant: 'filled' })}</div>
      <div>
        <span class="p-home-journey__title">Bản đồ hẹn hò & Điều ước</span>
        <span class="p-home-journey__sub">Ghi dấu từng toạ độ và ước hẹn của hai đứa</span>
      </div>
    </div>
    ${iconMarkup('chevron-right', { size: 20 })}
  `;
  journeyBanner.addEventListener('click', () => navigate('/app/journey'));
  page.appendChild(journeyBanner);

  // ── 6. Today's Sent Photos ──
  page.appendChild(buildRecentMemoriesSection());

  async function renderPushPrompt(): Promise<void> {
    if (!store.isAuthenticated()) return;
    const result = await getPushSetupState().catch(() => null);
    pushSlot.replaceChildren();
    if (!result || result.status !== 'prompt') return;

    const card = document.createElement('div');
    card.className = 'push-permission-card p-home-push-card';
    card.innerHTML = `
      <div class="p-home-push-card__lead">
        <div class="p-home-push-card__icon">${iconMarkup('bell', { size: 20, variant: 'filled' })}</div>
        <div class="p-home-push-card__copy">
          <strong>Bật thông báo tức thì</strong>
          <span>Báo ngay khi ${escapeHtml(partnerName)} gửi ảnh hoặc nhắn tin.</span>
        </div>
      </div>
    `;
    const enableBtn = createButton({
      label: 'Bật',
      variant: 'primary',
      size: 'sm',
      pill: true,
      onClick: async () => {
        const setup = await ensurePushSubscription(true).catch(
          (): PushSetupResult => ({ status: 'error', message: 'Chưa bật được thông báo' }),
        );
        if (setup.status === 'subscribed') {
          card.remove();
          showToast('Đã bật thông báo', 'success');
        } else {
          showToast(setup.message ?? 'Chưa bật được thông báo', 'error');
        }
      },
    });
    card.appendChild(enableBtn.element);
    pushSlot.appendChild(card);
  }

  let activeCheckin: CheckIn | null = null;
  let activeCard: CheckinCardView | null = null;
  let reactionPending = false;

  function renderLoadedCheckin(checkin: CheckIn): void {
    if (activeCheckin?.id === checkin.id && activeCard?.element.isConnected) {
      Object.assign(activeCheckin, checkin);
      activeCard.patchInteractions();
      return;
    }

    activeCheckin = checkin;
    const cardView = buildCheckinCard(
      checkin,
      async (type) => {
        if (reactionPending) return;
        reactionPending = true;
        const previousReactions = checkin.reactions;
        checkin.reactions = toggleReactionOptimistically(previousReactions, type);
        cardView.patchInteractions();

        try {
          checkin.reactions = await addReaction(checkin.id, type);
        } catch {
          checkin.reactions = previousReactions;
          showToast('Không thể thả cảm xúc, thử lại nhé', 'error');
        } finally {
          reactionPending = false;
          cardView.patchInteractions();
        }
      },
      () => {
        showReplyComposer(checkin, (replies) => {
          checkin.replies = replies;
          cardView.patchInteractions();
        });
      },
    );

    activeCard = cardView;
    contentArea.replaceChildren(cardView.element);
  }

  async function loadCheckin(useCache = true): Promise<void> {
    if (useCache) {
      const cached = getCachedLatestPartnerCheckin();
      if (cached) {
        renderLoadedCheckin(cached);
      } else if (!activeCard) {
        contentArea.replaceChildren(renderSkeleton());
      }
    } else {
      activeCheckin = null;
      activeCard = null;
      contentArea.replaceChildren(renderSkeleton());
    }

    setRefreshButtonLoading(refreshBtn, true);

    try {
      const checkin = await getLatestPartnerCheckin({ force: true });
      setRefreshButtonLoading(refreshBtn, false);

      if (!checkin) {
        activeCheckin = null;
        activeCard = null;
        const empty = createEmptyState({
          illustration: 'memories',
          title: 'Chưa có khoảnh khắc mới hôm nay',
          description: `${partnerName} chưa gửi check-in nào hôm nay. Bạn gửi mở hàng trước nhé!`,
          action: {
            label: 'Gửi check-in ngay',
            variant: 'primary',
            pill: true,
            leadingIcon: 'checkin-lens',
            onClick: () => navigate('/app/checkin'),
          },
        });
        empty.querySelector('button')?.setAttribute('id', 'home-checkin-btn');
        contentArea.replaceChildren(empty);
        return;
      }

      renderLoadedCheckin(checkin);

      try {
        const bridge = (window as unknown as {
          LoveCheckAndroid?: { updatePartnerCheckin?: (...args: string[]) => void };
        }).LoveCheckAndroid;
        if (bridge && typeof bridge.updatePartnerCheckin === 'function') {
          bridge.updatePartnerCheckin(
            partnerName,
            checkin.type,
            checkin.caption || '',
            checkin.photoUrl || '',
            checkin.createdAt,
          );
        }
      } catch {
        // Android bridge is optional
      }
    } catch {
      setRefreshButtonLoading(refreshBtn, false);
      if (getCachedLatestPartnerCheckin() || activeCard) {
        showToast('Không thể làm mới dữ liệu', 'error');
        return;
      }
      activeCheckin = null;
      activeCard = null;
      const errState = createEmptyState({
        illustration: 'offline',
        title: 'Chưa tải được khoảnh khắc',
        description: 'Kiểm tra kết nối mạng rồi thử lại giúp mình nhé.',
        action: {
          label: 'Thử lại',
          variant: 'secondary',
          pill: true,
          leadingIcon: 'refresh',
          onClick: () => void loadCheckin(false),
        },
      });
      errState.querySelector('button')?.setAttribute('id', 'retry-btn');
      contentArea.replaceChildren(errState);
    }
  }

  attachPullToRefresh({
    scrollContainer: page,
    onRefresh: async () => {
      triggerHaptic('tap');
      await loadCheckin(true);
    },
  });

  void renderPushPrompt();
  void loadCheckin(true);

  return page;
}

function toggleReactionOptimistically(reactions: Reaction[], type: ReactionType): Reaction[] {
  const current = reactions.find((reaction) => reaction.type === type);
  if (!current) return [...reactions, { type, count: 1, reactedByMe: true }];

  if (current.reactedByMe) {
    const nextCount = Math.max(0, current.count - 1);
    return reactions
      .map((reaction) => (reaction.type === type ? { ...reaction, count: nextCount, reactedByMe: false } : reaction))
      .filter((reaction) => reaction.count > 0);
  }

  return reactions.map((reaction) =>
    reaction.type === type ? { ...reaction, count: reaction.count + 1, reactedByMe: true } : reaction,
  );
}
