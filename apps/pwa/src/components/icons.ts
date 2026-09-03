/**
 * Centralized SVG Icons System for LoveCheck
 * Designed with 24x24 viewBox, rounded stroke caps, and currentColor inheritance
 * for cohesive appearance across light and dark themes.
 */

export interface IconOptions {
  size?: number;
  filled?: boolean;
  className?: string;
  strokeWidth?: number;
}

function baseSvg(content: string, options: IconOptions = {}, defaultStroke = 2): string {
  const size = options.size ?? 24;
  const cls = options.className ? ` class="${options.className}"` : '';
  const stroke = options.strokeWidth ?? defaultStroke;
  return `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${content}</svg>`;
}

export function iconHome(options: IconOptions = {}): string {
  if (options.filled) {
    const size = options.size ?? 24;
    const cls = options.className ? ` class="${options.className}"` : '';
    return `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.7 2.3a1 1 0 0 0-1.4 0l-8 7.2A1 1 0 0 0 4 11v9a2 2 0 0 0 2 2h3a1 1 0 0 0 1-1v-6h4v6a1 1 0 0 0 1 1h3a2 2 0 0 0 2-2v-9a1 1 0 0 0-.3-.7l-8-7z"/></svg>`;
  }
  return baseSvg(
    '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    options,
  );
}

export function iconMemories(options: IconOptions = {}): string {
  if (options.filled) {
    const size = options.size ?? 24;
    const cls = options.className ? ` class="${options.className}"` : '';
    return `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6zm6 1a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-4 12h14l-4.5-5.5-3.5 4-2-2.5L5 19z"/></svg>`;
  }
  return baseSvg(
    '<rect width="18" height="18" x="3" y="3" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    options,
  );
}

export function iconMessages(options: IconOptions = {}): string {
  if (options.filled) {
    const size = options.size ?? 24;
    const cls = options.className ? ` class="${options.className}"` : '';
    return `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.477 2 2 6.142 2 11.254c0 2.802 1.34 5.312 3.47 6.946-.22.97-.84 2.53-1.8 3.52 0 0 2.29.13 4.54-1.39.57.14 1.17.21 1.79.21 5.523 0 10-4.142 10-9.254C22 6.142 17.523 2 12 2z"/></svg>`;
  }
  return baseSvg(
    '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/><path d="M12 9.5c-.8-1-2.2-1-3 0s-.2 2.2 1.5 3.3l1.5 1.2 1.5-1.2c1.7-1.1 2.3-2.3 1.5-3.3-.8-1-2.2-1-3 0z" fill="currentColor" stroke="none"/>',
    options,
  );
}

export function iconProfile(options: IconOptions = {}): string {
  if (options.filled) {
    const size = options.size ?? 24;
    const cls = options.className ? ` class="${options.className}"` : '';
    return `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm-7 18a7 7 0 0 1 14 0v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-1z"/></svg>`;
  }
  return baseSvg(
    '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    options,
  );
}

export function iconPlus(options: IconOptions = {}): string {
  return baseSvg(
    '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    options,
    2.8,
  );
}

export function iconSend(options: IconOptions = {}): string {
  const size = options.size ?? 18;
  const cls = options.className ? ` class="${options.className}"` : '';
  return `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`;
}

export function iconCamera(options: IconOptions = {}): string {
  return baseSvg(
    '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    options,
  );
}

export function iconGallery(options: IconOptions = {}): string {
  return baseSvg(
    '<rect width="18" height="18" x="3" y="3" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    options,
  );
}

export function iconClose(options: IconOptions = {}): string {
  return baseSvg(
    '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    options,
    2.4,
  );
}

export function iconBell(options: IconOptions = {}): string {
  return baseSvg(
    '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    options,
  );
}

export function iconArrowRight(options: IconOptions = {}): string {
  return baseSvg(
    '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    options,
    2.2,
  );
}

export function iconLogout(options: IconOptions = {}): string {
  return baseSvg(
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    options,
    2,
  );
}

export function iconDownload(options: IconOptions = {}): string {
  return baseSvg(
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    options,
    2,
  );
}

export function iconSparkle(options: IconOptions = {}): string {
  return baseSvg(
    '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/>',
    options,
    2,
  );
}
