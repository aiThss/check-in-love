import { navigate } from '../router';
import { getCheckins, addReaction } from '../api/checkins';
import { createNav } from '../components/nav';
import { showToast } from '../components/toast';
import { showModal } from '../components/modal';
import { store } from '../store/index';
const MOOD_EMOJIS = {
    happy: '😊', love: '🥰', sad: '😢', excited: '🤩',
    tired: '😴', calm: '😌', miss: '🥺',
};
const REACTIONS = ['❤️', '🤗', '💋', '😂', '🥺'];
function formatTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMin / 60);
    const diffD = Math.floor(diffH / 24);
    if (diffMin < 1)
        return 'Vừa xong';
    if (diffMin < 60)
        return `${diffMin} phút trước`;
    if (diffH < 24)
        return `${diffH} giờ trước`;
    if (diffD === 1)
        return 'Hôm qua';
    return date.toLocaleDateString('vi-VN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export function renderMemoriesPage() {
    const root = document.createElement('div');
    root.className = 'page memories-page animate-fade-in';
    root.style.cssText = `
    padding: 24px 16px 100px 16px;
    max-width: 480px;
    margin: 0 auto;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    gap: 16px;
  `;
    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:between;align-items:center;margin-bottom:8px;';
    header.innerHTML = `
    <div>
      <h1 style="font-size:24px;font-weight:700;letter-spacing:-0.03em;">Kỷ niệm của hai đứa</h1>
      <p id="memories-count" style="font-size:13px;color:var(--text-secondary);">Đang tải khoảnh khắc...</p>
    </div>
    <button id="refresh-btn" class="btn-icon" style="border-radius:50%;width:40px;height:40px;">🔄</button>
  `;
    root.appendChild(header);
    // Content Area
    const content = document.createElement('div');
    content.style.cssText = 'display:flex;flex-direction:column;gap:12px;width:100%;';
    root.appendChild(content);
    // Memories Grid
    const grid = document.createElement('div');
    grid.className = 'memory-grid';
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;';
    content.appendChild(grid);
    // Pagination Info
    let currentPage = 1;
    let totalPages = 1;
    let isLoading = false;
    let allItems = [];
    const loadMoreBtn = document.createElement('button');
    loadMoreBtn.className = 'btn-ghost';
    loadMoreBtn.style.cssText = 'width:100%;padding:12px;margin-top:12px;font-weight:600;display:none;';
    loadMoreBtn.textContent = 'Xem thêm khoảnh khắc';
    content.appendChild(loadMoreBtn);
    // Load checkins
    async function fetchMemories(page = 1, append = false) {
        if (isLoading)
            return;
        isLoading = true;
        if (page === 1 && !append) {
            grid.innerHTML = `
        <div class="skeleton" style="height:140px;border-radius:20px;"></div>
        <div class="skeleton" style="height:140px;border-radius:20px;"></div>
        <div class="skeleton" style="height:140px;border-radius:20px;"></div>
        <div class="skeleton" style="height:140px;border-radius:20px;"></div>
      `;
        }
        try {
            const res = await getCheckins(page, 14);
            isLoading = false;
            const items = res.data || [];
            currentPage = res.page;
            totalPages = Math.ceil(res.total / res.limit);
            if (page === 1) {
                allItems = items;
            }
            else {
                allItems = [...allItems, ...items];
            }
            renderGrid(allItems);
            const countEl = header.querySelector('#memories-count');
            if (countEl) {
                countEl.textContent = `${res.total} khoảnh khắc đã ghi dấu 💕`;
            }
            if (currentPage < totalPages) {
                loadMoreBtn.style.display = 'block';
            }
            else {
                loadMoreBtn.style.display = 'none';
            }
        }
        catch (err) {
            isLoading = false;
            showToast('Không thể tải kỷ niệm: ' + err.message, 'error');
        }
    }
    function renderGrid(items) {
        grid.innerHTML = '';
        if (items.length === 0) {
            grid.style.display = 'none';
            const empty = document.createElement('div');
            empty.className = 'empty-state animate-fade-in';
            empty.innerHTML = `
        <div class="empty-state-emoji">🌸</div>
        <h3 class="empty-state-title">Chưa có kỷ niệm nào</h3>
        <p class="empty-state-text">Hãy gửi tấm check-in đầu tiên để ghi lại khoảnh khắc bên nhau nhé!</p>
        <button id="empty-checkin-btn" class="btn-primary" style="margin-top:12px;">Gửi Check-in Ngay 💕</button>
      `;
            content.appendChild(empty);
            empty.querySelector('#empty-checkin-btn')?.addEventListener('click', () => {
                navigate('/app/checkin');
            });
            return;
        }
        grid.style.display = 'grid';
        // Remove any empty states if existed
        const oldEmpty = content.querySelector('.empty-state');
        if (oldEmpty)
            oldEmpty.remove();
        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'memory-item';
            if (item.type === 'photo') {
                card.style.cssText = 'position:relative;border-radius:20px;overflow:hidden;aspect-ratio:1;';
                card.innerHTML = `
          <img src="${item.photoUrl}" style="width:100%;height:100%;object-fit:cover;" loading="lazy" />
          <div style="
            position:absolute;
            inset:0;
            background:linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 80%);
            display:flex;
            flex-direction:column;
            justify-content:flex-end;
            padding:12px;
            color:#fff;
          ">
            <span style="font-size:11px;opacity:0.9;">${item.ownerName}</span>
            <span style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${item.caption || 'Gửi ảnh check-in'}
            </span>
          </div>
        `;
            }
            else if (item.type === 'mood') {
                const emoji = MOOD_EMOJIS[item.mood || ''] || '😊';
                card.style.cssText = 'border-radius:20px;padding:16px;background:var(--surface-solid);border:1px solid var(--border);display:flex;flex-direction:column;gap:8px;aspect-ratio:1;justify-content:center;align-items:center;text-align:center;';
                card.innerHTML = `
          <span style="font-size:40px;">${emoji}</span>
          <span style="font-size:13px;font-weight:600;color:var(--text-primary);line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
            ${item.caption || 'Cảm xúc hiện tại'}
          </span>
          <span style="font-size:10px;color:var(--text-secondary);">${item.ownerName} • ${formatTime(item.createdAt)}</span>
        `;
            }
            else {
                // text checkin
                card.style.cssText = 'border-radius:20px;padding:16px;background:var(--surface-solid);border:1px solid var(--border);display:flex;flex-direction:column;gap:8px;aspect-ratio:1;justify-content:center;align-items:flex-start;';
                card.innerHTML = `
          <span style="font-size:13px;font-weight:500;color:var(--text-primary);line-height:1.4;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;text-align:left;">
            ${item.caption}
          </span>
          <span style="font-size:10px;color:var(--text-secondary);margin-top:auto;">${item.ownerName} • ${formatTime(item.createdAt)}</span>
        `;
            }
            card.addEventListener('click', () => {
                showCheckinDetail(item);
            });
            grid.appendChild(card);
        });
    }
    // Detail Modal view
    function showCheckinDetail(item) {
        const detail = document.createElement('div');
        detail.style.cssText = 'display:flex;flex-direction:column;gap:16px;align-items:stretch;width:100%;';
        let contentHtml = '';
        if (item.type === 'photo') {
            contentHtml = `
        <div style="border-radius:18px;overflow:hidden;aspect-ratio:4/3;background:#000;display:flex;align-items:center;justify-content:center;">
          <img src="${item.photoUrl}" style="max-width:100%;max-height:100%;object-fit:contain;" />
        </div>
        ${item.caption ? `<p style="font-size:15px;line-height:1.6;color:var(--text-primary);">${item.caption}</p>` : ''}
      `;
        }
        else if (item.type === 'mood') {
            const emoji = MOOD_EMOJIS[item.mood || ''] || '😊';
            contentHtml = `
        <div style="display:flex;flex-direction:column;align-items:center;padding:24px 16px;background:var(--surface-solid);border-radius:18px;gap:12px;">
          <span style="font-size:64px;">${emoji}</span>
          ${item.caption ? `<p style="font-size:16px;font-weight:500;text-align:center;line-height:1.5;">${item.caption}</p>` : ''}
        </div>
      `;
        }
        else {
            contentHtml = `
        <div style="padding:20px;background:var(--surface-solid);border-radius:18px;font-size:16px;line-height:1.6;font-weight:500;text-align:left;">
          ${item.caption}
        </div>
      `;
        }
        detail.innerHTML = `
      ${contentHtml}
      <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--border);padding-top:12px;margin-top:4px;">
        <span style="font-size:13px;color:var(--text-secondary);">Gửi bởi <strong>${item.ownerName}</strong></span>
        <span style="font-size:12px;color:var(--text-secondary);">${formatTime(item.createdAt)}</span>
      </div>
      <div id="reactions-container" style="display:flex;flex-direction:column;gap:8px;margin-top:4px;">
        <h4 style="font-size:13px;font-weight:700;color:var(--text-secondary);">Phản hồi</h4>
        <div id="reaction-bar-detail" style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;"></div>
      </div>
    `;
        // Render detail reaction bar
        const updateReactionBar = (updatedItem) => {
            const rxBar = detail.querySelector('#reaction-bar-detail');
            if (!rxBar)
                return;
            rxBar.innerHTML = '';
            REACTIONS.forEach(emoji => {
                const exist = updatedItem.reactions.find((r) => r.type === emoji);
                const count = exist?.count ?? 0;
                const selected = exist?.reactedByMe ?? false;
                const btn = document.createElement('button');
                btn.className = `reaction-btn ${selected ? 'selected' : ''}`;
                btn.style.cssText = `
          padding: 6px 12px;
          border-radius: var(--radius-pill);
          border: 1px solid ${selected ? 'var(--accent)' : 'var(--border)'};
          background: ${selected ? 'var(--accent-soft)' : 'var(--surface-solid)'};
          color: ${selected ? 'var(--accent)' : 'var(--text-primary)'};
          font-size: 16px;
          display:flex;
          align-items:center;
          gap:4px;
        `;
                btn.innerHTML = `<span>${emoji}</span> ${count > 0 ? `<span style="font-size:12px;font-weight:600;">${count}</span>` : ''}`;
                btn.addEventListener('click', async () => {
                    try {
                        const newReactions = await addReaction(item.id, emoji);
                        // Update reaction array in both detailed modal and the allItems list
                        const matchedItem = allItems.find(x => x.id === item.id);
                        if (matchedItem) {
                            matchedItem.reactions = newReactions;
                        }
                        item.reactions = newReactions;
                        updateReactionBar(item);
                        // Trigger visual update on main home if needed
                        store.set({ hasNewCheckin: true }); // trigger reload home state if navigated
                    }
                    catch (err) {
                        showToast('Không phản hồi được!', 'error');
                    }
                });
                rxBar.appendChild(btn);
            });
        };
        updateReactionBar(item);
        showModal({
            title: 'Chi tiết khoảnh khắc',
            content: detail,
            center: true
        });
    }
    fetchMemories(1);
    // Event Listeners
    header.querySelector('#refresh-btn')?.addEventListener('click', () => {
        fetchMemories(1);
        showToast('Đang tải lại kỷ niệm...', 'info');
    });
    loadMoreBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            fetchMemories(currentPage + 1, true);
        }
    });
    // Inject Nav
    root.appendChild(createNav('/app/memories'));
    return root;
}
