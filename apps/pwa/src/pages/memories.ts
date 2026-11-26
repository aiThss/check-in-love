import '../styles/20-pages/memories.css';
import { navigate } from '../router';
import { store } from '../store/index';
import { getCheckins, addReaction } from '../api/checkins';
import { createMessage } from '../api/messages';
import { showToast } from '../components/toast';
import { showModal } from '../components/modal';
import { openReactionPicker } from '../components/reaction-picker';
import { BESPOKE_REACTIONS, MOOD_ICON_LOOKUP, createReactionTray, renderReactionSymbolHtml } from '../ui/reactions';
import { refreshIconMarkup, setRefreshButtonLoading } from '../components/refresh-icon';
import { smilePlusIconMarkup } from '../components/smile-plus-icon';
import { openPolaroidCoverModal } from '../components/polaroid-cover';
import { getReplyPagePath } from '../components/reply-toggle';
import { iconMarkup } from '../ui/icons/icons';
import { createButton } from '../ui/primitives';
import { createSegmentedControl } from '../ui/forms';
import { createEmptyState, createSkeleton } from '../ui/feedback';
import { triggerHaptic } from '../ui/haptics';
import type { CheckIn, CheckInReply, Reaction, ReactionType } from '../api/types';

let cachedMemories: CheckIn[] = [];
let cachedTotal = 0;
let cachedTotalPages = 1;

const PAGE_BATCH = 20;

type OwnerFilter = 'all' | 'mine' | 'partner';

function escapeHtml(value: string | undefined): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getCheckinPhotoUrl(item: CheckIn): string | undefined {
  const legacy = item as CheckIn & {
    cardUrl?: string;
    imageUrl?: string;
    originalUrl?: string;
    thumbnailUrl?: string;
  };
  return (
    legacy.photoUrl
    || legacy.cardUrl
    || legacy.imageUrl
    || legacy.originalUrl
    || legacy.thumbnailUrl
    || undefined
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
        const bridge = (window as unknown as {
          LoveCheckAndroid?: { downloadFile?: (url: string, name: string) => void };
        }).LoveCheckAndroid;
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

function openMemoryPhotoCover(
  item: CheckIn,
  photoUrl: string,
  title: string,
  dateText: string,
  hasCustomCaption: boolean,
): void {
  openPolaroidCoverModal({
    imageUrl: photoUrl,
    title,
    dateText,
    hasCustomCaption,
    coverText: item.surpriseText,
    forceScratch: false,
    timerSeconds: 5,
  });

  const stageImage = document.querySelector<HTMLImageElement>('.polaroid-modal-backdrop .polaroid-stage-photo');
  if (stageImage) installAndroidLongPressDownload(stageImage, item);
}

function formatMemoryCardStamp(isoString: string): string {
  const date = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())} ${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
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
    return `${day} thg ${month} · ${hours}:${minutes}`;
  }
  return `${day}/${month}/${year}`;
}

function formatMonthStamp(isoString: string): string {
  const d = new Date(isoString);
  return `Tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
}

function formatFullDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getReaction(checkin: CheckIn, type: ReactionType): Reaction | undefined {
  return checkin.reactions.find((reaction) => reaction.type === type);
}

function attachLongPress(target: HTMLElement, onLongPress: () => void): () => boolean {
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
    if (timer !== undefined && Math.hypot(event.clientX - startX, event.clientY - startY) > 10) {
      clear();
    }
  }, { passive: true });
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

function buildDetailReactionPicker(
  item: CheckIn,
  onReact: (type: ReactionType) => void,
): HTMLElement {
  const picker = document.createElement('div');
  picker.className = 'reaction-picker memory-reaction-picker p-reaction-drawer';

  BESPOKE_REACTIONS.forEach(({ type, label }) => {
    const existing = getReaction(item, type);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `reaction-option${existing?.reactedByMe ? ' selected' : ''}`;
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
    <input aria-label="Cảm xúc tùy chọn" maxlength="24" placeholder="Thả emoji / icon..." />
    <button type="submit">Thả</button>
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

function renderReplies(container: HTMLElement, replies: CheckInReply[]): void {
  container.replaceChildren();
  if (replies.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'reply-empty';
    empty.textContent = 'Chưa có phản hồi nào.';
    container.appendChild(empty);
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

function renderSkeletonGrid(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'p-memories-skel-grid';
  for (let i = 0; i < 6; i++) {
    const card = document.createElement('div');
    card.className = 'p-memory-tile';
    card.appendChild(createSkeleton({ height: '164px' }));
    card.appendChild(createSkeleton({ width: '75%', height: '12px' }));
    wrap.appendChild(card);
  }
  return wrap;
}

interface CachedMemoryTile {
  tile: HTMLElement;
  item: CheckIn;
  sync: () => void;
}

export function renderMemoriesPage(): HTMLElement {
  const root = document.createElement('div') as HTMLElement & { destroy?: () => void };
  root.className = 'page memories-page p-memories animate-fade-in';

  const header = document.createElement('header');
  header.className = 'p-memories-header';
  header.innerHTML = `
    <div>
      <h1 class="p-memories-header__title">Kỷ niệm hai đứa</h1>
      <p id="memories-count" class="p-memories-header__count">Đang đồng bộ khoảnh khắc...</p>
    </div>
    <div class="p-memories-header__actions">
      <button type="button" id="search-btn" class="c-icon-btn" aria-label="Tìm kỷ niệm">
        ${iconMarkup('search', { size: 20 })}
      </button>
      <button type="button" id="refresh-btn" class="c-icon-btn" aria-label="Làm mới">${refreshIconMarkup}</button>
    </div>
  `;
  root.appendChild(header);

  let searchQuery = '';
  let ownerFilter: OwnerFilter = 'all';

  const searchBar = document.createElement('div');
  searchBar.className = 'memories-search-bar p-memories-search';
  searchBar.innerHTML = `
    <div class="p-memories-search__box">
      ${iconMarkup('search', { size: 16 })}
      <input
        id="search-input"
        class="memories-search-input"
        type="search"
        placeholder="Tìm ngày (vd: 14/02), lời nhắn…"
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
      />
      <button type="button" id="search-clear" class="p-memories-search__clear" aria-label="Xóa tìm kiếm" hidden>
        ${iconMarkup('close', { size: 16 })}
      </button>
    </div>
  `;
  root.appendChild(searchBar);

  // Sticky Filter + Month Stamp Toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'p-memories-toolbar';

  let currentPage = 1;
  let displayedLimit = PAGE_BATCH;
  let totalPages = cachedTotalPages;
  let isLoading = false;
  let backgroundSyncEpoch = 0;
  let allItems: CheckIn[] = [...cachedMemories];
  let currentFiltered: CheckIn[] = [];
  const tileCache = new Map<string, CachedMemoryTile>();

  const filterControl = createSegmentedControl<OwnerFilter>({
    ariaLabel: 'Lọc kỷ niệm theo người gửi',
    value: 'all',
    items: [
      { value: 'all', label: 'Tất cả' },
      { value: 'partner', label: 'Người ấy' },
      { value: 'mine', label: 'Của mình' },
    ],
    onChange: (val) => {
      if (ownerFilter === val) return;
      ownerFilter = val;
      displayedLimit = PAGE_BATCH;
      triggerHaptic('select');
      applySearch();
    },
  });

  const monthPill = document.createElement('span');
  monthPill.className = 'p-memories-month-pill';
  monthPill.textContent = formatMonthStamp(new Date().toISOString());

  toolbar.append(filterControl.element, monthPill);
  root.appendChild(toolbar);

  const content = document.createElement('div');
  content.style.cssText = 'display:flex;flex-direction:column;gap:12px;width:100%;';
  root.appendChild(content);

  const skelHolder = document.createElement('div');
  content.appendChild(skelHolder);

  const grid = document.createElement('div');
  grid.className = 'memory-grid p-memories-grid';
  content.appendChild(grid);

  const loadMoreBtn = createButton({
    label: 'Xem thêm khoảnh khắc',
    variant: 'secondary',
    pill: true,
    block: true,
    onClick: () => {
      appendMoreItems();
    },
  }).element;
  loadMoreBtn.style.display = 'none';
  content.appendChild(loadMoreBtn);

  const sentinel = document.createElement('div');
  sentinel.style.cssText = 'height:1px;width:100%;pointer-events:none;';
  content.appendChild(sentinel);

  function appendMoreItems(): void {
    const prevCount = grid.childElementCount;
    displayedLimit += PAGE_BATCH;
    if (currentFiltered.length > prevCount) {
      const nextSlice = currentFiltered.slice(prevCount, displayedLimit);
      const frag = document.createDocumentFragment();
      nextSlice.forEach((item) => {
        frag.appendChild(getOrCreateTile(item).tile);
      });
      grid.appendChild(frag);
      syncHeaderAndLoadMore();
    } else {
      applySearch();
    }
    if (allItems.length < displayedLimit && currentPage < totalPages) {
      void fetchMemories(currentPage + 1, true);
    }
  }

  let scrollObserver: IntersectionObserver | null = null;
  if (typeof IntersectionObserver === 'function') {
    scrollObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && currentFiltered.length > grid.childElementCount) {
          appendMoreItems();
        }
      },
      { rootMargin: '420px 0px' },
    );
    scrollObserver.observe(sentinel);
  }

  root.destroy = () => {
    backgroundSyncEpoch++;
    scrollObserver?.disconnect();
  };

  async function reactToItem(item: CheckIn, type: ReactionType, refreshDetail?: () => void) {
    try {
      const newReactions = await addReaction(item.id, type);
      const matchedItem = allItems.find((candidate) => candidate.id === item.id);
      if (matchedItem) matchedItem.reactions = newReactions;
      item.reactions = newReactions;
      tileCache.get(item.id)?.sync();
      refreshDetail?.();
    } catch {
      showToast('Không thả cảm xúc được, thử lại nhé', 'error');
    }
  }

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
      if (!Number.isNaN(t1) && !Number.isNaN(t2)) {
        if (t1 === day && t2 === month) return true;
        if (t1 === month && t2 === year) return true;
      }
    }

    if (tokens.length === 3) {
      const t1 = parseInt(tokens[0], 10);
      const t2 = parseInt(tokens[1], 10);
      const t3 = parseInt(tokens[2], 10);
      if (!Number.isNaN(t1) && !Number.isNaN(t2) && !Number.isNaN(t3)) {
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
      `${dayP}-${monthP}`,
      `${day}/${month}/${yearS}`,
      `${dayP}/${monthP}/${yearS}`,
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
      String(d.getFullYear()),
      DAY_NAMES[d.getDay()],
    ];
    const haystack = [item.caption || '', item.ownerName || '', ...dateTokens].join(' ').toLowerCase();
    return haystack.includes(lower);
  }

  function matchesOwner(item: CheckIn, myId: string | undefined): boolean {
    if (ownerFilter === 'all') return true;
    const isMine = Boolean(item.isOwn || (myId && item.userId === myId));
    return ownerFilter === 'mine' ? isMine : !isMine;
  }

  function computeFiltered(): CheckIn[] {
    const myId = store.get().user?.id;
    const byOwner = ownerFilter === 'all' ? allItems : allItems.filter((item) => matchesOwner(item, myId));
    return searchQuery ? byOwner.filter((item) => matchesSearch(item, searchQuery)) : byOwner;
  }

  function syncHeaderAndLoadMore(): void {
    const countEl = header.querySelector('#memories-count');
    if (countEl) {
      countEl.textContent = searchQuery || ownerFilter !== 'all'
        ? `Tìm thấy ${currentFiltered.length} kỷ niệm`
        : `${Math.max(cachedTotal, allItems.length)} khoảnh khắc đã ghi dấu`;
    }
    const hasMoreFiltered = currentFiltered.length > grid.childElementCount;
    const hasMoreUnfetched = ownerFilter === 'all' && !searchQuery && cachedTotal > allItems.length;
    loadMoreBtn.style.display = hasMoreFiltered || hasMoreUnfetched ? 'flex' : 'none';
  }

  function applySearch(): void {
    skelHolder.replaceChildren();
    currentFiltered = computeFiltered();
    const toRender = currentFiltered.slice(0, displayedLimit);

    if (toRender[0]?.createdAt) {
      monthPill.textContent = formatMonthStamp(toRender[0].createdAt);
    }

    renderGrid(toRender, Boolean(searchQuery || ownerFilter !== 'all'));
    syncHeaderAndLoadMore();
  }

  const searchInput = searchBar.querySelector<HTMLInputElement>('#search-input')!;
  const searchClear = searchBar.querySelector<HTMLButtonElement>('#search-clear')!;

  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    displayedLimit = PAGE_BATCH;
    searchClear.hidden = !searchQuery;
    applySearch();
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    displayedLimit = PAGE_BATCH;
    searchClear.hidden = true;
    searchInput.focus();
    applySearch();
  });

  header.querySelector('#search-btn')?.addEventListener('click', () => {
    searchBar.classList.toggle('open');
    if (searchBar.classList.contains('open')) {
      setTimeout(() => searchInput.focus(), 120);
    } else {
      searchInput.value = '';
      searchQuery = '';
      displayedLimit = PAGE_BATCH;
      searchClear.hidden = true;
      applySearch();
    }
  });

  async function loadAllMemories(syncEpoch: number): Promise<void> {
    try {
      let page = 1;
      let hasMore = true;
      const seenIds = new Set(allItems.map((item) => item.id));
      const tempAll: CheckIn[] = [...allItems];

      while (hasMore && syncEpoch === backgroundSyncEpoch) {
        const res = await getCheckins(page, 50, undefined, 'photo');
        if (syncEpoch !== backgroundSyncEpoch) return;

        let added = 0;
        for (const item of res.data || []) {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            tempAll.push(item);
            added++;
          }
        }

        if (added > 0) {
          tempAll.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }

        allItems = tempAll;
        cachedMemories = tempAll;
        cachedTotal = Math.max(res.total, tempAll.length);
        cachedTotalPages = Math.ceil(cachedTotal / PAGE_BATCH);

        // Avoid tearing down/rebuilding the visible grid on background pages if already filled
        const prevDisplayedCount = grid.childElementCount;
        currentFiltered = computeFiltered();
        if (prevDisplayedCount < displayedLimit && currentFiltered.length > prevDisplayedCount) {
          applySearch();
        } else {
          syncHeaderAndLoadMore();
        }

        hasMore = res.page < Math.ceil(res.total / res.limit);
        page++;
      }
    } catch {
      // Background pagination is best-effort
    }
  }

  async function fetchMemories(page = 1, append = false): Promise<void> {
    if (isLoading) return;
    isLoading = true;

    const refreshBtn = header.querySelector<HTMLButtonElement>('#refresh-btn');
    if (refreshBtn) setRefreshButtonLoading(refreshBtn, true);

    if (page === 1 && !append && allItems.length === 0) {
      grid.style.display = 'none';
      skelHolder.replaceChildren(renderSkeletonGrid());
    }

    try {
      const res = await getCheckins(page, PAGE_BATCH, undefined, 'photo');
      isLoading = false;
      if (refreshBtn) setRefreshButtonLoading(refreshBtn, false);

      const items = res.data || [];
      currentPage = res.page;
      totalPages = Math.ceil(res.total / res.limit);

      if (page === 1) {
        tileCache.clear();
        allItems = items;
        cachedMemories = items;
        cachedTotal = res.total;
        cachedTotalPages = totalPages;
        applySearch();
        const epoch = ++backgroundSyncEpoch;
        void loadAllMemories(epoch);
      } else {
        const seen = new Set(allItems.map((i) => i.id));
        for (const it of items) {
          if (!seen.has(it.id)) allItems.push(it);
        }
        applySearch();
      }
    } catch (err) {
      isLoading = false;
      skelHolder.replaceChildren();
      if (refreshBtn) setRefreshButtonLoading(refreshBtn, false);
      if (allItems.length === 0) {
        grid.style.display = 'none';
        content.appendChild(
          createEmptyState({
            illustration: 'offline',
            title: 'Chưa tải được kỷ niệm',
            description: (err as Error).message || 'Kiểm tra kết nối mạng và thử lại nhé.',
            action: {
              label: 'Thử lại',
              variant: 'secondary',
              pill: true,
              leadingIcon: 'refresh',
              onClick: () => void fetchMemories(1),
            },
          }),
        );
      } else {
        showToast('Không thể đồng bộ kỷ niệm mới', 'error');
      }
    }
  }

  function getOrCreateTile(item: CheckIn): CachedMemoryTile {
    const existing = tileCache.get(item.id);
    if (existing) {
      existing.item.reactions = item.reactions;
      existing.item.replies = item.replies;
      existing.sync();
      return existing;
    }

    const tile = document.createElement('article');
    tile.className = 'memory-tile p-memory-tile';

    const card = document.createElement('div');
    card.className = 'memory-item p-memory-item';

    const photoUrl = getCheckinPhotoUrl(item);
    const trimmedCaption = (item.caption ?? '').trim();
    const stampText = formatMemoryCardStamp(item.createdAt);

    if (item.type === 'photo' || photoUrl) {
      card.innerHTML = `
        <img
          src="${escapeHtml(photoUrl)}"
          alt="Ảnh kỷ niệm của ${escapeHtml(item.ownerName)}"
          data-surprise-text="${escapeHtml(item.surpriseText || '')}"
          data-scratch-enabled="${item.includeScratch !== false ? 'true' : 'false'}"
          loading="lazy"
          decoding="async"
        />
        <div class="memory-item-info p-memory-item__scrim">
          <span class="p-memory-item__owner">${escapeHtml(item.ownerName)}</span>
          <span class="p-memory-item__time">${stampText}</span>
          ${trimmedCaption ? `<span class="memory-item-info-text p-memory-item__caption">${escapeHtml(trimmedCaption)}</span>` : ''}
        </div>
      `;
      const img = card.querySelector<HTMLImageElement>('img');
      if (img) installAndroidLongPressDownload(img, item);
    } else {
      card.classList.add('p-memory-note-card');
      const moodMeta = item.mood ? MOOD_ICON_LOOKUP[item.mood] : undefined;
      card.innerHTML = `
        <div>
          ${moodMeta ? iconMarkup(moodMeta.icon, { size: 24, variant: 'filled' }) : iconMarkup('heart', { size: 20 })}
          ${trimmedCaption ? `<p class="p-memory-note-card__body">${escapeHtml(trimmedCaption)}</p>` : ''}
        </div>
        <div class="p-memory-note-card__meta">
          <span class="p-memory-item__owner">${escapeHtml(item.ownerName)}</span>
          <span class="p-memory-item__time">${stampText}</span>
        </div>
      `;
    }

    const reactionTray = createReactionTray(
      () => item.reactions,
      (type) => void reactToItem(item, type),
    );

    const openEmojiModal = () => {
      openReactionPicker(item, () => reactionTray.sync());
    };

    const consumeLongPress = attachLongPress(card, openEmojiModal);

    card.addEventListener('click', () => {
      if (consumeLongPress()) return;
      if (photoUrl) {
        openMemoryPhotoCover(
          item,
          photoUrl,
          trimmedCaption || item.ownerName,
          trimmedCaption ? `${item.ownerName} · ${stampText}` : stampText,
          Boolean(trimmedCaption),
        );
      } else {
        showCheckinDetail(item);
      }
    });

    const socialRow = document.createElement('div');
    socialRow.className = 'memory-social-row p-memory-social';

    const form = document.createElement('form');
    form.className = 'rm-inline-composer memory-mini-composer';
    form.setAttribute('autocomplete', 'off');
    form.innerHTML = `
      <input
        type="text"
        name="memory_chat_msg"
        aria-label="Gửi tin nhắn cho ảnh này"
        maxlength="500"
        placeholder="Nhắn tin..."
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

    const input = form.querySelector<HTMLInputElement>('input');
    const submitButton = form.querySelector<HTMLButtonElement>('.rm-send-message');

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
        if (input) input.value = '';
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
      openEmojiModal();
    });

    socialRow.append(form, reactionTray.element);
    tile.append(card, socialRow);

    const entry: CachedMemoryTile = {
      tile,
      item,
      sync: () => reactionTray.sync(),
    };
    tileCache.set(item.id, entry);
    return entry;
  }

  function renderGrid(items: CheckIn[], isFiltered = false): void {
    content.querySelector('.c-empty-state')?.remove();

    if (items.length === 0) {
      grid.replaceChildren();
      grid.style.display = 'none';
      const empty = createEmptyState(
        isFiltered
          ? {
              illustration: 'memories',
              title: 'Không tìm thấy kỷ niệm nào',
              description: 'Thử đổi bộ lọc hoặc tìm bằng ngày tháng khác nhé.',
            }
          : {
              illustration: 'memories',
              title: 'Album còn đang chờ tấm ảnh đầu tiên',
              description: 'Gửi tấm check-in mở màn để lưu giữ hành trình bên nhau nhé!',
              action: {
                label: 'Gửi check-in ngay',
                variant: 'primary',
                pill: true,
                leadingIcon: 'checkin-lens',
                onClick: () => navigate('/app/checkin'),
              },
            },
      );
      empty.querySelector('button')?.setAttribute('id', 'empty-checkin-btn');
      content.insertBefore(empty, loadMoreBtn);
      return;
    }

    grid.style.display = 'grid';
    const frag = document.createDocumentFragment();
    for (const item of items) {
      frag.appendChild(getOrCreateTile(item).tile);
    }
    grid.replaceChildren(frag);
  }

  function showCheckinDetail(item: CheckIn): void {
    const detail = document.createElement('div');
    detail.className = 'checkin-detail';

    const renderDetailContent = () => {
      const photoUrl = getCheckinPhotoUrl(item);
      const hasPhoto = Boolean(photoUrl);
      const moodMeta = item.mood ? MOOD_ICON_LOOKUP[item.mood] : undefined;

      let contentHtml: string;
      if (hasPhoto) {
        contentHtml = `
          <div class="checkin-detail-media">
            <img class="checkin-detail-image" src="${escapeHtml(photoUrl)}" alt="Ảnh check-in" loading="eager" />
          </div>
          ${item.caption ? `<p class="checkin-detail-caption">${escapeHtml(item.caption)}</p>` : ''}
        `;
      } else if (item.type === 'mood' && moodMeta) {
        contentHtml = `
          <div class="checkin-detail-mood">
            ${iconMarkup(moodMeta.icon, { size: 32, variant: 'filled' })}
            ${item.caption ? `<p>${escapeHtml(item.caption)}</p>` : ''}
          </div>
        `;
      } else {
        contentHtml = `<div class="checkin-detail-text">${escapeHtml(item.caption)}</div>`;
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
                      `<span class="reaction-pill${reaction.reactedByMe ? ' selected' : ''}">${renderReactionSymbolHtml(reaction.type, Boolean(reaction.reactedByMe))}${reaction.count > 1 ? `<strong>${reaction.count}</strong>` : ''}</span>`,
                  )
                  .join('')}
              </div>
            </div>
            `
            : ''
        }
        <button type="button" class="reply-toggle-button detail-reply-toggle c-reply-toggle" aria-expanded="false">
          ${iconMarkup('chat', { size: 16 })}<span>Xem phản hồi (${replies.length})</span>
        </button>
        <div class="reply-section" hidden>
          <div id="reply-list" class="reply-detail-list"></div>
          <form id="reply-form" class="inline-reply-form" autocomplete="off">
            <input id="reply-input" type="text" name="memory_reply_msg" maxlength="500" placeholder="Viết phản hồi..." autocomplete="off" />
            <button type="button" class="memory-quick-reply memory-reaction-choice react-button" data-icon="smile+" aria-label="Chọn cảm xúc">${smilePlusIconMarkup}</button>
            <button type="submit">Gửi</button>
          </form>
        </div>
      `;

      const detailImage = detail.querySelector<HTMLImageElement>('.checkin-detail-image');
      if (detailImage && hasPhoto) installAndroidLongPressDownload(detailImage, item);

      detail.querySelector<HTMLButtonElement>('.detail-reply-toggle')?.addEventListener('click', () => {
        navigate(getReplyPagePath(item.id));
      });

      const replyList = detail.querySelector<HTMLElement>('#reply-list');
      if (replyList) renderReplies(replyList, replies);

      const replyForm = detail.querySelector<HTMLFormElement>('#reply-form');
      const detailReactionPicker = buildDetailReactionPicker(item, (type) => {
        void reactToItem(item, type, renderDetailContent);
      });
      replyForm?.before(detailReactionPicker);
    };

    renderDetailContent();
    showModal({
      title: 'Chi tiết khoảnh khắc',
      content: detail,
      overlayClass: 'modal-checkin-detail-overlay',
      modalClass: 'modal-checkin-detail',
    });
  }

  if (allItems.length > 0) {
    applySearch();
  }
  void fetchMemories(1);

  header.querySelector('#refresh-btn')?.addEventListener('click', () => {
    displayedLimit = PAGE_BATCH;
    currentPage = 1;
    triggerHaptic('tap');
    void fetchMemories(1);
    showToast('Đang làm mới kỷ niệm...', 'loading-spark');
  });

  return root;
}
