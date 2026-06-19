import { navigate } from '../router';
import { getCategories, drawRandom, getHistory } from '../api/random';
import { createNav } from '../components/nav';
import { showToast } from '../components/toast';
import type { RandomCategory, RandomHistoryItem, RandomItem } from '../api/types';

const CATEGORY_ICONS: Record<string, string> = {
  questions: '❓',
  snap: '📸',
  today: '📅',
  food: '🍲',
  universe: '🌌',
};

const CATEGORY_LABELS: Record<string, string> = {
  questions: 'Câu hỏi',
  snap: 'Chụp hình',
  today: 'Hôm nay',
  food: 'Món ăn',
  universe: 'Vũ trụ',
};

export function renderRandomPage(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'page random-page animate-fade-in';
  root.style.cssText = `
    padding: calc(var(--safe-top) + 24px) 16px calc(var(--safe-bottom) + 100px) 16px;
    max-width: 480px;
    margin: 0 auto;
    min-height: 100dvh;
    max-height: 100dvh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 20px;
  `;

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'margin-bottom:4px;';
  header.innerHTML = `
    <h1 style="font-size:24px;font-weight:700;letter-spacing:-0.03em;">Thử chút gì đó khác</h1>
    <p style="font-size:13px;color:var(--text-secondary);">Để vũ trụ quyết định hoạt động của hai đứa nhé 🎲</p>
  `;
  root.appendChild(header);

  // Selected state
  let selectedCategory: string | undefined = undefined;
  let activeDrawResult: RandomItem | null = null;
  let categories: RandomCategory[] = [];

  // Category Selector grid
  const selectorTitle = document.createElement('label');
  selectorTitle.className = 'input-label';
  selectorTitle.textContent = 'Chọn một chủ đề hoặc để ngẫu nhiên';
  root.appendChild(selectorTitle);

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(3, 1fr);gap:10px;';
  root.appendChild(grid);

  // Big Action Button
  const actionBtn = document.createElement('button');
  actionBtn.className = 'btn-primary btn-primary-full animate-slide-up';
  actionBtn.style.cssText = 'padding:16px;font-size:17px;font-weight:700;margin-top:4px;';
  actionBtn.innerHTML = `Bốc ngay! 🎲`;
  root.appendChild(actionBtn);

  // Result Card Container
  const resultContainer = document.createElement('div');
  resultContainer.style.cssText = 'margin-top:4px;display:none;';
  root.appendChild(resultContainer);

  // History Container
  const historyWrapper = document.createElement('div');
  historyWrapper.style.cssText = 'margin-top:12px;display:flex;flex-direction:column;gap:12px;';
  historyWrapper.innerHTML = `
    <h3 style="font-size:15px;font-weight:700;color:var(--text-secondary);">Lịch sử rút bài</h3>
    <div id="history-list" style="display:flex;flex-direction:column;gap:8px;"></div>
  `;
  root.appendChild(historyWrapper);

  // Fetch Categories and render
  async function loadCategories() {
    try {
      const res = await getCategories();
      categories = res;
      renderCategories();
    } catch {
      // Fallback
      categories = [
        { category: 'questions', label: 'Câu hỏi', description: 'Hỏi đáp thấu hiểu', icon: '❓', usageCount: 0 },
        { category: 'snap', label: 'Chụp hình', description: 'Thử thách chụp ảnh', icon: '📸', usageCount: 0 },
        { category: 'today', label: 'Hôm nay', description: 'Hoạt động trong ngày', icon: '📅', usageCount: 0 },
        { category: 'food', label: 'Món ăn', description: 'Hôm nay ăn gì', icon: '🍲', usageCount: 0 },
        { category: 'universe', label: 'Vũ trụ', description: 'Lời nhắn ngẫu nhiên', icon: '🌌', usageCount: 0 },
      ];
      renderCategories();
    }
  }

  function renderCategories() {
    grid.innerHTML = '';
    
    // Add "Ngẫu nhiên" card
    const randomCard = document.createElement('button');
    randomCard.style.cssText = getCardStyle(selectedCategory === undefined);
    randomCard.innerHTML = `
      <div style="font-size:28px;line-height:1;">🎲</div>
      <div style="font-size:12px;font-weight:600;margin-top:4px;">Bất kỳ</div>
    `;
    randomCard.addEventListener('click', () => {
      selectedCategory = undefined;
      updateSelections();
    });
    grid.appendChild(randomCard);

    categories.forEach(cat => {
      const card = document.createElement('button');
      const isSelected = selectedCategory === cat.category;
      card.style.cssText = getCardStyle(isSelected);
      const icon = CATEGORY_ICONS[cat.category] || '✨';
      card.innerHTML = `
        <div style="font-size:28px;line-height:1;">${icon}</div>
        <div style="font-size:12px;font-weight:600;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;">${cat.label}</div>
        ${cat.usageCount > 0 ? `<div style="font-size:9px;color:var(--text-secondary);margin-top:2px;">Rút ${cat.usageCount} lần</div>` : ''}
      `;
      card.addEventListener('click', () => {
        selectedCategory = cat.category;
        updateSelections();
      });
      grid.appendChild(card);
    });
  }

  function getCardStyle(selected: boolean): string {
    return `
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      padding:12px 8px;
      border-radius:16px;
      background: ${selected ? 'var(--accent-soft)' : 'var(--surface)'};
      border: 1.5px solid ${selected ? 'var(--accent)' : 'var(--border)'};
      color: ${selected ? 'var(--accent)' : 'var(--text-primary)'};
      transition: all var(--duration-fast) var(--ease);
      cursor:pointer;
      aspect-ratio: 1;
    `;
  }

  function updateSelections() {
    const cards = grid.querySelectorAll('button');
    // Re-render styles
    cards.forEach((card, idx) => {
      const isSelected = idx === 0 ? selectedCategory === undefined : categories[idx - 1].category === selectedCategory;
      card.style.cssText = getCardStyle(isSelected);
    });
  }

  // Draw Action
  actionBtn.addEventListener('click', async () => {
    actionBtn.disabled = true;
    actionBtn.innerHTML = `<span class="spinner" style="width:20px;height:20px;border-width:2px;border-color:#fff transparent transparent transparent;"></span> Đang bốc...`;
    
    try {
      const res = await drawRandom(selectedCategory);
      activeDrawResult = res;
      renderResultCard(res);
      showToast('Đã rút thành công một thẻ bài! 🎉', 'success');
      
      // Reload history and categories
      loadHistory();
      loadCategories();

    } catch (err: any) {
      showToast('Không rút được bài: ' + err.message, 'error');
    } finally {
      actionBtn.disabled = false;
      actionBtn.innerHTML = `Bốc ngay! 🎲`;
    }
  });

  function renderResultCard(res: RandomItem) {
    resultContainer.style.display = 'block';
    resultContainer.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'card animate-scale-in';
    card.style.cssText = 'padding:24px;border:2px solid var(--accent);display:flex;flex-direction:column;gap:16px;align-items:center;text-align:center;position:relative;background:var(--surface);';
    
    const catLabel = CATEGORY_LABELS[res.category] || res.category;
    const catIcon = CATEGORY_ICONS[res.category] || '✨';

    card.innerHTML = `
      <div class="badge" style="font-size:12px;padding:6px 12px;">
        ${catIcon} Thẻ bài: ${catLabel}
      </div>
      
      <div style="margin:8px 0;display:flex;flex-direction:column;gap:8px;">
        <h2 style="font-size:20px;font-weight:700;line-height:1.4;color:var(--text-primary);">${res.prompt}</h2>
        ${res.detail ? `<p style="font-size:14px;color:var(--text-secondary);line-height:1.5;">${res.detail}</p>` : ''}
      </div>

      <div style="display:flex;gap:10px;width:100%;margin-top:4px;">
        <button id="btn-draw-again" class="btn-ghost" style="flex:1;padding:12px;">Rút lại 🔄</button>
        <button id="btn-checkin-draw" class="btn-primary" style="flex:1.2;padding:12px;">Check-in ngay 📸</button>
      </div>
    `;

    card.querySelector('#btn-draw-again')?.addEventListener('click', () => {
      actionBtn.click();
    });

    card.querySelector('#btn-checkin-draw')?.addEventListener('click', () => {
      // Navigate to checkin page
      navigate('/app/checkin');
      // Wait a moment for rendering, then inject prompt into text area
      setTimeout(() => {
        const textInput = document.querySelector('#text-input') as HTMLTextAreaElement;
        if (textInput) {
          textInput.value = `[Thử thách ${catLabel}] ${res.prompt}\n`;
          textInput.focus();
        }
        const captionInput = document.querySelector('#caption-input') as HTMLInputElement;
        if (captionInput) {
          captionInput.value = `[Thử thách ${catLabel}] ${res.prompt}`;
        }
      }, 300);
    });

    resultContainer.appendChild(card);
    
    // Scroll to result
    resultContainer.scrollIntoView({ behavior: 'smooth' });
  }

  // Load History
  async function loadHistory() {
    const list = historyWrapper.querySelector('#history-list') as HTMLElement;
    if (!list) return;

    try {
      const items = await getHistory();
      renderHistory(items, list);
    } catch {
      list.innerHTML = `<div style="font-size:13px;color:var(--text-secondary);text-align:center;padding:12px;">Không thể tải lịch sử</div>`;
    }
  }

  function renderHistory(items: RandomHistoryItem[], container: HTMLElement) {
    container.innerHTML = '';
    
    if (items.length === 0) {
      container.innerHTML = `<div style="font-size:13px;color:var(--text-secondary);text-align:center;padding:12px;">Chưa rút thẻ bài nào</div>`;
      return;
    }

    // Show last 5
    items.slice(0, 5).forEach(item => {
      const row = document.createElement('div');
      row.style.cssText = `
        display:flex;
        align-items:center;
        gap:10px;
        padding:12px;
        background:var(--surface-solid);
        border:1px solid var(--border);
        border-radius:14px;
      `;
      
      const icon = CATEGORY_ICONS[item.category] || '✨';
      const timeStr = new Date(item.createdAt).toLocaleDateString('vi-VN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

      row.innerHTML = `
        <span style="font-size:22px;line-height:1;">${icon}</span>
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;">
          <span style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${item.prompt}
          </span>
          <span style="font-size:10px;color:var(--text-secondary);">${timeStr}</span>
        </div>
      `;

      row.addEventListener('click', () => {
        // Draw result from history item
        const histResult: RandomItem = {
          category: item.category,
          prompt: item.prompt,
          detail: item.detail ?? null,
        };
        renderResultCard(histResult);
      });

      container.appendChild(row);
    });
  }

  // Init
  loadCategories();
  loadHistory();

  // Inject Nav
  root.appendChild(createNav('/app/random'));

  return root;
}
