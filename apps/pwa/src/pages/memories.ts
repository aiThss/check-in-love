import { navigate } from '../router';
import { getCheckins, addReaction, addReply } from '../api/checkins';
import { createNav } from '../components/nav';
import { showToast } from '../components/toast';
import { showModal } from '../components/modal';
import type { CheckIn, CheckInReply, Reaction, ReactionType } from '../api/types';

let cachedMemories: CheckIn[] = [];
let cachedTotal = 0;
let cachedTotalPages = 1;

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
  return date.toLocaleDateString('vi-VN', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFullDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getReaction(checkin: CheckIn, type: ReactionType): Reaction | undefined {
  return checkin.reactions.find((reaction) => reaction.type === type);
}

function attachLongPress(target: HTMLElement, onLongPress: () => void): () => boolean {
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
    if (!longPressed) {
      longPressed = true;
      onLongPress();
    }
  });

  return () => {
    const wasLongPressed = longPressed;
    longPressed = false;
    return wasLongPressed;
  };
}

function buildReactionPicker(
  item: CheckIn,
  onReact: (type: ReactionType) => void,
): HTMLElement {
  const picker = document.createElement('div');
  picker.className = 'reaction-picker memory-reaction-picker';

  REACTIONS.forEach(({ type, emoji, label }) => {
    const existing = getReaction(item, type);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `reaction-option${existing?.reactedByMe ? ' selected' : ''}`;
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

function buildSocialRow(
  item: CheckIn,
  onShowPicker: () => void,
  onShowReactionDetails: () => void,
  onReply: () => void,
): HTMLElement {
  const row = document.createElement('div');
  row.className = 'memory-social-row';

  const activeReactions = item.reactions.filter((reaction) => reaction.count > 0);

  const reactionBtn = document.createElement('button');
  reactionBtn.type = 'button';
  reactionBtn.className = 'memory-reaction-summary';
  reactionBtn.addEventListener('click', onShowPicker);

  if (activeReactions.length === 0) {
    reactionBtn.textContent = 'Giữ để react.';
  } else {
    reactionBtn.innerHTML = activeReactions
      .map(
        (reaction) =>
          `<span class="reaction-pill${reaction.reactedByMe ? ' selected' : ''}">${escapeHtml(reaction.type)}<strong>${reaction.count}</strong></span>`,
      )
      .join('');
  }

  const detailBtn = document.createElement('button');
  detailBtn.type = 'button';
  detailBtn.className = 'memory-react-detail-btn';
  detailBtn.textContent = 'Chi tiết';
  detailBtn.addEventListener('click', onShowReactionDetails);

  const replyCount = document.createElement('button');
  replyCount.type = 'button';
  replyCount.className = 'memory-reply-count';
  replyCount.textContent = item.replies.length ? `${item.replies.length} reply` : 'No reply';
  replyCount.addEventListener('click', onReply);

  row.appendChild(reactionBtn);
  row.appendChild(detailBtn);
  row.appendChild(replyCount);
  return row;
}

function renderReplies(container: HTMLElement, replies: CheckInReply[]): void {
  container.innerHTML = '';

  if (replies.length === 0) {
    container.innerHTML = `<p class="reply-empty">No reply.</p>`;
    return;
  }

  replies.forEach((reply) => {
    const item = document.createElement('div');
    item.className = `reply-detail-item${reply.isOwn ? ' own' : ''}`;
    item.innerHTML = `
      <div class="reply-detail-meta">
        <strong>${escapeHtml(reply.userName)}</strong>
        <span>${formatTime(reply.createdAt)}</span>
      </div>
      <p>${escapeHtml(reply.message)}</p>
    `;
    container.appendChild(item);
  });
}

export function renderMemoriesPage(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'page memories-page animate-fade-in';
  root.style.cssText = `
    padding: calc(var(--safe-top) + 24px) 16px calc(var(--safe-bottom) + 100px) 16px;
    max-width: 480px;
    margin: 0 auto;
    width: 100%;
    box-sizing: border-box;
    min-height: 100dvh;
    overflow-x: hidden;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  `;

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:12px;';
  header.innerHTML = `
    <div>
      <h1 style="font-size:24px;font-weight:700;letter-spacing:-0.03em;">Kỷ niệm của hai đứa</h1>
      <p id="memories-count" style="font-size:13px;color:var(--text-secondary);">Đang tải khoảnh khắc...</p>
    </div>
    <button id="refresh-btn" class="btn-icon" style="border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;">\u{1F504}</button>
  `;
  root.appendChild(header);

  const content = document.createElement('div');
  content.style.cssText = 'display:flex;flex-direction:column;gap:12px;width:100%;';
  root.appendChild(content);

  const grid = document.createElement('div');
  grid.className = 'memory-grid';
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;';
  content.appendChild(grid);

  let currentPage = 1;
  let totalPages = cachedTotalPages;
  let isLoading = false;
  let allItems: CheckIn[] = [...cachedMemories];

  const loadMoreBtn = document.createElement('button');
  loadMoreBtn.className = 'btn-ghost';
  loadMoreBtn.style.cssText = 'width:100%;padding:12px;margin-top:12px;font-weight:600;display:none;';
  loadMoreBtn.textContent = 'Xem thêm khoảnh khắc';
  content.appendChild(loadMoreBtn);

  if (cachedMemories.length > 0) {
    // Render cache immediately
    renderGrid(allItems);
    const countEl = header.querySelector('#memories-count');
    if (countEl) {
      countEl.textContent = `${cachedTotal} khoảnh khắc đã ghi dấu`;
    }
    loadMoreBtn.style.display = currentPage < totalPages ? 'block' : 'none';
  }

  async function reactToItem(item: CheckIn, type: ReactionType, refreshDetail?: () => void) {
    try {
      const newReactions = await addReaction(item.id, type);
      const matchedItem = allItems.find((candidate) => candidate.id === item.id);
      if (matchedItem) matchedItem.reactions = newReactions;
      item.reactions = newReactions;
      renderGrid(allItems);
      refreshDetail?.();
    } catch {
      showToast('Không react được, thử lại nhé', 'error');
    }
  }

  function showReactionDetails(item: CheckIn) {
    const content = document.createElement('div');
    content.className = 'reaction-detail-list';

    const activeReactions = item.reactions.filter((reaction) => reaction.count > 0);
    if (activeReactions.length === 0) {
      content.innerHTML = `<p class="reply-empty">Chưa có reaction nào.</p>`;
    } else {
      activeReactions.forEach((reaction) => {
        const row = document.createElement('div');
        row.className = `reaction-detail-row${reaction.reactedByMe ? ' selected' : ''}`;
        row.innerHTML = `
          <span class="reaction-detail-emoji">${escapeHtml(reaction.type)}</span>
          <span>${reaction.count} lượt react</span>
          ${reaction.reactedByMe ? '<strong>Bạn</strong>' : ''}
        `;
        content.appendChild(row);
      });
    }

    showModal({
      title: 'Chi tiết react',
      content,
      center: true,
    });
  }

  async function fetchMemories(page = 1, append = false) {
    if (isLoading) return;
    isLoading = true;

    const refreshBtn = header.querySelector('#refresh-btn');
    if (refreshBtn) refreshBtn.classList.add('animate-spin');

    if (page === 1 && !append && cachedMemories.length === 0) {
      grid.innerHTML = `
        <div class="skeleton" style="height:170px;border-radius:20px;"></div>
        <div class="skeleton" style="height:170px;border-radius:20px;"></div>
        <div class="skeleton" style="height:170px;border-radius:20px;"></div>
        <div class="skeleton" style="height:170px;border-radius:20px;"></div>
      `;
    }

    try {
      const res = await getCheckins(page, 14);
      isLoading = false;
      const refreshBtn = header.querySelector('#refresh-btn');
      if (refreshBtn) refreshBtn.classList.remove('animate-spin');

      const items = res.data || [];
      currentPage = res.page;
      totalPages = Math.ceil(res.total / res.limit);

      allItems = page === 1 ? items : [...allItems, ...items];
      if (page === 1) {
        cachedMemories = items;
        cachedTotal = res.total;
        cachedTotalPages = totalPages;
      }
      renderGrid(allItems);

      const countEl = header.querySelector('#memories-count');
      if (countEl) {
        countEl.textContent = `${res.total} khoảnh khắc đã ghi dấu`;
      }

      loadMoreBtn.style.display = currentPage < totalPages ? 'block' : 'none';
    } catch (err) {
      const error = err as Error;
      isLoading = false;
      const refreshBtn = header.querySelector('#refresh-btn');
      if (refreshBtn) refreshBtn.classList.remove('animate-spin');
      showToast('Không thể tải kỷ niệm: ' + error.message, 'error');
    }
  }

  function renderGrid(items: CheckIn[]) {
    grid.innerHTML = '';

    if (items.length === 0) {
      grid.style.display = 'none';
      const empty = document.createElement('div');
      empty.className = 'empty-state animate-fade-in';
      empty.innerHTML = `
        <div class="empty-state-emoji">\u{1F338}</div>
        <h3 class="empty-state-title">Chưa có kỷ niệm nào</h3>
        <p class="empty-state-text">Hãy gửi tấm check-in đầu tiên để ghi lại khoảnh khắc bên nhau nhé!</p>
        <button id="empty-checkin-btn" class="btn-primary" style="margin-top:12px;">Gửi check-in ngay</button>
      `;
      content.appendChild(empty);

      empty.querySelector('#empty-checkin-btn')?.addEventListener('click', () => {
        navigate('/app/checkin');
      });
      return;
    }

    grid.style.display = 'grid';
    const oldEmpty = content.querySelector('.empty-state');
    if (oldEmpty) oldEmpty.remove();

    items.forEach((item) => {
      const tile = document.createElement('div');
      tile.className = 'memory-tile';

      const card = document.createElement('div');
      card.className = 'memory-item';

      if (item.type === 'photo') {
        card.style.cssText = 'position:relative;border-radius:20px;overflow:hidden;aspect-ratio:1;';
        card.innerHTML = `
          <img src="${escapeHtml(item.photoUrl)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy" />
          <div class="memory-item-info">
            <span style="font-size:11px;opacity:0.9;color:#fff;">${escapeHtml(item.ownerName)}</span>
            <span class="memory-item-info-text" style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${escapeHtml(item.caption || 'Gửi ảnh check-in')}
            </span>
          </div>
        `;
      } else if (item.type === 'mood') {
        const emoji = MOOD_EMOJIS[item.mood || ''] || '\u{1F60A}';
        card.style.cssText =
          'border-radius:20px;padding:16px;background:var(--surface-solid);border:1px solid var(--border);display:flex;flex-direction:column;gap:8px;aspect-ratio:1;justify-content:center;align-items:center;text-align:center;';
        card.innerHTML = `
          <span style="font-size:40px;">${emoji}</span>
          <span style="font-size:13px;font-weight:600;color:var(--text-primary);line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
            ${escapeHtml(item.caption || 'Cảm xúc hiện tại')}
          </span>
          <span style="font-size:10px;color:var(--text-secondary);">${escapeHtml(item.ownerName)} - ${formatTime(item.createdAt)}</span>
        `;
      } else {
        card.style.cssText =
          'border-radius:20px;padding:16px;background:var(--surface-solid);border:1px solid var(--border);display:flex;flex-direction:column;gap:8px;aspect-ratio:1;justify-content:center;align-items:flex-start;';
        card.innerHTML = `
          <span style="font-size:13px;font-weight:500;color:var(--text-primary);line-height:1.4;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;text-align:left;">
            ${escapeHtml(item.caption)}
          </span>
          <span style="font-size:10px;color:var(--text-secondary);margin-top:auto;">${escapeHtml(item.ownerName)} - ${formatTime(item.createdAt)}</span>
        `;
      }

      const picker = buildReactionPicker(item, (type) => reactToItem(item, type));
      const consumeLongPress = attachLongPress(card, () => {
        picker.classList.toggle('open');
      });

      card.addEventListener('click', () => {
        if (consumeLongPress()) return;
        showCheckinDetail(item);
      });

      tile.appendChild(card);
      tile.appendChild(picker);
      tile.appendChild(
        buildSocialRow(
          item,
          () => picker.classList.toggle('open'),
          () => showReactionDetails(item),
          () => showCheckinDetail(item),
        ),
      );
      grid.appendChild(tile);
    });
  }

  function showCheckinDetail(item: CheckIn) {
    const detail = document.createElement('div');
    detail.className = 'checkin-detail';

    const renderDetailContent = () => {
      let contentHtml = '';
      if (item.type === 'photo') {
        contentHtml = `
          <div class="checkin-detail-media">
            <img src="${escapeHtml(item.photoUrl)}" alt="Ảnh check-in" />
          </div>
          ${item.caption ? `<p class="checkin-detail-caption">${escapeHtml(item.caption)}</p>` : ''}
        `;

      } else if (item.type === 'mood') {
        const emoji = MOOD_EMOJIS[item.mood || ''] || '\u{1F60A}';
        contentHtml = `
          <div class="checkin-detail-mood">
            <span>${emoji}</span>
            ${item.caption ? `<p>${escapeHtml(item.caption)}</p>` : ''}
          </div>
        `;
      } else {
        contentHtml = `
          <div class="checkin-detail-text">${escapeHtml(item.caption)}</div>
        `;
      }

      const activeReactions = item.reactions.filter((reaction) => reaction.count > 0);

      detail.innerHTML = `
        ${contentHtml}
        <div class="checkin-detail-meta">
          <span>Gửi bởi <strong>${escapeHtml(item.ownerName)}</strong></span>
          <time>${formatFullDateTime(item.createdAt)}</time>
        </div>
        <div class="checkin-detail-social">
          <div class="reaction-summary detail-reactions">
            ${
              activeReactions.length
                ? activeReactions
                    .map(
                      (reaction) =>
                        `<span class="reaction-pill${reaction.reactedByMe ? ' selected' : ''}">${escapeHtml(reaction.type)}<strong>${reaction.count}</strong></span>`,
                    )
                    .join('')
                : '<span class="reaction-hint">Giữ để react.</span>'
            }
          </div>
        </div>
        <div class="reply-section">
          <div class="reply-section-title">
            <h4>Replies</h4>
            <span>${item.replies.length}</span>
          </div>
          <div id="reply-list" class="reply-detail-list"></div>
          <form id="reply-form" class="inline-reply-form">
            <input id="reply-input" maxlength="500" placeholder="Viết reply..." />
            <button type="submit">Gửi</button>
          </form>
        </div>
      `;

      const replyList = detail.querySelector<HTMLElement>('#reply-list');
      if (replyList) renderReplies(replyList, item.replies);

      // Inject download button into media wrapper for photo check-ins
      if (item.type === 'photo' && item.photoUrl) {
        const mediaEl = detail.querySelector<HTMLElement>('.checkin-detail-media');
        if (mediaEl) {
          const dlBtn = document.createElement('button');
          dlBtn.type = 'button';
          dlBtn.className = 'download-btn';
          dlBtn.setAttribute('aria-label', 'Tải ảnh xuống');
          dlBtn.innerHTML = '&#x2193;'; // ↓ arrow icon

          dlBtn.addEventListener('click', async () => {
            const photoUrl = item.photoUrl;
            if (!photoUrl) return;

            dlBtn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;border-color:#fff transparent transparent transparent;"></span>';
            dlBtn.style.pointerEvents = 'none';

            try {
              // Fetch as blob to support cross-origin images
              const response = await fetch(photoUrl, { mode: 'cors' });
              const blob = await response.blob();
              const objectUrl = URL.createObjectURL(blob);

              const ts = new Date(item.createdAt);
              const pad = (n: number) => String(n).padStart(2, '0');
              const fileName = `checkin-love-${ts.getFullYear()}-${pad(ts.getMonth() + 1)}-${pad(ts.getDate())}-${pad(ts.getHours())}-${pad(ts.getMinutes())}.jpg`;

              const anchor = document.createElement('a');
              anchor.href = objectUrl;
              anchor.download = fileName;
              anchor.style.display = 'none';
              document.body.appendChild(anchor);
              anchor.click();
              document.body.removeChild(anchor);

              setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
            } catch {
              // Fallback: open in new tab so user can long-press save
              window.open(photoUrl, '_blank', 'noopener,noreferrer');
            } finally {
              dlBtn.innerHTML = '&#x2193;';
              dlBtn.style.pointerEvents = '';
            }
          });

          mediaEl.appendChild(dlBtn);
        }
      }

      const replyForm = detail.querySelector<HTMLFormElement>('#reply-form');
      replyForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const input = detail.querySelector<HTMLInputElement>('#reply-input');
        const message = input?.value.trim() ?? '';
        if (!message) return;

        try {
          const replies = await addReply(item.id, message);
          const matchedItem = allItems.find((candidate) => candidate.id === item.id);
          if (matchedItem) matchedItem.replies = replies;
          item.replies = replies;
          if (input) input.value = '';
          renderDetailContent();
          renderGrid(allItems);
        } catch {
          showToast('Không gửi được reply', 'error');
        }
      });
    };

    renderDetailContent();

    showModal({
      title: 'Chi tiết khoảnh khắc',
      content: detail,
      center: true,
    });
  }

  fetchMemories(1);

  header.querySelector('#refresh-btn')?.addEventListener('click', () => {
    fetchMemories(1);
    showToast('Đang tải lại kỷ niệm...', 'info');
  });

  loadMoreBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
      fetchMemories(currentPage + 1, true);
    }
  });

  root.appendChild(createNav('/app/memories'));

  return root;
}
