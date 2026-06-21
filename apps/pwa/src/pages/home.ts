import { navigate } from '../router';
import { store, applyTheme } from '../store/index';
import { getLatestPartnerCheckin, getCachedLatestPartnerCheckin, addReaction, addReply } from '../api/checkins';
import { ensurePushSubscription, getPushSetupState } from '../api/push';
import { createNav } from '../components/nav';
import { showModal } from '../components/modal';
import { showToast } from '../components/toast';
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
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffH < 24) return `${diffH} giờ trước`;
  if (diffD === 1) return 'Hôm qua';
  return date.toLocaleDateString('vi-VN');
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
    <div class="skeleton" style="height:300px;border-radius:28px;"></div>
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
  onReply: () => void,
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

  const replyBtn = document.createElement('button');
  replyBtn.type = 'button';
  replyBtn.className = 'reply-button';
  replyBtn.textContent = `Reply${checkin.replies.length ? ` ${checkin.replies.length}` : ''}`;
  replyBtn.addEventListener('click', onReply);

  row.appendChild(summary);
  row.appendChild(replyBtn);
  return row;
}

function buildReplyPreview(replies: CheckInReply[]): HTMLElement | null {
  if (replies.length === 0) return null;

  const wrapper = document.createElement('div');
  wrapper.className = 'reply-preview-list';

  replies.slice(-2).forEach((reply) => {
    const item = document.createElement('div');
    item.className = `reply-preview${reply.isOwn ? ' own' : ''}`;
    item.innerHTML = `
      <strong>${escapeHtml(reply.userName)}</strong>
      <span>${escapeHtml(reply.message)}</span>
    `;
    wrapper.appendChild(item);
  });

  return wrapper;
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

      const replies = await addReply(checkin.id, message);
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
): HTMLElement {
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
  wrapper.appendChild(buildReactionSummary(checkin, showPicker, onReply));

  const replies = buildReplyPreview(checkin.replies);
  if (replies) wrapper.appendChild(replies);

  return wrapper;
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
  refreshBtn.textContent = '\u{1F504}';
  refreshBtn.addEventListener('click', () => loadCheckin());

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

  page.appendChild(createNav('/app/home'));

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

  function renderLoadedCheckin(checkin: CheckIn) {
    contentArea.innerHTML = '';

    const render = () => {
      contentArea.innerHTML = '';
      const cardEl = buildCheckinCard(
        checkin,
        async (type) => {
          try {
            checkin.reactions = await addReaction(checkin.id, type);
            render();
          } catch {
            showToast('Không thể react, thử lại nhé', 'error');
          }
        },
        () => {
          showReplyComposer(checkin, (replies) => {
            checkin.replies = replies;
            render();
          });
        },
      );
      contentArea.appendChild(cardEl);
    };

    render();
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

    refreshBtn.classList.add('animate-spin');

    try {
      const checkin = await getLatestPartnerCheckin();
      contentArea.innerHTML = '';
      refreshBtn.classList.remove('animate-spin');

      if (!checkin) {
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
      refreshBtn.classList.remove('animate-spin');
      if (getCachedLatestPartnerCheckin()) {
        showToast('Không thể làm mới dữ liệu', 'error');
        return;
      }
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
  loadCheckin();
  return page;
}
