import { navigate } from '../router';
import { store, applyTheme } from '../store/index';
import { getLatestPartnerCheckin, getCachedLatestPartnerCheckin, getCheckins, addReaction, addReply } from '../api/checkins';
import { ensurePushSubscription, getPushSetupState } from '../api/push';
import { showModal } from '../components/modal';
import { showToast } from '../components/toast';
import { openReactionPicker, reactionPillsHtml } from '../components/reaction-picker';
import { refreshIconMarkup, setRefreshButtonLoading } from '../components/refresh-icon';
import { smilePlusIconMarkup } from '../components/smile-plus-icon';
import { openPolaroidCoverModal } from '../components/polaroid-cover';
import { createReplyToggle, getReplyPagePath } from '../components/reply-toggle';
import { createMessage } from '../api/messages';
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
    return `Lúc ${hours}:${minutes} ${day} tháng ${month}`;
  }
  return `Lúc ${hours}:${minutes} ${day} tháng ${month}, ${year}`;
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

const MOOD_EMOJIS: Record<string, string> = {
  happy: '\u{1F60A}',
  love: '\u{1F970}',
  sad: '\u{1F622}',
  excited: '\u{1F929}',
  tired: '\u{1F634}',
  calm: '\u{1F60C}',
  miss: '\u{1F97A}',
};

const REACTIONS: Array<{ type: ReactionType; emoji: string; label: string }> = [
  { type: '❤️', emoji: '❤️', label: 'Yêu' },
  { type: '🥰', emoji: '🥰', label: 'Thương' },
  { type: '😘', emoji: '😘', label: 'Hôn' },
  { type: '😂', emoji: '😂', label: 'Cười' },
  { type: '🥺', emoji: '🥺', label: 'Nhớ' },
  { type: '🤗', emoji: '🤗', label: 'Ôm' },
  { type: '🔥', emoji: '🔥', label: 'Xinh' },
  { type: '✨', emoji: '✨', label: 'Lấp lánh' },
  { type: '😭', emoji: '😭', label: 'Thương quá' },
];

function getReaction(checkin: CheckIn, type: ReactionType): Reaction | undefined {
  return checkin.reactions.find((reaction) => reaction.type === type);
}

function renderSkeleton(): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'padding:0 16px;display:flex;flex-direction:column;gap:16px;';
  wrapper.innerHTML = `
    <div class="skeleton" style="height:48px;border-radius:12px;"></div>
    <div style="height:300px;border-radius:28px;background:var(--surface);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;box-shadow:var(--shadow);">
      <svg viewBox="0 0 64 76" width="158" height="188" class="l-polaroid" aria-hidden="true">
        <defs>
          <linearGradient id="skelPolGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ffb3cc"/>
            <stop offset="55%" stop-color="#ff85a1"/>
            <stop offset="100%" stop-color="#c0456c"/>
          </linearGradient>
        </defs>
        <rect width="64" height="76" rx="4" fill="#fff4f7"/>
        <rect class="l-polaroid__photo" x="6" y="6" width="52" height="52" rx="2" fill="url(#skelPolGrad)"/>
        <rect x="10" y="66" width="26" height="3" rx="1.5" fill="#c0456c" opacity=".4"/>
      </svg>
      <span style="font-size:13px;color:var(--text-secondary);letter-spacing:.01em;">Đang tải check-in của người ấy...</span>
    </div>
    <div class="skeleton" style="height:56px;border-radius:20px;"></div>
  `;
  return wrapper;
}

function attachLongPress(target: HTMLElement, onLongPress: () => void): void {
  let timer: number | undefined;
  let longPressed = false;

  const clear = () => {
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timer = undefined;
    }
  };

  target.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    longPressed = false;
    clear();
    timer = window.setTimeout(() => {
      longPressed = true;
      onLongPress();
    }, 420);
  });

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
  picker.className = 'reaction-picker';

  REACTIONS.forEach(({ type, emoji, label }) => {
    const existing = getReaction(checkin, type);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `reaction-option${existing?.reactedByMe ? ' selected' : ''}`;
    btn.dataset.type = type;
    btn.innerHTML = `<span class="reaction-option-emoji">${emoji}</span><span>${label}</span>`;
    btn.addEventListener('click', () => onReact(type));
    picker.appendChild(btn);
  });

  const custom = document.createElement('form');
  custom.className = 'reaction-custom-form';
  custom.innerHTML = `
    <input aria-label="Emoji tùy chọn" maxlength="16" placeholder="Emoji" />
    <button type="submit">Gửi</button>
  `;
  custom.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = custom.querySelector<HTMLInputElement>('input');
    const value = input?.value.trim();
    if (!value) return;
    onReact(value);
    if (input) input.value = '';
  });
  picker.appendChild(custom);

  return picker;
}

function buildReactionSummary(
  checkin: CheckIn,
  onShowPicker: () => void,
): HTMLElement {
  const row = document.createElement('div');
  row.className = 'checkin-actions-row';

  const summary = document.createElement('button');
  summary.type = 'button';
  summary.className = 'reaction-summary';
  summary.addEventListener('click', onShowPicker);

  const activeReactions = checkin.reactions.filter((reaction) => reaction.count > 0);

  if (activeReactions.length === 0) {
    summary.innerHTML = `<span class="reaction-hint">Giữ để react.</span>`;
  } else {
    summary.innerHTML = activeReactions
      .map(
        (reaction) =>
          `<span class="reaction-pill${reaction.reactedByMe ? ' selected' : ''}">${escapeHtml(reaction.type)}<strong>${reaction.count}</strong></span>`,
      )
      .join('');
  }

  row.appendChild(summary);
  return row;
}

function showReplyComposer(
  checkin: CheckIn,
  onSaved: (replies: CheckInReply[]) => void,
): void {
  const form = document.createElement('div');
  form.className = 'reply-composer';
  form.innerHTML = `
    <textarea id="reply-message" class="reply-textarea" rows="4" maxlength="500" placeholder="Viết reply cho check-in này"></textarea>
  `;

  showModal({
    title: 'Reply check-in',
    content: form,
    confirmText: 'Gửi reply',
    cancelText: 'Hủy',
    onConfirm: async () => {
      const textarea = form.querySelector<HTMLTextAreaElement>('#reply-message');
      const message = textarea?.value.trim() ?? '';
      if (!message) {
        showToast('Nhập nội dung reply trước nhé', 'error');
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
        // Keep the older reply endpoint as a compatibility fallback for legacy deployments.
        replies = await addReply(checkin.id, message);
      }
      onSaved(replies);
      showToast('Đã gửi reply', 'success');
    },
  });

  setTimeout(() => {
    form.querySelector<HTMLTextAreaElement>('#reply-message')?.focus();
  }, 50);
}

function buildCheckinCard(
  checkin: CheckIn,
  onReact: (type: ReactionType) => void,
  onReply: () => void,
): CheckinCardView {
  const wrapper = document.createElement('div');
  wrapper.className = 'checkin-wrapper';

  const card = document.createElement('div');
  card.className = 'checkin-card animate-slide-up';

  if (checkin.type === 'photo' && checkin.photoUrl) {
    card.innerHTML = `
      <img
        class="checkin-card-image"
        src="${escapeHtml(checkin.photoUrl)}"
        alt="Ảnh check-in"
        data-surprise-text="${escapeHtml(checkin.surpriseText || '')}"
        data-scratch-enabled="${checkin.includeScratch !== false ? 'true' : 'false'}"
        loading="lazy"
      />
      <div class="checkin-card-overlay">
        ${checkin.caption ? `<p class="checkin-card-overlay-text">${escapeHtml(checkin.caption)}</p>` : ''}
        <p class="checkin-card-overlay-meta">
          ${checkin.mood ? MOOD_EMOJIS[checkin.mood] + ' ' : ''}${escapeHtml(checkin.ownerName)} · ${formatTime(checkin.createdAt)}
        </p>
      </div>
    `;
  } else {
    card.innerHTML = `
      <div class="checkin-card-text">
        ${checkin.mood ? `<div class="checkin-mood-emoji">${MOOD_EMOJIS[checkin.mood]}</div>` : ''}
        ${checkin.caption ? `<p style="font-size:17px;line-height:1.6;font-weight:500;color:var(--text-primary)">${escapeHtml(checkin.caption)}</p>` : ''}
        <p style="font-size:13px;color:var(--text-secondary);margin-top:4px">
          ${escapeHtml(checkin.ownerName)} · ${formatTime(checkin.createdAt)}
        </p>
      </div>
    `;
  }

  const picker = buildReactionPicker(checkin, onReact);
  const showPicker = () => {
    picker.classList.toggle('open');
  };

  attachLongPress(card, showPicker);
  wrapper.appendChild(card);
  wrapper.appendChild(picker);
  let actions = buildReactionSummary(checkin, showPicker);
  wrapper.appendChild(actions);

  const replyToggle = createReplyToggle(
    () => checkin.replies,
    () => navigate(getReplyPagePath(checkin.id)),
    'Trả lời',
    onReply,
  );
  wrapper.appendChild(replyToggle.toggle);
  wrapper.appendChild(replyToggle.panel);

  return {
    element: wrapper,
    patchInteractions: () => {
      const nextActions = buildReactionSummary(checkin, showPicker);
      actions.replaceWith(nextActions);
      actions = nextActions;

      picker.querySelectorAll<HTMLButtonElement>('[data-type]').forEach((button) => {
        const reaction = getReaction(checkin, button.dataset.type ?? '');
        button.classList.toggle('selected', Boolean(reaction?.reactedByMe));
      });

      replyToggle.sync();
    },
  };
}

interface CheckinCardView {
  element: HTMLElement;
  patchInteractions: () => void;
}

const ART_CLASSES = [
  'rm-photo-art-gradient-1',
  'rm-photo-art-gradient-2',
  'rm-photo-art-gradient-3',
  'rm-photo-art-gradient-4',
];

const ART_EMOJIS = ['🌸', '💌', '✨', '🌷', '💕', '🥰', '🌙', '🍀'];

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
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function buildRecentMemoriesSection(): HTMLElement {
  const section = document.createElement('div');
  section.className = 'recent-memories-section';

  // Header
  const header = document.createElement('div');
  header.className = 'recent-memories-header';
  header.innerHTML = `
    <div class="recent-memories-heading">
      <span class="recent-memories-eyebrow">Hôm nay</span>
      <span class="recent-memories-title">Ảnh đã gửi</span>
    </div>
  `;
  section.appendChild(header);

  // List placeholder skeleton
  const list = document.createElement('div');
  list.className = 'recent-memories-list';
  list.innerHTML = `
    <div class="recent-memory-item">
      <div class="recent-memory-card">
        <div class="skeleton" style="height:80px;border-radius:0;"></div>
        <div class="rm-body" style="gap:8px;">
          <div class="skeleton" style="height:12px;border-radius:6px;width:60%;"></div>
          <div class="skeleton" style="height:12px;border-radius:6px;width:80%;"></div>
        </div>
      </div>
    </div>
    <div class="recent-memory-item">
      <div class="recent-memory-card">
        <div class="skeleton" style="height:80px;border-radius:0;"></div>
        <div class="rm-body" style="gap:8px;">
          <div class="skeleton" style="height:12px;border-radius:6px;width:50%;"></div>
          <div class="skeleton" style="height:12px;border-radius:6px;width:70%;"></div>
        </div>
      </div>
    </div>
  `;
  section.appendChild(list);

  // Load today's photos, newest first.
  (async () => {
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const res = await getCheckins(1, 12, startOfToday.toISOString());
      const items = (res.data || [])
        .filter((item) => isToday(item.createdAt) && Boolean(getCheckinPhotoUrl(item)))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      list.innerHTML = '';

      if (items.length === 0) {
        list.innerHTML = `
          <div style="text-align:center;padding:20px 0;color:var(--text-secondary);font-size:14px;">
            Hôm nay chưa có ảnh check-in nào. 💕
          </div>
        `;
        return;
      }

      items.forEach((item, idx) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'recent-memory-item';

        const card = document.createElement('div');
        card.className = 'recent-memory-card';

        // ── Media section ──
        const photoUrl = getCheckinPhotoUrl(item);
        const hasPhoto = Boolean(photoUrl);

        if (hasPhoto && photoUrl) {
          const photoWrap = document.createElement('div');
          photoWrap.className = 'rm-photo-wrap';
          photoWrap.style.cursor = 'pointer';
          photoWrap.innerHTML = `
            <img src="${escapeHtml(photoUrl)}" alt="Ảnh kỷ niệm" loading="lazy" />
            <div class="rm-photo-overlay"></div>
          `;
          photoWrap.addEventListener('click', (event) => {
            event.stopPropagation();
            navigate('/app/memories');
          });
          card.appendChild(photoWrap);
        } else if (item.type === 'mood') {
          // Mood art placeholder
          const artDiv = document.createElement('div');
          artDiv.className = `rm-photo-art ${ART_CLASSES[idx % ART_CLASSES.length]}`;
          artDiv.innerHTML = `${MOOD_EMOJIS[item.mood || ''] || '😊'}`;
          card.appendChild(artDiv);
        } else {
          // Text art placeholder
          const artDiv = document.createElement('div');
          artDiv.className = `rm-photo-art ${ART_CLASSES[idx % ART_CLASSES.length]}`;
          artDiv.innerHTML = `${ART_EMOJIS[idx % ART_EMOJIS.length]}`;
          card.appendChild(artDiv);
        }

        // ── Body ──
        const body = document.createElement('div');
        body.className = 'rm-body';

        // Top row: meta + mood stamp
        const topRow = document.createElement('div');
        topRow.className = 'rm-top-row';

        const meta = document.createElement('div');
        meta.className = 'rm-meta';
        meta.innerHTML = `
          <span class="rm-owner">${escapeHtml(item.ownerName)}</span>
          <span class="rm-time">${formatTime(item.createdAt)}</span>
        `;

        topRow.appendChild(meta);

        const reactionBadges = document.createElement('div');
        reactionBadges.className = 'rm-reaction-badges';
        const updateReactionBadges = () => {
          reactionBadges.innerHTML = reactionPillsHtml(item);
        };
        updateReactionBadges();
        topRow.appendChild(reactionBadges);

        if (item.mood) {
          const moodStamp = document.createElement('div');
          moodStamp.className = 'rm-mood-stamp';
          moodStamp.setAttribute('aria-label', item.mood);
          moodStamp.textContent = MOOD_EMOJIS[item.mood] || '😊';
          topRow.appendChild(moodStamp);
        }

        body.appendChild(topRow);

        // Caption
        if (item.caption) {
          const caption = document.createElement('p');
          caption.className = 'rm-caption';
          caption.textContent = item.caption;
          body.appendChild(caption);
        }

        // Reaction row — heart button with optimistic update
        const reactionRow = document.createElement('div');
        reactionRow.className = 'rm-reaction-row';

        const heartBtn = document.createElement('button');
        heartBtn.type = 'button';
        heartBtn.className = 'rm-heart-btn react-button';
        heartBtn.dataset.icon = 'smile+';
        heartBtn.setAttribute('aria-label', 'Chọn cảm xúc');

        heartBtn.innerHTML = smilePlusIconMarkup;

        heartBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          openReactionPicker(item, updateReactionBadges);
        });


        const replyForm = document.createElement('form');
        replyForm.className = 'rm-inline-composer';
        replyForm.innerHTML = `
          <input aria-label="Gửi tin nhắn cho ảnh này" maxlength="500" placeholder="Gửi tin nhắn..." />
          <button type="button" class="rm-quick-react rm-reaction-choice react-button" data-icon="smile+" aria-label="Chọn cảm xúc">${smilePlusIconMarkup}</button>
          <button type="submit" class="rm-send-message" aria-label="Gửi tin nhắn">↑</button>
        `;

        const replyInput = replyForm.querySelector<HTMLInputElement>('input');
        const inlineReactionPicker = buildReactionPicker(item, async (type) => {
          try {
            item.reactions = await addReaction(item.id, type);
            updateReactionBadges();
            inlineReactionPicker.classList.remove('open');
          } catch {
            showToast('Không react được, thử lại nhé', 'error');
          }
        });
        const replyToggle = createReplyToggle(
          () => item.replies,
          () => navigate(getReplyPagePath(item.id)),
          'Trả lời',
          () => replyInput?.focus(),
        );
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
            replyToggle.sync();
            if (replyInput) {
              replyInput.value = '';
              replyInput.placeholder = 'Gửi tin nhắn...';
            }
            showToast('Đã gửi tin nhắn', 'success');
          } catch {
            showToast('Không gửi được tin nhắn, thử lại nhé', 'error');
          }
        });

        replyForm.querySelector<HTMLButtonElement>('.rm-reaction-choice')?.addEventListener('click', (event) => {
          event.stopPropagation();
          inlineReactionPicker.classList.toggle('open');
        });

        reactionRow.appendChild(replyForm);
        body.appendChild(reactionRow);
        body.appendChild(inlineReactionPicker);
        body.appendChild(replyToggle.toggle);
        body.appendChild(replyToggle.panel);

        // Only the oldest photo is the exit point to the full memory archive.
        if (idx === items.length - 1) {
          const viewAllButton = document.createElement('button');
          viewAllButton.type = 'button';
          viewAllButton.className = 'recent-memories-open-all';
          viewAllButton.textContent = 'Xem tất cả kỷ niệm →';
          viewAllButton.setAttribute('aria-label', 'Mở tất cả kỷ niệm');
          viewAllButton.addEventListener('click', (event) => {
            event.stopPropagation();
            navigate('/app/memories');
          });
          body.appendChild(viewAllButton);
        }

        card.appendChild(body);

        // Stagger animation delay
        card.style.animationDelay = `${idx * 60}ms`;

        wrapper.appendChild(card);
        list.appendChild(wrapper);
      });
    } catch {
      list.innerHTML = '';
      // Fail silently — main content still shows
    }
  })();

  return section;
}

function buildEmptyState(partnerName: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'empty-state animate-fade-in';
  el.innerHTML = `
    <div class="empty-state-emoji">\u{1F4ED}</div>
    <div class="empty-state-title">Chưa có gì mới hôm nay</div>
    <p class="empty-state-text">${escapeHtml(partnerName)} chưa gửi check-in nào hôm nay.<br>Bạn có thể gửi trước để bắt đầu nhé!</p>
    <button class="btn-primary" id="home-checkin-btn" style="margin-top:8px">
      Gửi check-in
    </button>
  `;
  return el;
}

export function renderHomePage(): HTMLElement {
  const state = store.get();
  const user = state.user;
  const couple = state.couple;
  const partnerName = user?.partnerName ?? 'Người ấy';

  const page = document.createElement('div');
  page.className = 'page animate-fade-in';

  const topBar = document.createElement('div');
  topBar.className = 'top-bar';
  topBar.style.cssText =
    'padding-top:calc(20px + env(safe-area-inset-top, 0px));padding-bottom:12px;';

  const streakBadge = document.createElement('div');
  const streak = calcStreak(couple);
  const days = calcDaysTogether(couple?.loveStartDate);
  streakBadge.innerHTML = `
    <div class="streak-banner">\u{1F525} ${streak} ngày</div>
    <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;padding-left:2px">
      ${days} ngày bên nhau
    </div>
  `;

  const rightActions = document.createElement('div');
  rightActions.style.cssText = 'display:flex;gap:8px;';

  const themeBtn = document.createElement('button');
  themeBtn.className = 'btn-icon';
  themeBtn.setAttribute('aria-label', 'Đổi giao diện');
  const currentTheme = state.theme;
  themeBtn.textContent =
    currentTheme === 'dark' ? '\u2600\uFE0F' : currentTheme === 'light' ? '\u{1F319}' : '\u{1F317}';
  themeBtn.addEventListener('click', () => {
    const s = store.get();
    const next = s.theme === 'dark' ? 'light' : s.theme === 'light' ? 'system' : 'dark';
    store.set({ theme: next });
    applyTheme(next);
    themeBtn.textContent = next === 'dark' ? '\u2600\uFE0F' : next === 'light' ? '\u{1F319}' : '\u{1F317}';
  });

  const refreshBtn = document.createElement('button');
  refreshBtn.className = 'btn-icon';
  refreshBtn.setAttribute('aria-label', 'Làm mới');
  refreshBtn.innerHTML = refreshIconMarkup;
  refreshBtn.addEventListener('click', () => {
    showToast('Đang tải lại check-in...', 'loading-spark');
    loadCheckin();
  });

  rightActions.appendChild(themeBtn);
  rightActions.appendChild(refreshBtn);
  topBar.appendChild(streakBadge);
  topBar.appendChild(rightActions);
  page.appendChild(topBar);

  const pushSlot = document.createElement('div');
  pushSlot.style.cssText = 'padding:0 16px 10px;';
  page.appendChild(pushSlot);

  const partnerLabel = document.createElement('div');
  partnerLabel.style.cssText =
    'padding:0 20px 8px;font-size:16px;font-weight:600;color:var(--text-primary);';
  partnerLabel.innerHTML = `
    <span style="color:var(--accent)">${escapeHtml(partnerName)}</span>
    <span style="color:var(--text-secondary);font-weight:400"> đã gửi cho bạn:</span>
  `;
  page.appendChild(partnerLabel);

  const contentArea = document.createElement('div');
  contentArea.style.cssText = 'padding:0 16px;';
  contentArea.appendChild(renderSkeleton());
  page.appendChild(contentArea);

  // Recent memories section — "Những điều rất nhỏ"
  const recentMemoriesSection = buildRecentMemoriesSection();
  recentMemoriesSection.style.cssText = 'margin-top:28px;padding-bottom:16px;';
  page.appendChild(recentMemoriesSection);

  async function renderPushPrompt() {
    if (!store.isAuthenticated()) return;

    const result = await getPushSetupState().catch(() => null);
    pushSlot.innerHTML = '';
    if (!result || result.status !== 'prompt') return;

    const card = document.createElement('div');
    card.className = 'push-permission-card';
    card.innerHTML = `
      <div>
        <strong>Bật thông báo check-in</strong>
        <span>Nhận noti khi người ấy gửi check-in, reply hoặc react.</span>
      </div>
      <button type="button" class="btn-primary">Bật</button>
    `;

    card.querySelector('button')?.addEventListener('click', async () => {
      const setup = await ensurePushSubscription(true).catch(
        (): PushSetupResult => ({ status: 'error', message: 'Chưa bật được thông báo' }),
      );
      if (setup.status === 'subscribed') {
        card.remove();
        showToast('Đã bật thông báo', 'success');
      } else {
        showToast(setup.message ?? 'Chưa bật được thông báo', 'error');
      }
    });

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
          showToast('Không thể react, thử lại nhé', 'error');
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

  async function loadCheckin(useCache = true) {
    if (useCache) {
      const cached = getCachedLatestPartnerCheckin();
      if (cached) {
        renderLoadedCheckin(cached);
      } else {
        contentArea.innerHTML = '';
        contentArea.appendChild(renderSkeleton());
      }
    } else {
      contentArea.innerHTML = '';
      contentArea.appendChild(renderSkeleton());
    }

    setRefreshButtonLoading(refreshBtn, true);

    try {
      const checkin = await getLatestPartnerCheckin({ force: true });
      setRefreshButtonLoading(refreshBtn, false);

      if (!checkin) {
        activeCheckin = null;
        activeCard = null;
        contentArea.replaceChildren();
        const empty = buildEmptyState(partnerName);
        contentArea.appendChild(empty);
        contentArea.querySelector('#home-checkin-btn')?.addEventListener('click', () => {
          navigate('/app/checkin');
        });
        return;
      }

      renderLoadedCheckin(checkin);

      // Sync with Android widget
      try {
        const bridge = (window as any).LoveCheckAndroid;
        if (bridge && typeof bridge.updatePartnerCheckin === 'function') {
          bridge.updatePartnerCheckin(
            partnerName,
            checkin.type,
            checkin.caption || '',
            checkin.photoUrl || '',
            checkin.createdAt
          );
        }
      } catch (e) {
        // ignore
      }
    } catch {
      setRefreshButtonLoading(refreshBtn, false);
      if (getCachedLatestPartnerCheckin()) {
        showToast('Không thể làm mới dữ liệu', 'error');
        return;
      }
      activeCheckin = null;
      activeCard = null;
      contentArea.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-emoji">\u{1F622}</div>
          <div class="empty-state-title">Không tải được dữ liệu</div>
          <p class="empty-state-text">Kiểm tra kết nối mạng và thử lại</p>
          <button class="btn-ghost" id="retry-btn" style="margin-top:8px">Thử lại</button>
        </div>
      `;
      contentArea.querySelector('#retry-btn')?.addEventListener('click', () => loadCheckin(false));
    }
  }

  renderPushPrompt();
  if (getCachedLatestPartnerCheckin()) {
    loadCheckin(true);
  } else {
    setTimeout(() => loadCheckin(), 3000);
  }
  return page;
}

function toggleReactionOptimistically(reactions: Reaction[], type: ReactionType): Reaction[] {
  const current = reactions.find((reaction) => reaction.type === type);
  if (!current) return [...reactions, { type, count: 1, reactedByMe: true }];

  if (current.reactedByMe) {
    const nextCount = Math.max(0, current.count - 1);
    return reactions
      .map((reaction) => reaction.type === type ? { ...reaction, count: nextCount, reactedByMe: false } : reaction)
      .filter((reaction) => reaction.count > 0);
  }

  return reactions.map((reaction) => reaction.type === type ? { ...reaction, count: reaction.count + 1, reactedByMe: true } : reaction);
}
