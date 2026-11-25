import { icon, type IconName, type IconSize } from './icons/icons';

// ── Button ───────────────────────────────────────────────────────────────────

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'sticker';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonOptions {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  pill?: boolean;
  block?: boolean;
  leadingIcon?: IconName;
  trailingIcon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  onClick?: (event: MouseEvent) => void;
}

export interface ButtonController {
  element: HTMLButtonElement;
  setLoading: (loading: boolean, loadingLabel?: string) => void;
  setDisabled: (disabled: boolean) => void;
  setLabel: (label: string) => void;
}

export function createButton(options: ButtonOptions): ButtonController {
  const btn = document.createElement('button');
  btn.type = options.type ?? 'button';
  const variant = options.variant ?? 'primary';
  const classes = ['c-btn', `c-btn--${variant}`];
  if (options.size && options.size !== 'md') classes.push(`c-btn--${options.size}`);
  if (options.pill) classes.push('c-btn--pill');
  if (options.block) classes.push('c-btn--block');
  if (options.className) classes.push(options.className);
  btn.className = classes.join(' ');

  let currentLabel = options.label;
  const iconSize: IconSize = options.size === 'sm' ? 16 : 20;

  const renderContent = (loading: boolean, tempLabel?: string): void => {
    btn.replaceChildren();
    if (loading) {
      const spinner = document.createElement('span');
      spinner.className = 'c-btn__spinner';
      spinner.setAttribute('aria-hidden', 'true');
      btn.appendChild(spinner);
    } else if (options.leadingIcon) {
      btn.appendChild(icon(options.leadingIcon, { size: iconSize }));
    }

    const text = document.createElement('span');
    text.textContent = tempLabel ?? currentLabel;
    btn.appendChild(text);

    if (!loading && options.trailingIcon) {
      btn.appendChild(icon(options.trailingIcon, { size: iconSize }));
    }
  };

  renderContent(Boolean(options.loading));
  if (options.disabled || options.loading) btn.disabled = true;
  if (options.loading) {
    btn.classList.add('is-loading');
    btn.setAttribute('aria-busy', 'true');
  }
  if (options.onClick) btn.addEventListener('click', options.onClick);

  return {
    element: btn,
    setLoading(loading: boolean, loadingLabel?: string) {
      btn.classList.toggle('is-loading', loading);
      if (loading) {
        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');
      } else {
        btn.disabled = Boolean(options.disabled);
        btn.removeAttribute('aria-busy');
      }
      renderContent(loading, loading ? loadingLabel : undefined);
    },
    setDisabled(disabled: boolean) {
      btn.disabled = disabled;
    },
    setLabel(label: string) {
      currentLabel = label;
      renderContent(btn.classList.contains('is-loading'));
    },
  };
}

// ── IconButton (>= 44x44px, Mandatory Vietnamese aria-label) ─────────────────

export type IconButtonVariant = 'default' | 'ghost' | 'accent' | 'sticker';

export interface IconButtonOptions {
  icon: IconName;
  ariaLabel: string;
  variant?: IconButtonVariant;
  iconVariant?: 'outline' | 'filled';
  size?: IconSize;
  disabled?: boolean;
  className?: string;
  onClick?: (event: MouseEvent) => void;
}

export function createIconButton(options: IconButtonOptions): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  const classes = ['c-icon-btn'];
  if (options.variant && options.variant !== 'default') {
    classes.push(`c-icon-btn--${options.variant}`);
  }
  if (options.className) classes.push(options.className);
  btn.className = classes.join(' ');
  btn.setAttribute('aria-label', options.ariaLabel);
  btn.title = options.ariaLabel;
  if (options.disabled) btn.disabled = true;
  btn.appendChild(icon(options.icon, { size: options.size ?? 20, variant: options.iconVariant }));
  if (options.onClick) btn.addEventListener('click', options.onClick);
  return btn;
}

// ── Card ─────────────────────────────────────────────────────────────────────

export type CardVariant = 'default' | 'elevated' | 'polaroid' | 'sticker';

export interface CardOptions {
  variant?: CardVariant;
  grain?: boolean;
  className?: string;
  children?: (Node | string)[];
}

export function createCard(options: CardOptions = {}): HTMLElement {
  const card = document.createElement('article');
  const classes = ['c-card'];
  if (options.variant && options.variant !== 'default') {
    classes.push(`c-card--${options.variant}`);
  }
  if (options.grain) classes.push('u-grain-surface');
  if (options.className) classes.push(options.className);
  card.className = classes.join(' ');
  if (options.children) {
    for (const child of options.children) {
      card.append(child);
    }
  }
  return card;
}

// ── Avatar & Couple Pair ─────────────────────────────────────────────────────

export interface AvatarOptions {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  presence?: 'online' | 'offline';
  className?: string;
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function createAvatar(options: AvatarOptions): HTMLElement {
  const wrap = document.createElement('span');
  const classes = ['c-avatar'];
  if (options.size && options.size !== 'md') classes.push(`c-avatar--${options.size}`);
  if (options.className) classes.push(options.className);
  wrap.className = classes.join(' ');
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', options.name || 'Ảnh đại diện');

  const renderFallback = (): void => {
    wrap.querySelector('.c-avatar__img')?.remove();
    const text = document.createElement('span');
    text.textContent = getInitials(options.name);
    wrap.insertBefore(text, wrap.firstChild);
  };

  if (options.src) {
    const img = document.createElement('img');
    img.className = 'c-avatar__img';
    img.src = options.src;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('error', renderFallback, { once: true });
    wrap.appendChild(img);
  } else {
    renderFallback();
  }

  if (options.presence) {
    const dot = document.createElement('span');
    dot.className = `c-avatar__presence${options.presence === 'online' ? ' c-avatar__presence--online' : ''}`;
    dot.setAttribute('aria-hidden', 'true');
    wrap.appendChild(dot);
  }

  return wrap;
}

export function createAvatarPair(first: AvatarOptions, second: AvatarOptions, showHeartKnot = true): HTMLElement {
  const pair = document.createElement('div');
  pair.className = 'c-avatar-pair';
  pair.appendChild(createAvatar(first));
  if (showHeartKnot) {
    const knot = document.createElement('span');
    knot.className = 'c-avatar-pair__knot';
    knot.setAttribute('aria-hidden', 'true');
    knot.appendChild(icon('heart', { size: 16, variant: 'filled' }));
    pair.appendChild(knot);
  }
  pair.appendChild(createAvatar(second));
  return pair;
}

// ── Badge / Unread Dot / Chip ────────────────────────────────────────────────

export function createBadge(countOrText: number | string, variant: 'accent' | 'gold' = 'accent'): HTMLElement {
  const badge = document.createElement('span');
  badge.className = `c-badge${variant === 'gold' ? ' c-badge--gold' : ''}`;
  if (typeof countOrText === 'number') {
    badge.textContent = countOrText > 99 ? '99+' : String(Math.max(0, countOrText));
  } else {
    badge.textContent = countOrText;
  }
  return badge;
}

export interface ChipOptions {
  label: string;
  variant?: 'default' | 'gold' | 'ghost';
  leadingIcon?: IconName;
  selected?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}

export function createChip(options: ChipOptions): HTMLElement {
  const el = document.createElement(options.interactive || options.onClick ? 'button' : 'span');
  if (el instanceof HTMLButtonElement) el.type = 'button';
  const classes = ['c-chip'];
  if (options.variant && options.variant !== 'default') classes.push(`c-chip--${options.variant}`);
  if (options.selected) classes.push('is-selected');
  el.className = classes.join(' ');
  if (options.interactive || options.onClick) {
    el.setAttribute('aria-pressed', String(Boolean(options.selected)));
  }
  if (options.leadingIcon) {
    el.appendChild(icon(options.leadingIcon, { size: 16, variant: options.selected ? 'filled' : 'outline' }));
  }
  const span = document.createElement('span');
  span.textContent = options.label;
  el.appendChild(span);
  if (options.onClick) el.addEventListener('click', options.onClick);
  return el;
}
