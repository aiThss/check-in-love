const ICON_COLORS: Record<string, string> = {
  pink: '#FF3B7F',
  blue: '#3B82F6',
  green: '#10B981',
  red: '#EF4444',
  yellow: '#F59E0B',
  purple: '#8B5CF6',
  orange: '#F97316',
  teal: '#14B8A6',
};

const BG_OPACITY = '1A'; // ~10% opacity hex

export function createStatCard(
  icon: string,
  label: string,
  value: number | string,
  color = 'pink',
): HTMLElement {
  const hex = ICON_COLORS[color] ?? ICON_COLORS['pink'];
  const bg = hex + BG_OPACITY;

  const card = document.createElement('div');
  card.className = 'stat-card';

  const iconEl = document.createElement('div');
  iconEl.className = 'stat-card-icon';
  iconEl.style.background = bg;
  iconEl.textContent = icon;

  const body = document.createElement('div');
  body.className = 'stat-card-body';

  const valueEl = document.createElement('div');
  valueEl.className = 'stat-card-value';
  valueEl.textContent =
    typeof value === 'number' ? value.toLocaleString('vi-VN') : String(value);

  const labelEl = document.createElement('div');
  labelEl.className = 'stat-card-label';
  labelEl.textContent = label;

  body.appendChild(valueEl);
  body.appendChild(labelEl);

  card.appendChild(iconEl);
  card.appendChild(body);

  return card;
}

export function createSkeletonStatCard(): HTMLElement {
  const card = document.createElement('div');
  card.className = 'stat-card';

  card.innerHTML = `
    <div class="skeleton" style="width: 52px; height: 52px; border-radius: 14px; flex-shrink: 0;"></div>
    <div style="flex: 1;">
      <div class="skeleton skeleton-text w-60" style="height: 26px; margin-bottom: 8px;"></div>
      <div class="skeleton skeleton-text w-40"></div>
    </div>
  `;

  return card;
}
