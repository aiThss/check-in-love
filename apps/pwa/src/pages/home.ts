import { navigate } from '../router';
import { store, applyTheme } from '../store/index';
import { getLatestPartnerCheckin, addReaction } from '../api/checkins';
import { createNav } from '../components/nav';
import { showToast } from '../components/toast';
import type { CheckIn, Reaction, ReactionType } from '../api/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

const MOOD_LABELS: Record<string, string> = {
  happy: '😊 Vui vẻ',
  love: '🥰 Đang yêu',
  sad: '😢 Buồn',
  excited: '🤩 Hào hứng',
  tired: '😴 Mệt mỏi',
  calm: '😌 Bình yên',
  miss: '🥺 Nhớ nhau',
};

const MOOD_EMOJIS: Record<string, string> = {
  happy: '😊', love: '🥰', sad: '😢', excited: '🤩',
  tired: '😴', calm: '😌', miss: '🥺',
};

const REACTIONS: ReactionType[] = ['❤️', '🤗', '💋', '😂', '🥺'];

// ── Skeleton ──────────────────────────────────────────────────────────────────

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

// ── Reaction Bar ──────────────────────────────────────────────────────────────

function buildReactionBar(
  checkin: CheckIn,
  onReact: (type: ReactionType) => void,
): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'reaction-bar';
  bar.style.cssText = 'padding:12px 4px;gap:8px;flex-wrap:nowrap;overflow-x:auto;';

  REACTIONS.forEach((emoji) => {
    const existing = checkin.reactions.find((r: Reaction) => r.type === emoji);
    const count = existing?.count ?? 0;
    const selected = existing?.reactedByMe ?? false;

    const btn = document.createElement('button');
    btn.className = `reaction-btn${selected ? ' selected' : ''}`;
    btn.dataset.type = emoji;
    btn.innerHTML = `
      <span>${emoji}</span>
      ${count > 0 ? `<span class="reaction-count">${count}</span>` : ''}
    `;
    btn.addEventListener('click', () => onReact(emoji));
    bar.appendChild(btn);
  });

  return bar;
}

// ── Check-in Card ─────────────────────────────────────────────────────────────

function buildCheckinCard(checkin: CheckIn, onReact: (type: ReactionType) => void): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

  const card = document.createElement('div');
  card.className = 'checkin-card animate-slide-up';

  if (checkin.type === 'photo' && checkin.photoUrl) {
    card.innerHTML = `
      <img
        class="checkin-card-image"
        src="${checkin.photoUrl}"
        alt="Ảnh check-in"
        loading="lazy"
      />
      <div class="checkin-card-overlay">
        ${checkin.caption ? `<p class="checkin-card-overlay-text">${checkin.caption}</p>` : ''}
        <p class="checkin-card-overlay-meta">
          ${checkin.mood ? MOOD_EMOJIS[checkin.mood] + ' ' : ''}${checkin.ownerName} · ${formatTime(checkin.createdAt)}
        </p>
      </div>
    `;
  } else {
    card.innerHTML = `
      <div class="checkin-card-text">
        ${checkin.mood ? `<div class="checkin-mood-emoji">${MOOD_EMOJIS[checkin.mood]}</div>` : ''}
        ${checkin.caption ? `<p style="font-size:17px;line-height:1.6;font-weight:500;color:var(--text-primary)">${checkin.caption}</p>` : ''}
        <p style="font-size:13px;color:var(--text-secondary);margin-top:4px">
          ${checkin.ownerName} · ${formatTime(checkin.createdAt)}
        </p>
      </div>
    `;
  }

  wrapper.appendChild(card);
  wrapper.appendChild(buildReactionBar(checkin, onReact));
  return wrapper;
}

// ── Empty State ───────────────────────────────────────────────────────────────

function buildEmptyState(partnerName: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'empty-state animate-fade-in';
  el.innerHTML = `
    <div class="empty-state-emoji">📭</div>
    <div class="empty-state-title">Chưa có gì mới hôm nay</div>
    <p class="empty-state-text">${partnerName} chưa gửi check-in nào hôm nay.<br>Bạn có thể gửi trước để bắt đầu nhé!</p>
    <button class="btn-primary" id="home-checkin-btn" style="margin-top:8px">
      Gửi check-in 💕
    </button>
  `;
  return el;
}

// ── Home Page ─────────────────────────────────────────────────────────────────

export function renderHomePage(): HTMLElement {
  const state = store.get();
  const user = state.user;
  const couple = state.couple;
  const partnerName = user?.partnerName ?? 'Người ấy';

  // Root
  const page = document.createElement('div');
  page.className = 'page animate-fade-in';

  // ── Top bar ─────────────────────────────────────────────────────────────
  const topBar = document.createElement('div');
  topBar.className = 'top-bar';
  topBar.style.cssText =
    'padding-top:calc(20px + env(safe-area-inset-top, 0px));padding-bottom:12px;';

  const streakBadge = document.createElement('div');
  const streak = calcStreak(couple);
  const days = calcDaysTogether(couple?.loveStartDate);
  streakBadge.innerHTML = `
    <div class="streak-banner">🔥 ${streak} ngày</div>
    <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;padding-left:2px">
      ${days} ngày bên nhau
    </div>
  `;

  const rightActions = document.createElement('div');
  rightActions.style.cssText = 'display:flex;gap:8px;';

  // Theme toggle button
  const themeBtn = document.createElement('button');
  themeBtn.className = 'btn-icon';
  themeBtn.setAttribute('aria-label', 'Đổi giao diện');
  const currentTheme = state.theme;
  themeBtn.textContent = currentTheme === 'dark' ? '☀️' : currentTheme === 'light' ? '🌙' : '🌗';
  themeBtn.addEventListener('click', () => {
    const s = store.get();
    const next = s.theme === 'dark' ? 'light' : s.theme === 'light' ? 'system' : 'dark';
    store.set({ theme: next });
    applyTheme(next);
    themeBtn.textContent = next === 'dark' ? '☀️' : next === 'light' ? '🌙' : '🌗';
  });

  // Refresh button
  const refreshBtn = document.createElement('button');
  refreshBtn.className = 'btn-icon';
  refreshBtn.setAttribute('aria-label', 'Làm mới');
  refreshBtn.textContent = '🔄';
  refreshBtn.addEventListener('click', () => loadCheckin());

  rightActions.appendChild(themeBtn);
  rightActions.appendChild(refreshBtn);
  topBar.appendChild(streakBadge);
  topBar.appendChild(rightActions);
  page.appendChild(topBar);

  // ── Partner label ───────────────────────────────────────────────────────
  const partnerLabel = document.createElement('div');
  partnerLabel.style.cssText =
    'padding:0 20px 8px;font-size:16px;font-weight:600;color:var(--text-primary);';
  partnerLabel.innerHTML = `
    <span style="color:var(--accent)">${partnerName}</span>
    <span style="color:var(--text-secondary);font-weight:400"> đã gửi cho bạn:</span>
  `;
  page.appendChild(partnerLabel);

  // ── Content area ────────────────────────────────────────────────────────
  const contentArea = document.createElement('div');
  contentArea.style.cssText = 'padding:0 16px;';
  contentArea.appendChild(renderSkeleton());
  page.appendChild(contentArea);

  // ── Nav ─────────────────────────────────────────────────────────────────
  page.appendChild(createNav('/app/home'));

  // ── Load check-in ────────────────────────────────────────────────────────
  async function loadCheckin() {
    contentArea.innerHTML = '';
    contentArea.appendChild(renderSkeleton());
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

      partnerLabel.innerHTML = `
        <span style="color:var(--accent)">${partnerName}</span>
        <span style="color:var(--text-secondary);font-weight:400"> đã gửi cho bạn:</span>
      `;

      const cardEl = buildCheckinCard(checkin, async (type) => {
        try {
          const updatedReactions = await addReaction(checkin.id, type);
          // Update reaction bar
          const bar = cardEl.querySelector('.reaction-bar');
          if (bar) {
            REACTIONS.forEach((emoji) => {
              const btn = bar.querySelector<HTMLElement>(`[data-type="${emoji}"]`);
              if (!btn) return;
              const r = updatedReactions.find((rx: Reaction) => rx.type === emoji);
              const count = r?.count ?? 0;
              const selected = r?.reactedByMe ?? false;
              btn.className = `reaction-btn${selected ? ' selected' : ''}`;
              btn.innerHTML = `<span>${emoji}</span>${count > 0 ? `<span class="reaction-count">${count}</span>` : ''}`;
            });
          }
        } catch {
          showToast('Không thể thả tim, thử lại nhé 🥺', 'error');
        }
      });

      contentArea.appendChild(cardEl);
    } catch (err) {
      refreshBtn.classList.remove('animate-spin');
      contentArea.innerHTML = '';
      contentArea.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-emoji">😢</div>
          <div class="empty-state-title">Không tải được dữ liệu</div>
          <p class="empty-state-text">Kiểm tra kết nối mạng và thử lại</p>
          <button class="btn-ghost" id="retry-btn" style="margin-top:8px">Thử lại</button>
        </div>
      `;
      contentArea.querySelector('#retry-btn')?.addEventListener('click', () => loadCheckin());
    }
  }

  loadCheckin();
  return page;
}
