import { navigate } from '../router';
import { getCheckins, addReaction, addReply } from '../api/checkins';
import { createNav } from '../components/nav';
import { showToast } from '../components/toast';
import { showModal } from '../components/modal';
import type { CheckIn, CheckInReply, Reaction, ReactionType } from '../api/types';

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
  { type: 'heart', emoji: '\u2764\uFE0F', label: 'Yeu' },
  { type: 'hug', emoji: '\u{1F917}', label: 'Om' },
  { type: 'kiss', emoji: '\u{1F48B}', label: 'Hon' },
  { type: 'laugh', emoji: '\u{1F602}', label: 'Cuoi' },
  { type: 'miss', emoji: '\u{1F97A}', label: 'Nho' },
  { type: 'wow', emoji: '\u{1F929}', label: 'Wow' },
  { type: 'fire', emoji: '\u{1F525}', label: 'Xinh' },
  { type: 'sad', emoji: '\u{1F972}', label: 'Thuong' },
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

  if (diffMin < 1) return 'Vua xong';
  if (diffMin < 60) return `${diffMin} phut truoc`;
  if (diffH < 24) return `${diffH} gio truoc`;
  if (diffD === 1) return 'Hom qua';
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

  return picker;
}

function buildSocialRow(item: CheckIn, onShowPicker: () => void): HTMLElement {
  const row = document.createElement('div');
  row.className = 'memory-social-row';

  const activeReactions = REACTIONS
    .map(({ type, emoji }) => ({ emoji, reaction: getReaction(item, type) }))
    .filter((entry) => (entry.reaction?.count ?? 0) > 0);

  const reactionBtn = document.createElement('button');
  reactionBtn.type = 'button';
  reactionBtn.className = 'memory-reaction-summary';
  reactionBtn.addEventListener('click', onShowPicker);

  if (activeReactions.length === 0) {
    reactionBtn.textContent = 'Bam giu de react';
  } else {
    reactionBtn.innerHTML = activeReactions
      .slice(0, 4)
      .map(
        ({ emoji, reaction }) =>
          `<span class="reaction-pill${reaction?.reactedByMe ? ' selected' : ''}">${emoji}<strong>${reaction?.count ?? 0}</strong></span>`,
      )
      .join('');
  }

  const replyCount = document.createElement('span');
  replyCount.className = 'memory-reply-count';
  replyCount.textContent = item.replies.length ? `${item.replies.length} reply` : 'Chua co reply';

  row.appendChild(reactionBtn);
  row.appendChild(replyCount);
  return row;
}

function renderReplies(container: HTMLElement, replies: CheckInReply[]): void {
  container.innerHTML = '';

  if (replies.length === 0) {
    container.innerHTML = `<p class="reply-empty">Chua co reply nao.</p>`;
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
      <h1 style="font-size:24px;font-weight:700;letter-spacing:-0.03em;">Ky niem cua hai dua</h1>
      <p id="memories-count" style="font-size:13px;color:var(--text-secondary);">Dang tai khoanh khac...</p>
    </div>
    <button id="refresh-btn" class="btn-icon" style="border-radius:50%;width:40px;height:40px;">\u{1F504}</button>
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
  let totalPages = 1;
  let isLoading = false;
  let allItems: CheckIn[] = [];

  const loadMoreBtn = document.createElement('button');
  loadMoreBtn.className = 'btn-ghost';
  loadMoreBtn.style.cssText = 'width:100%;padding:12px;margin-top:12px;font-weight:600;display:none;';
  loadMoreBtn.textContent = 'Xem them khoanh khac';
  content.appendChild(loadMoreBtn);

  async function reactToItem(item: CheckIn, type: ReactionType, refreshDetail?: () => void) {
    try {
      const newReactions = await addReaction(item.id, type);
      const matchedItem = allItems.find((candidate) => candidate.id === item.id);
      if (matchedItem) matchedItem.reactions = newReactions;
      item.reactions = newReactions;
      renderGrid(allItems);
      refreshDetail?.();
    } catch {
      showToast('Khong react duoc, thu lai nhe', 'error');
    }
  }

  async function fetchMemories(page = 1, append = false) {
    if (isLoading) return;
    isLoading = true;

    if (page === 1 && !append) {
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

      const items = res.data || [];
      currentPage = res.page;
      totalPages = Math.ceil(res.total / res.limit);

      allItems = page === 1 ? items : [...allItems, ...items];
      renderGrid(allItems);

      const countEl = header.querySelector('#memories-count');
      if (countEl) {
        countEl.textContent = `${res.total} khoanh khac da ghi dau`;
      }

      loadMoreBtn.style.display = currentPage < totalPages ? 'block' : 'none';
    } catch (err: any) {
      isLoading = false;
      showToast('Khong the tai ky niem: ' + err.message, 'error');
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
        <h3 class="empty-state-title">Chua co ky niem nao</h3>
        <p class="empty-state-text">Hay gui tam check-in dau tien de ghi lai khoanh khac ben nhau nhe!</p>
        <button id="empty-checkin-btn" class="btn-primary" style="margin-top:12px;">Gui Check-in Ngay</button>
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
              ${escapeHtml(item.caption || 'Gui anh check-in')}
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
            ${escapeHtml(item.caption || 'Cam xuc hien tai')}
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
      tile.appendChild(buildSocialRow(item, () => picker.classList.toggle('open')));
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
            <img src="${escapeHtml(item.photoUrl)}" alt="Anh check-in" />
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

      const activeReactions = REACTIONS
        .map(({ type, emoji }) => ({ emoji, reaction: getReaction(item, type) }))
        .filter((entry) => (entry.reaction?.count ?? 0) > 0);

      detail.innerHTML = `
        ${contentHtml}
        <div class="checkin-detail-meta">
          <span>Gui boi <strong>${escapeHtml(item.ownerName)}</strong></span>
          <time>${formatFullDateTime(item.createdAt)}</time>
        </div>
        <div class="checkin-detail-social">
          <div class="reaction-summary detail-reactions">
            ${
              activeReactions.length
                ? activeReactions
                    .map(
                      ({ emoji, reaction }) =>
                        `<span class="reaction-pill${reaction?.reactedByMe ? ' selected' : ''}">${emoji}<strong>${reaction?.count ?? 0}</strong></span>`,
                    )
                    .join('')
                : '<span class="reaction-hint">Bam giu card de react</span>'
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
            <input id="reply-input" maxlength="500" placeholder="Viet reply..." />
            <button type="submit">Gui</button>
          </form>
        </div>
      `;

      const replyList = detail.querySelector<HTMLElement>('#reply-list');
      if (replyList) renderReplies(replyList, item.replies);

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
          showToast('Khong gui duoc reply', 'error');
        }
      });
    };

    renderDetailContent();

    showModal({
      title: 'Chi tiet khoanh khac',
      content: detail,
      center: true,
    });
  }

  fetchMemories(1);

  header.querySelector('#refresh-btn')?.addEventListener('click', () => {
    fetchMemories(1);
    showToast('Dang tai lai ky niem...', 'info');
  });

  loadMoreBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
      fetchMemories(currentPage + 1, true);
    }
  });

  root.appendChild(createNav('/app/memories'));

  return root;
}
