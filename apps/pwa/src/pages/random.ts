import '../styles/20-pages/secondary.css';
import { navigate } from '../router';
import { getCategories, drawRandom, getHistory } from '../api/random';
import { showToast } from '../components/toast';
import { iconMarkup, type IconName } from '../ui/icons/icons';
import { createBadge, createButton, createIconButton } from '../ui/primitives';
import { createListGroup, createListRow } from '../ui/feedback';
import { triggerHaptic } from '../ui/haptics';
import type { RandomCategory, RandomHistoryItem, RandomItem } from '../api/types';

const CATEGORY_ICONS: Record<string, IconName> = {
  questions: 'help',
  snap: 'camera',
  today: 'calendar',
  food: 'gift',
  universe: 'sparkle',
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
  root.className = 'page random-page p-secondary animate-fade-in';

  // Header
  const header = document.createElement('header');
  header.className = 'p-sec-header';
  header.appendChild(
    createIconButton({
      icon: 'back',
      ariaLabel: 'Quay lại',
      onClick: () => navigate('/app/checkin'),
    }),
  );
  const headCopy = document.createElement('div');
  headCopy.innerHTML = `
    <span class="p-sec-header__eyebrow">Hộp bất ngờ</span>
    <h1 class="p-sec-header__title">Thử chút điều mới</h1>
    <p class="p-sec-header__sub">Để vũ trụ chọn giúp hoạt động cho hai đứa hôm nay</p>
  `;
  header.appendChild(headCopy);
  root.appendChild(header);

  let selectedCategory: string | undefined = undefined;
  let categories: RandomCategory[] = [];

  const grid = document.createElement('div');
  grid.className = 'random-category-grid p-random-grid';
  root.appendChild(grid);

  const drawBtnCtrl = createButton({
    label: 'Rút thẻ ngẫu nhiên',
    variant: 'sticker',
    size: 'lg',
    pill: true,
    block: true,
    leadingIcon: 'dice',
  });
  root.appendChild(drawBtnCtrl.element);

  const resultContainer = document.createElement('div');
  resultContainer.hidden = true;
  root.appendChild(resultContainer);

  const historyWrapper = document.createElement('section');
  historyWrapper.style.cssText = 'display:flex;flex-direction:column;gap:10px;margin-top:4px;';
  historyWrapper.innerHTML = `
    <span class="p-sec-header__eyebrow">Những thẻ vừa rút</span>
    <div id="history-list"></div>
  `;
  root.appendChild(historyWrapper);

  async function loadCategories(): Promise<void> {
    try {
      categories = await getCategories();
    } catch {
      categories = [
        { category: 'questions', label: 'Câu hỏi', description: 'Hỏi đáp thấu hiểu', icon: 'help', usageCount: 0 },
        { category: 'snap', label: 'Chụp hình', description: 'Thử thách chụp ảnh', icon: 'camera', usageCount: 0 },
        { category: 'today', label: 'Hôm nay', description: 'Hoạt động trong ngày', icon: 'calendar', usageCount: 0 },
        { category: 'food', label: 'Món ăn', description: 'Hôm nay ăn gì', icon: 'gift', usageCount: 0 },
        { category: 'universe', label: 'Vũ trụ', description: 'Lời nhắn ngẫu nhiên', icon: 'sparkle', usageCount: 0 },
      ];
    }
    renderCategories();
  }

  function buildCategoryTile(
    catKey: string | undefined,
    label: string,
    iconName: IconName,
    usageCount = 0,
  ): HTMLButtonElement {
    const isSelected = selectedCategory === catKey;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `p-random-cat${isSelected ? ' is-selected' : ''}`;
    btn.setAttribute('aria-pressed', String(isSelected));
    btn.innerHTML = `
      <span class="p-random-cat__icon">${iconMarkup(iconName, { size: 20, variant: isSelected ? 'filled' : 'outline' })}</span>
      <span class="p-random-cat__label">${label}</span>
      ${usageCount > 0 ? `<span class="p-random-cat__meta">Rút ${usageCount} lần</span>` : ''}
    `;
    btn.addEventListener('click', () => {
      selectedCategory = catKey;
      triggerHaptic('select');
      renderCategories();
    });
    return btn;
  }

  function renderCategories(): void {
    grid.replaceChildren();
    grid.appendChild(buildCategoryTile(undefined, 'Bất kỳ', 'dice'));
    categories.forEach((cat) => {
      const iconName = CATEGORY_ICONS[cat.category] ?? 'sparkle';
      grid.appendChild(buildCategoryTile(cat.category, cat.label, iconName, cat.usageCount));
    });
  }

  drawBtnCtrl.element.addEventListener('click', async () => {
    drawBtnCtrl.setLoading(true, 'Đang xào thẻ...');
    triggerHaptic('tap');

    try {
      const res = await drawRandom(selectedCategory);
      triggerHaptic('confirm');
      renderResultCard(res);
      showToast('Đã rút được một gợi ý mới!', 'success');
      void loadHistory();
      void loadCategories();
    } catch (err) {
      showToast('Không rút được thẻ: ' + (err as Error).message, 'error');
    } finally {
      drawBtnCtrl.setLoading(false);
    }
  });

  function renderResultCard(res: RandomItem): void {
    resultContainer.hidden = false;
    resultContainer.replaceChildren();

    const card = document.createElement('article');
    card.className = 'p-random-draw-card u-grain-surface';

    const catLabel = CATEGORY_LABELS[res.category] || res.category;
    card.appendChild(createBadge(`Chủ đề · ${catLabel}`, 'gold'));

    const promptEl = document.createElement('h2');
    promptEl.className = 'p-random-draw-card__prompt';
    promptEl.textContent = res.prompt;
    card.appendChild(promptEl);

    if (res.detail) {
      const detailEl = document.createElement('p');
      detailEl.className = 'p-random-draw-card__detail';
      detailEl.textContent = res.detail;
      card.appendChild(detailEl);
    }

    const actions = document.createElement('div');
    actions.className = 'p-random-draw-card__actions';
    const againBtn = createButton({
      label: 'Rút lại',
      variant: 'secondary',
      size: 'sm',
      pill: true,
      leadingIcon: 'refresh',
      onClick: () => drawBtnCtrl.element.click(),
    });
    againBtn.element.id = 'btn-draw-again';

    const checkinBtn = createButton({
      label: 'Check-in ngay',
      variant: 'primary',
      size: 'sm',
      pill: true,
      leadingIcon: 'camera',
      onClick: () => {
        navigate('/app/checkin');
        setTimeout(() => {
          const textInput = document.querySelector<HTMLTextAreaElement>('#text-input');
          if (textInput) {
            textInput.value = `[Thử thách ${catLabel}] ${res.prompt}\n`;
            textInput.focus();
          }
          const captionInput = document.querySelector<HTMLInputElement>('#caption-input');
          if (captionInput) {
            captionInput.value = `[Thử thách ${catLabel}] ${res.prompt}`;
          }
        }, 280);
      },
    });
    checkinBtn.element.id = 'btn-checkin-draw';

    actions.append(againBtn.element, checkinBtn.element);
    card.appendChild(actions);
    resultContainer.appendChild(card);
    resultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function loadHistory(): Promise<void> {
    const list = historyWrapper.querySelector<HTMLElement>('#history-list');
    if (!list) return;

    try {
      const items = await getHistory();
      renderHistory(items, list);
    } catch {
      list.innerHTML = '<p class="u-text-secondary" style="font-size:12px;">Chưa tải được lịch sử rút thẻ.</p>';
    }
  }

  function renderHistory(items: RandomHistoryItem[], container: HTMLElement): void {
    container.replaceChildren();
    if (items.length === 0) {
      container.innerHTML = '<p class="u-text-secondary" style="font-size:12px;">Chưa rút thẻ bài nào.</p>';
      return;
    }

    const rows = items.slice(0, 5).map((item) => {
      const timeStr = new Date(item.createdAt).toLocaleDateString('vi-VN', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      return createListRow({
        title: item.prompt,
        subtitle: timeStr,
        leadingIcon: CATEGORY_ICONS[item.category] ?? 'sparkle',
        chevron: true,
        onClick: () => {
          renderResultCard({
            category: item.category,
            prompt: item.prompt,
            detail: item.detail ?? null,
          });
        },
      });
    });

    container.appendChild(createListGroup(rows));
  }

  void loadCategories();
  void loadHistory();

  return root;
}
