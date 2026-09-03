import { navigate } from '../router';
import { store } from '../store/index';
import { getCheckins, addReaction } from '../api/checkins';
import { createMessage } from '../api/messages';
import { showToast } from '../components/toast';
import { showModal } from '../components/modal';
import { openReactionPicker } from '../components/reaction-picker';
import { refreshIconMarkup, setRefreshButtonLoading } from '../components/refresh-icon';
import { smilePlusIconMarkup } from '../components/smile-plus-icon';
import { openPolaroidCoverModal } from '../components/polaroid-cover';
import { createReplyToggle, getReplyPagePath } from '../components/reply-toggle';
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

/**
 * Trả về URL ảnh tốt nhất từ item, thử lần lượt các trường.
 * Dùng để xử lý trường hợp API trả field khác nhau tuỳ version,
 * hoặc WebView cache dữ liệu cũ thiếu photoUrl.
 */
function getCheckinPhotoUrl(item: CheckIn): string | undefined {
  return (
    (item as any).photoUrl ||
    (item as any).cardUrl ||
    (item as any).imageUrl ||
    (item as any).originalUrl ||
    (item as any).thumbnailUrl ||
    undefined
  );
}

function isAndroidWrapper(): boolean {
  return typeof navigator !== 'undefined' && navigator.userAgent.includes('LoveCheckAndroidWrapper');
}

function installAndroidLongPressDownload(image: HTMLImageElement, item: CheckIn): void {
  if (!isAndroidWrapper()) return;

  const downloadUrl = getCheckinPhotoUrl(item);
  if (!downloadUrl) return;

  image.classList.add('android-long-press-download');
  let timer: number | null = null;
  let startX = 0;
  let startY = 0;

  const cancelTimer = (): void => {
    if (timer === null) return;
    window.clearTimeout(timer);
    timer = null;
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    cancelTimer();
    startX = event.clientX;
    startY = event.clientY;
    timer = window.setTimeout(() => {
      timer = null;
      const createdAt = new Date(item.createdAt);
      const pad = (value: number) => String(value).padStart(2, '0');
      const fileName = `checkin-love-${createdAt.getFullYear()}-${pad(createdAt.getMonth() + 1)}-${pad(createdAt.getDate())}-${pad(createdAt.getHours())}-${pad(createdAt.getMinutes())}.jpg`;

      try {
        const bridge = (window as any).LoveCheckAndroid;
        if (!bridge || typeof bridge.downloadFile !== 'function') throw new Error('DOWNLOAD_BRIDGE_UNAVAILABLE');
        bridge.downloadFile(downloadUrl, fileName);
        showToast('Đang lưu ảnh xuống...', 'loading-spark');
      } catch {
        showToast('Không thể lưu ảnh lúc này.', 'error');
      }
    }, 650);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > 14) cancelTimer();
  };

  image.addEventListener('pointerdown', onPointerDown);
  image.addEventListener('pointermove', onPointerMove);
  image.addEventListener('pointerup', cancelTimer);
  image.addEventListener('pointercancel', cancelTimer);
  image.addEventListener('pointerleave', cancelTimer);
  image.addEventListener('contextmenu', (event) => event.preventDefault());
}

function openMemoryPhotoCover(item: CheckIn, photoUrl: string, title: string, dateText: string): void {
  openPolaroidCoverModal({
    imageUrl: photoUrl,
    title,
    dateText,
    coverText: item.surpriseText,
    forceScratch: false,
    timerSeconds: 5,
  });

  const stageImage = document.querySelector<HTMLImageElement>('.polaroid-modal-backdrop .polaroid-stage-photo');
  if (stageImage) installAndroidLongPressDownload(stageImage, item);
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
  _onShowPicker: () => void,
  _onShowReactionDetails: () => void,
  _onReply: () => void,
): HTMLElement {
  const row = document.createElement('div');
  row.className = 'memory-social-row';
  const form = document.createElement('form');
  form.className = 'rm-inline-composer memory-mini-composer';
  form.setAttribute('autocomplete', 'off');
  form.innerHTML = `
    <input
      type="text"
      name="memory_chat_msg"
      aria-label="Gửi tin nhắn cho ảnh này"
      maxlength="500"
      placeholder="Gửi tin nhắn..."
      autocomplete="off"
      autocorrect="off"
      autocapitalize="sentences"
      spellcheck="false"
      data-lpignore="true"
      data-form-type="other"
      data-1p-ignore="true"
    />
    <button type="button" class="rm-quick-react rm-reaction-choice react-button" data-icon="smile+" aria-label="Chọn cảm xúc">${smilePlusIconMarkup}</button>
    <button type="submit" class="rm-send-message" aria-label="Gửi tin nhắn">↑</button>
  `;
  const input = form.querySelector<HTMLInputElement>('input');
  const submitButton = form.querySelector<HTMLButtonElement>('.rm-send-message');
  const replyToggle = createReplyToggle(
    () => item.replies,
    () => navigate(getReplyPagePath(item.id)),
    'Trả lời',
    () => input?.focus(),
  );
  let isSending = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = input?.value.trim() ?? '';
    if (!message || isSending) return;
    isSending = true;
    if (submitButton) submitButton.disabled = true;
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
      if (input) {
        input.value = '';
        input.placeholder = 'Gửi tin nhắn...';
      }
      showToast('Đã gửi vào Tin nhắn', 'success');
    } catch {
      showToast('Không gửi được tin nhắn', 'error');
    } finally {
      isSending = false;
      if (submitButton) submitButton.disabled = false;
    }
  });
  form.querySelector<HTMLButtonElement>('.rm-reaction-choice')?.addEventListener('click', (event) => {
    event.stopPropagation();
    openReactionPicker(item);
  });
  row.appendChild(form);
  row.appendChild(replyToggle.toggle);
  row.appendChild(replyToggle.panel);
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

function renderMemoriesPolaroidSkeleton(): string {
  const rotations = ['-4deg', '3deg', '2deg', '-3deg', '4deg', '-2deg', '-5deg', '1deg'];
  return rotations.map((deg, i) => `
    <div style="border-radius:20px;aspect-ratio:1;background:var(--surface);display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow);">
      <svg viewBox="0 0 64 76" width="86" height="102" style="transform:rotate(${deg});filter:drop-shadow(0 4px 14px rgba(115,44,68,0.15));overflow:visible;" aria-hidden="true">
        <defs>
          <linearGradient id="memPolGrad${i}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ffb3cc"/>
            <stop offset="55%" stop-color="#ff85a1"/>
            <stop offset="100%" stop-color="#c0456c"/>
          </linearGradient>
        </defs>
        <rect width="64" height="76" rx="4" fill="#fff4f7"/>
        <rect class="l-polaroid__photo" x="6" y="6" width="52" height="52" rx="2" fill="url(#memPolGrad${i})"/>
        <rect x="10" y="66" width="26" height="3" rx="1.5" fill="#c0456c" opacity=".4"/>
      </svg>
    </div>
  `).join('');
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
    <div style="display:flex;gap:8px;align-items:center;flex-shrink:0;">
      <button id="search-btn" class="mem-icon-btn" aria-label="Tìm kỷ niệm">
        <img src="/icons8-search-48.apng.png" alt="" width="26" height="26"
          onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
          style="display:block;" />
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"
          style="display:none;width:20px;height:20px;">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </button>
      <button id="refresh-btn" class="btn-icon" aria-label="Làm mới">${refreshIconMarkup}</button>
    </div>
  `;
  root.appendChild(header);

  // ── Search bar (hidden by default, slides open when search-btn clicked) ──
  let searchQuery = '';
  const searchBar = document.createElement('div');
  searchBar.className = 'memories-search-bar';
  searchBar.innerHTML = `
    <div class="memories-search-inner">
      <svg class="memories-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        id="search-input"
        class="memories-search-input"
        type="search"
        placeholder="Tìm kỷ niệm, ngày, caption…"
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
      />
      <button id="search-clear" class="memories-search-clear" aria-label="Xóa tìm kiếm" style="display:none;">&#x2715;</button>
    </div>
  `;
  root.insertBefore(searchBar, root.children[1]);

  const content = document.createElement('div');
  content.style.cssText = 'display:flex;flex-direction:column;gap:12px;width:100%;';
  root.appendChild(content);

  const grid = document.createElement('div');
  grid.className = 'memory-grid';
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;';
  content.appendChild(grid);

  let currentPage = 1;
  let displayedLimit = 14;
  let totalPages = cachedTotalPages;
  let isLoading = false;
  let skeletonActive = false;
  let allItems: CheckIn[] = [...cachedMemories];

  const loadMoreBtn = document.createElement('button');
  loadMoreBtn.className = 'btn-ghost';
  loadMoreBtn.style.cssText = 'width:100%;padding:12px;margin-top:12px;font-weight:600;display:none;';
  loadMoreBtn.textContent = 'Xem thêm khoảnh khắc';
  content.appendChild(loadMoreBtn);

  if (cachedMemories.length > 0) {
    // Do NOT render cache immediately — polaroid skeleton will show first.
    // Background sync will apply after skeleton clears.
    loadAllMemories();
  }

  async function reactToItem(item: CheckIn, type: ReactionType, refreshDetail?: () => void) {
    try {
      const newReactions = await addReaction(item.id, type);
      const matchedItem = allItems.find((candidate) => candidate.id === item.id);
      if (matchedItem) matchedItem.reactions = newReactions;
      item.reactions = newReactions;
      applySearch();
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

  // ── Search helpers ────────────────────────────────────────────────────────
  const DAY_NAMES = ['chủ nhật', 'thứ hai', 'thứ ba', 'thứ tư', 'thứ năm', 'thứ sáu', 'thứ bảy'];

  function matchDateFlexible(d: Date, lowerQuery: string): boolean {
    const q = lowerQuery
      .replace(/(\d+)\s*(?:st|nd|rd|th)\s*(\d*)/g, '$1-$2')
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const tokens = q.split(' ');
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();

    if (tokens.length === 2) {
      const t1 = parseInt(tokens[0], 10);
      const t2 = parseInt(tokens[1], 10);
      if (!isNaN(t1) && !isNaN(t2)) {
        if (t1 === day && t2 === month) return true;
        if (t1 === month && t2 === year) return true;
      }
    }

    if (tokens.length === 3) {
      const t1 = parseInt(tokens[0], 10);
      const t2 = parseInt(tokens[1], 10);
      const t3 = parseInt(tokens[2], 10);
      if (!isNaN(t1) && !isNaN(t2) && !isNaN(t3)) {
        if (t1 === day && t2 === month && t3 === year) return true;
      }
    }

    const dayP = String(day).padStart(2, '0');
    const monthP = String(month).padStart(2, '0');
    const yearS = String(year);

    const formats = [
      `${day}/${month}`,
      `${day}/${monthP}`,
      `${dayP}/${month}`,
      `${dayP}/${monthP}`,
      `${day}-${month}`,
      `${day}-${monthP}`,
      `${dayP}-${month}`,
      `${dayP}-${monthP}`,
      `${day}th${month}`,
      `${day}th${monthP}`,
      `${dayP}th${month}`,
      `${dayP}th${monthP}`,
      `${day}/${month}/${yearS}`,
      `${dayP}/${monthP}/${yearS}`,
      `${day}-${month}-${yearS}`,
      `${dayP}-${monthP}-${yearS}`,
      `${day}th${month}/${yearS}`,
    ];

    const cleanQuery = lowerQuery.replace(/\s+/g, '');
    return formats.some((f) => f.includes(cleanQuery));
  }

  function matchesSearch(item: CheckIn, q: string): boolean {
    if (!q) return true;
    const lower = q.toLowerCase().trim();
    const d = new Date(item.createdAt);

    if (matchDateFlexible(d, lower)) return true;

    const pad = (n: number) => String(n).padStart(2, '0');
    const dateTokens = [
      `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
      `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`,
      `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`,
      `${pad(d.getDate())}-${pad(d.getMonth() + 1)}`,
      String(d.getFullYear()),
      DAY_NAMES[d.getDay()],
    ];
    const haystack = [
      item.caption || '',
      item.ownerName || '',
      ...dateTokens,
    ].join(' ').toLowerCase();
    return haystack.includes(lower);
  }

  function applySearch() {
    if (skeletonActive) return; // Skeleton is active — defer render until it completes
    const filtered = searchQuery ? allItems.filter((item) => matchesSearch(item, searchQuery)) : allItems;
    const toRender = searchQuery ? filtered : filtered.slice(0, displayedLimit);
    renderGrid(toRender, Boolean(searchQuery));
    const countEl = header.querySelector('#memories-count');
    if (countEl) {
      countEl.textContent = searchQuery
        ? `Tìm thấy ${filtered.length} kỷ niệm`
        : `${cachedTotal} khoảnh khắc đã ghi dấu`;
    }
    const hasMoreItems = allItems.length > displayedLimit || cachedTotal > displayedLimit;
    loadMoreBtn.style.display = !searchQuery && hasMoreItems ? 'block' : 'none';
  }

  // Wire up search events once DOM is ready
  const searchInput = searchBar.querySelector<HTMLInputElement>('#search-input')!;
  const searchClear = searchBar.querySelector<HTMLButtonElement>('#search-clear')!;

  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    searchClear.style.display = searchQuery ? 'flex' : 'none';
    applySearch();
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    searchClear.style.display = 'none';
    searchInput.focus();
    applySearch();
  });

  header.querySelector('#search-btn')?.addEventListener('click', () => {
    searchBar.classList.toggle('open');
    if (searchBar.classList.contains('open')) {
      setTimeout(() => searchInput.focus(), 180);
    } else {
      // closing — reset search
      searchInput.value = '';
      searchQuery = '';
      searchClear.style.display = 'none';
      applySearch();
    }
  });
  // ─────────────────────────────────────────────────────────────────────────

  async function loadAllMemories() {
    try {
      let page = 1;
      let hasMore = true;
      let tempAll: CheckIn[] = [...allItems];

      while (hasMore) {
        const res = await getCheckins(page, 50, undefined, 'photo');
        const newItems = (res.data || []).filter(
          (item) => !tempAll.some((existing) => existing.id === item.id)
        );
        tempAll = [...tempAll, ...newItems];

        // Sort newest first
        tempAll.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        allItems = tempAll;
        cachedMemories = tempAll;
        cachedTotal = Math.max(res.total, tempAll.length);
        cachedTotalPages = Math.ceil(cachedTotal / 14);

        applySearch();

        hasMore = res.page < Math.ceil(res.total / res.limit);
        page++;
      }
    } catch (err) {
      console.error('Failed to load all memories in background:', err);
    }
  }

  async function fetchMemories(page = 1, append = false) {
    if (isLoading) return;
    isLoading = true;

    const refreshBtn = header.querySelector<HTMLButtonElement>('#refresh-btn');
    if (refreshBtn) setRefreshButtonLoading(refreshBtn, true);

    // Polaroid skeleton — every initial visit, fixed 2s.
    let minWaitPromise: Promise<void> = Promise.resolve();
    if (page === 1 && !append) {
      skeletonActive = true;
      grid.style.display = 'grid';
      grid.innerHTML = renderMemoriesPolaroidSkeleton();
      minWaitPromise = new Promise<void>((resolve) => setTimeout(resolve, 2000));
    }

    try {
      const [res] = await Promise.all([
        getCheckins(page, 14, undefined, 'photo'),
        minWaitPromise,
      ]);
      skeletonActive = false;
      isLoading = false;
      const refreshBtn = header.querySelector<HTMLButtonElement>('#refresh-btn');
      if (refreshBtn) setRefreshButtonLoading(refreshBtn, false);

      const items = res.data || [];
      currentPage = res.page;
      totalPages = Math.ceil(res.total / res.limit);

      allItems = page === 1 ? items : [...allItems, ...items];
      if (page === 1) {
        cachedMemories = items;
        cachedTotal = res.total;
        cachedTotalPages = totalPages;
        // Trigger background load
        loadAllMemories();
      }
      applySearch();

      const countEl = header.querySelector('#memories-count');
      if (countEl && !searchQuery) {
        countEl.textContent = `${res.total} khoảnh khắc đã ghi dấu`;
      }

      loadMoreBtn.style.display = !searchQuery && currentPage < totalPages ? 'block' : 'none';
    } catch (err) {
      const error = err as Error;
      isLoading = false;
      const refreshBtn = header.querySelector<HTMLButtonElement>('#refresh-btn');
      if (refreshBtn) setRefreshButtonLoading(refreshBtn, false);
      showToast('Không thể tải kỷ niệm: ' + error.message, 'error');
    }
  }

  function renderGrid(items: CheckIn[], isFiltered = false) {
    grid.innerHTML = '';

    const oldEmpty = content.querySelector('.empty-state');
    if (oldEmpty) oldEmpty.remove();

    if (items.length === 0) {
      grid.style.display = 'none';
      const empty = document.createElement('div');
      empty.className = 'empty-state animate-fade-in';
      if (isFiltered) {
        empty.innerHTML = `
          <div class="empty-state-emoji">\u{1F50D}</div>
          <h3 class="empty-state-title">Không tìm thấy kỷ niệm nào</h3>
          <p class="empty-state-text">Thử tìm bằng ngày hoặc vài chữ trong caption nhé</p>
        `;
      } else {
        empty.innerHTML = `
          <div class="empty-state-emoji">\u{1F338}</div>
          <h3 class="empty-state-title">Chưa có kỷ niệm nào</h3>
          <p class="empty-state-text">Hãy gửi tấm check-in đầu tiên để ghi lại khoảnh khắc bên nhau nhé!</p>
          <button id="empty-checkin-btn" class="btn-primary" style="margin-top:12px;">Gửi check-in ngay</button>
        `;
        empty.querySelector('#empty-checkin-btn')?.addEventListener('click', () => {
          navigate('/app/checkin');
        });
      }
      content.appendChild(empty);
      return;
    }

    grid.style.display = 'grid';

    items.forEach((item) => {
      const tile = document.createElement('div');
      tile.className = 'memory-tile';

      const card = document.createElement('div');
      card.className = 'memory-item';

      if (item.type === 'photo' || (item as any).photoUrl) {
        card.style.cssText = 'position:relative;border-radius:20px;overflow:hidden;aspect-ratio:1;cursor:pointer;';
        card.innerHTML = `
          <img src="${escapeHtml((item as any).photoUrl)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy" />
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
        const photoUrl = getCheckinPhotoUrl(item);
        if (photoUrl) {
          openMemoryPhotoCover(item, photoUrl, item.caption || `Kỷ niệm của ${item.ownerName} 💖`, formatTime(item.createdAt));
        } else {
          showCheckinDetail(item);
        }
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
    // ── DEBUG: log để trace lỗi trong WebView Android ──────────────────
    // ───────────────────────────────────────────────────────────────────

    const detail = document.createElement('div');
    detail.className = 'checkin-detail';

    const renderDetailContent = () => {
      // Lấy URL ảnh tốt nhất, kể cả khi type lệch hoặc field thiếu
      const photoUrl = getCheckinPhotoUrl(item);
      const hasPhoto = Boolean(photoUrl);

      let contentHtml: string;

      if (hasPhoto) {
        // Hiển thị ảnh nếu có URL — không phụ thuộc cứng vào item.type
        contentHtml = `
          <div class="checkin-detail-media">
            <img
              class="checkin-detail-image"
              src="${escapeHtml(photoUrl)}"
              alt="Ảnh check-in"
              loading="eager"
            />
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

      const replies = item.replies ?? [];
      const activeReactions = (item.reactions ?? []).filter((reaction) => reaction.count > 0);

      detail.innerHTML = `
        ${contentHtml}
        <div class="checkin-detail-meta">
          <span>Gửi bởi <strong>${escapeHtml(item.ownerName)}</strong></span>
          <time>${formatFullDateTime(item.createdAt)}</time>
        </div>
        ${
          activeReactions.length
            ? `
            <div class="checkin-detail-social">
              <div class="reaction-summary detail-reactions">
                ${activeReactions
                  .map(
                    (reaction) =>
                      `<span class="reaction-pill${reaction.reactedByMe ? ' selected' : ''}">${escapeHtml(reaction.type)}<strong>${reaction.count}</strong></span>`,
                  )
                  .join('')}
              </div>
            </div>
            `
            : ''
        }
        <button type="button" class="reply-toggle-button detail-reply-toggle" aria-expanded="false">
          💬 Xem phản hồi <span>${replies.length}</span>
        </button>
        <div class="reply-section" hidden>
          <div class="reply-section-title">
            <h4>Replies</h4>
            <span>${replies.length}</span>
          </div>
          <div id="reply-list" class="reply-detail-list"></div>
          <form id="reply-form" class="inline-reply-form" autocomplete="off">
            <input
              id="reply-input"
              type="text"
              name="memory_reply_msg"
              maxlength="500"
              placeholder="Viết reply..."
              autocomplete="off"
              autocorrect="off"
              autocapitalize="sentences"
              spellcheck="false"
              data-lpignore="true"
              data-form-type="other"
              data-1p-ignore="true"
            />
            <button type="button" class="memory-quick-reply memory-reaction-choice react-button" data-icon="smile+" aria-label="Chọn cảm xúc">${smilePlusIconMarkup}</button>
            <button type="submit">Gửi</button>
          </form>
        </div>
      `;

      const detailImage = detail.querySelector<HTMLImageElement>('.checkin-detail-image');
      if (detailImage && hasPhoto) installAndroidLongPressDownload(detailImage, item);

      const replyToggle = detail.querySelector<HTMLButtonElement>('.detail-reply-toggle');
      const replySection = detail.querySelector<HTMLElement>('.reply-section');
      if (replyToggle && replySection) {
        replySection.hidden = true;
        replyToggle.setAttribute('aria-expanded', 'false');
        replyToggle.addEventListener('click', () => navigate(getReplyPagePath(item.id)));
      }

      const replyList = detail.querySelector<HTMLElement>('#reply-list');
      if (replyList) renderReplies(replyList, replies);

      const replyForm = detail.querySelector<HTMLFormElement>('#reply-form');
      const replySubmit = replyForm?.querySelector<HTMLButtonElement>('button[type="submit"]');
      const detailReactionPicker = buildReactionPicker(item, (type) => {
        void reactToItem(item, type, renderDetailContent);
      });
      detailReactionPicker.classList.add('detail-reaction-picker');
      replyForm?.before(detailReactionPicker);
      let isReplySending = false;
      replyForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const input = detail.querySelector<HTMLInputElement>('#reply-input');
        const message = input?.value.trim() ?? '';
        if (!message || isReplySending) return;
        isReplySending = true;
        if (replySubmit) replySubmit.disabled = true;

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
          renderDetailContent();
          if (input) input.value = '';
        } catch {
          showToast('Không gửi được reply', 'error');
        } finally {
          isReplySending = false;
          if (replySubmit) replySubmit.disabled = false;
        }
      });

      detail.querySelector<HTMLButtonElement>('.memory-reaction-choice')?.addEventListener('click', () => {
        detailReactionPicker.classList.toggle('open');
      });
    };

    renderDetailContent();
    showModal({
      title: 'Chi tiết khoảnh khắc',
      content: detail,
      // Apply classes đồng bộ ngay lúc tạo element — không dùng requestAnimationFrame
      // để đảm bảo layout đúng ngay từ frame đầu tiên trên cả Web và Android WebView
      overlayClass: 'modal-checkin-detail-overlay',
      modalClass: 'modal-checkin-detail',
    });
  }

  fetchMemories(1);

  header.querySelector('#refresh-btn')?.addEventListener('click', () => {
    displayedLimit = 14;
    currentPage = 1;
    fetchMemories(1);
    showToast('Đang tải lại kỷ niệm...', 'loading-spark');
  });

  loadMoreBtn.addEventListener('click', () => {
    displayedLimit += 14;
    applySearch();
    // Fallback: if we need to fetch more because allItems doesn't have it yet
    if (allItems.length < displayedLimit && currentPage < totalPages) {
      fetchMemories(currentPage + 1, true);
    }
  });

  return root;
}
