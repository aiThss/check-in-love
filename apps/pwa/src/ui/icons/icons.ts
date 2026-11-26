/**
 * Bespoke Hybrid SVG Icon System — Check IN Love Design System v2
 * - Streak / React-Fire: preserved original "Nét Yêu" flame
 * - Memories / Gallery / Image / Send: Demo 1 Liquid Glass multi-layer depth
 * - Chat: Photo 3 twin-bubble silhouette with Demo 3 Enamel Rose & Honey-Gold + ink border
 * - Settings: symmetric 8-tooth cogwheel in Demo 3 Enamel Pin Sticker style
 * - Remaining icons: Demo 3 Enamel Pin Sticker (MIX ink border + rose/gold enamel + white gloss)
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const SPRITE_ID = 'cil-icon-sprite';

export type IconVariant = 'outline' | 'filled';
export type IconSize = 16 | 20 | 24 | 28 | 32;
export type IconMotion = 'pop' | 'heartbeat' | 'shutter' | 'fly' | 'spin' | 'shake' | 'draw';

const HEART_INNER_SM = 'M12 15.8s-3.1-1.9-3.1-4.2a1.8 1.8 0 0 1 3.1-1.1 1.8 1.8 0 0 1 3.1 1.1c0 2.3-3.1 4.2-3.1 4.2Z';
const HEART_FULL = 'M12 20.2s-7.4-4.4-7.4-9.9a4.2 4.2 0 0 1 7.4-2.7 4.2 4.2 0 0 1 7.4 2.7c0 5.5-7.4 9.9-7.4 9.9Z';

const CHAT_FRONT =
  'M6.2 3.6h7.6a3.2 3.2 0 0 1 3.2 3.2v4.3a3.2 3.2 0 0 1-3.2 3.2H7.9l-3.7 2.8a.65.65 0 0 1-1.05-.52V6.8a3.2 3.2 0 0 1 3.05-3.2Z';
const CHAT_BACK =
  'M11.2 8.2h6.7A3.1 3.1 0 0 1 21 11.3v8.15a.62.62 0 0 1-1 .49l-3.35-2.54h-5.45a3.1 3.1 0 0 1-3.1-3.1v-3a3.1 3.1 0 0 1 3.1-3.1Z';

const GEAR_8_TEETH =
  'M10.6 2.7h2.8l.3 2.4 2 .8 1.9-1.5 2 2-1.5 1.9.8 2 2.4.3v2.8l-2.4.3-.8 2 1.5 1.9-2 2-1.9-1.5-2 .8-.3 2.4h-2.8l-.3-2.4-2-.8-1.9 1.5-2-2 1.5-1.9-.8-2-2.4-.3v-2.8l2.4-.3.8-2-1.5-1.9 2-2 1.9 1.5 2-.8.3-2.4Z';

function lgDefs(id: string): string {
  return `<defs><linearGradient id="cil-lg-${id}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:var(--cil-lg-stop-1)"/><stop offset="100%" style="stop-color:var(--cil-lg-stop-2)"/></linearGradient></defs>`;
}

export const ICON_PATHS = {
  // 1. Navigation (5)
  home: `<path class="cil-enamel-rose" d="M4.2 10.6 12 3.8l7.8 6.8v8.2a2.2 2.2 0 0 1-2.2 2.2H6.4a2.2 2.2 0 0 1-2.2-2.2v-8.2Z"/><path class="cil-enamel-gold" d="M12 16.8s-2.8-1.7-2.8-3.5a1.6 1.6 0 0 1 2.8-1.05A1.6 1.6 0 0 1 14.8 13.3c0 1.8-2.8 3.5-2.8 3.5Z"/><path class="cil-gloss" d="M7.2 9.6 11.3 6"/>`,
  memories: `${lgDefs('mem')}<rect class="cil-lg-back" x="7.5" y="3.2" width="13.2" height="14.5" rx="3" transform="rotate(6 14 10)"/><rect class="cil-lg-front" x="3.2" y="5.2" width="14.6" height="15.2" rx="3.2" fill="url(#cil-lg-mem)"/><circle class="cil-lg-detail" cx="8" cy="10" r="1.55"/><path class="cil-lg-detail" d="m5 17.3 3.7-3.8a1 1 0 0 1 1.44 0l1.96 2.02 1.44-1.38a1 1 0 0 1 1.4 0l1.46 1.52v1.64H5Z"/>`,
  'checkin-lens': `<circle class="cil-enamel-rose" cx="12" cy="12" r="8.8"/><path class="cil-enamel-gold" d="${HEART_INNER_SM}"/><path class="cil-gloss" d="M7.2 7.5a6.6 6.6 0 0 1 4.2-1.8"/>`,
  chat: `<path class="cil-enamel-gold" d="${CHAT_BACK}"/><path class="cil-enamel-rose" d="${CHAT_FRONT}"/><path class="cil-gloss" d="M5.6 6.2h4.2"/>`,
  profile: `<circle class="cil-enamel-gold" cx="12" cy="8" r="3.8"/><path class="cil-enamel-rose" d="M4.8 19c.8-3.2 3.6-5 7.2-5s6.4 1.8 7.2 5a1.2 1.2 0 0 1-1.2 1.4H6A1.2 1.2 0 0 1 4.8 19Z"/><path class="cil-gloss" d="M10.4 6.4a2 2 0 0 1 2.2-.3"/>`,

  // 2. Camera & Media (8)
  camera: `<path class="cil-enamel-rose" d="M3.6 8.8A2.6 2.6 0 0 1 6.2 6.2h1.9l1.2-1.8h5.4l1.2 1.8h1.9a2.6 2.6 0 0 1 2.6 2.6v8.4a2.6 2.6 0 0 1-2.6 2.6H6.2a2.6 2.6 0 0 1-2.6-2.6V8.8Z"/><circle class="cil-enamel-gold" cx="12" cy="13" r="3.5"/><path class="cil-gloss" d="M6.2 8.6h2.8"/>`,
  flash: `<path class="cil-enamel-gold" d="M13.2 3.2 5.8 13.4h5.3l-1.1 7.4 8.2-10.4h-5.3Z"/><path class="cil-gloss" d="M11.6 6.8 8.4 11.4"/>`,
  'flash-off': `<path class="cil-enamel-rose" d="M13.2 3.2 5.8 13.4h5.3l-1.1 7.4 8.2-10.4h-5.3Z"/><path class="cil-ink" d="M3.8 3.8l16.4 16.4"/>`,
  'flip-camera': `<circle class="cil-enamel-rose" cx="12" cy="12" r="7.8"/><path class="cil-ink" d="M7.6 10.6a4.6 4.6 0 0 1 7.8-2.2M16.4 13.4a4.6 4.6 0 0 1-7.8 2.2"/><path class="cil-ink" d="M15.8 6.4v2.6h-2.6M8.2 17.6V15h2.6"/>`,
  shutter: `<circle class="cil-enamel-rose" cx="12" cy="12" r="8.8"/><circle class="cil-enamel-gold" cx="12" cy="12" r="4"/><path class="cil-ink" d="m14 8.5 4.2 2.4M10 8.5l2.2-4.4M8 12l-2 4.2M10 15.5l-4.2-2.4M14 15.5l-2.2 4.4M16 12l2-4.2"/>`,
  gallery: `${lgDefs('gal')}<rect class="cil-lg-back" x="7.6" y="3.2" width="13" height="14.2" rx="3" transform="rotate(6 14 10)"/><rect class="cil-lg-front" x="3.2" y="5.2" width="14.6" height="15.2" rx="3.2" fill="url(#cil-lg-gal)"/><circle class="cil-lg-detail" cx="8" cy="10" r="1.5"/><path class="cil-lg-detail" d="m5 17.3 3.7-3.8a1 1 0 0 1 1.44 0l1.96 2.02 1.44-1.38a1 1 0 0 1 1.4 0l1.46 1.52v1.64H5Z"/>`,
  image: `${lgDefs('img')}<rect class="cil-lg-back" x="6.5" y="3.4" width="14" height="14" rx="3.2"/><rect class="cil-lg-front" x="3.5" y="5.2" width="15.8" height="15" rx="3.4" fill="url(#cil-lg-img)"/><circle class="cil-lg-detail" cx="8.4" cy="10" r="1.55"/><path class="cil-lg-detail" d="m5.2 17.4 4.1-4.1a1 1 0 0 1 1.45 0l2.2 2.2 1.6-1.5a1 1 0 0 1 1.4 0l1.85 1.8v1.6H5.2Z"/>`,
  polaroid: `<rect class="cil-enamel-cream" x="4.5" y="3.5" width="15" height="17" rx="2.6"/><rect class="cil-enamel-rose" x="7" y="6" width="10" height="9.2" rx="1.4"/><path class="cil-enamel-gold" d="M12 12.9s-1.9-1.1-1.9-2.4a1.05 1.05 0 0 1 1.9-.65 1.05 1.05 0 0 1 1.9.65c0 1.3-1.9 2.4-1.9 2.4Z"/><path class="cil-ink" d="M9.5 17.8h5"/>`,

  // 3. Messaging & Actions (12) — `send` uses Demo 1 Liquid Glass
  send: `${lgDefs('send')}<path class="cil-lg-back" d="m6.2 13.2 14.2-6.6-4.1 13.8-3.7-4.3-6.4-2.9Z"/><path class="cil-lg-front" d="M3.8 11.4 19.2 4.5a.9.9 0 0 1 1.23 1.04l-4.1 14.1a.9.9 0 0 1-1.56.34l-3.8-4.4-6.95-2.62a.9.9 0 0 1-.22-1.56Z" fill="url(#cil-lg-send)"/><path class="cil-lg-stroke" d="m10.9 15.4 8.7-10.2"/>`,
  attach: `<rect class="cil-enamel-gold" x="6.5" y="6.5" width="11" height="12" rx="5.5" transform="rotate(-35 12 12)" fill-opacity="0.35"/><path class="cil-ink" d="m19 11.4-7.4 7.4a4.8 4.8 0 0 1-6.8-6.8l7.9-7.9a3.2 3.2 0 0 1 4.5 4.5l-7.8 7.8a1.5 1.5 0 0 1-2.2-2.2l6.8-6.8"/>`,
  sticker: `<path class="cil-enamel-gold" d="M14.2 3.8H6A2.2 2.2 0 0 0 3.8 6v12A2.2 2.2 0 0 0 6 20.2h6.8a7.4 7.4 0 0 0 7.4-7.4V9.8l-6-6Z"/><path class="cil-enamel-rose" d="M13.2 20.1v-4.3a2.4 2.4 0 0 1 2.4-2.4h4.3"/><circle class="cil-ink-dot" cx="9" cy="10.2" r="1"/><circle class="cil-ink-dot" cx="13.6" cy="10.2" r="1"/><path class="cil-ink" d="M8.8 13.6c.9.9 2.2 1.2 3.4.8"/>`,
  emoji: `<circle class="cil-enamel-gold" cx="12" cy="12" r="8.6"/><circle class="cil-ink-dot" cx="9" cy="10" r="1.05"/><circle class="cil-ink-dot" cx="15" cy="10" r="1.05"/><path class="cil-ink" d="M8.6 14c.9 1.4 2.1 2 3.4 2s2.5-.6 3.4-2"/><path class="cil-gloss" d="M7.5 7.2a5.8 5.8 0 0 1 3.6-1.4"/>`,
  mic: `<rect class="cil-enamel-rose" x="8.8" y="3.5" width="6.4" height="10.6" rx="3.2"/><path class="cil-ink" d="M5.8 11.2a6.2 6.2 0 0 0 12.4 0M12 17.4v3.2"/><path class="cil-enamel-gold" d="M8.8 20.6h6.4"/><path class="cil-gloss" d="M10.8 6v3"/>`,
  reply: `<circle class="cil-enamel-rose" cx="12.5" cy="12.5" r="7.8" stroke="none"/><path class="cil-ink" d="M9.8 7.5 4.5 12l5.3 4.5"/><path class="cil-ink" d="M5 12h8.6a5.6 5.6 0 0 1 5.6 5.6v.8"/>`,
  forward: `<circle class="cil-enamel-rose" cx="11.5" cy="12.5" r="7.8" stroke="none"/><path class="cil-ink" d="m14.2 7.5 5.3 4.5-5.3 4.5"/><path class="cil-ink" d="M19 12h-8.6a5.6 5.6 0 0 0-5.6 5.6v.8"/>`,
  copy: `<rect class="cil-enamel-gold" x="4.5" y="4.5" width="11" height="11" rx="2.6"/><rect class="cil-enamel-rose" x="8.5" y="8.5" width="11" height="11" rx="2.6"/><path class="cil-gloss" d="M10.8 11h3.5"/>`,
  delete: `<path class="cil-enamel-rose" d="M6.8 7.5h10.4l-.8 11.2a2 2 0 0 1-2 1.8H9.6a2 2 0 0 1-2-1.8L6.8 7.5Z"/><path class="cil-enamel-gold" d="M9.4 7.5V5.6a1.6 1.6 0 0 1 1.6-1.6h2a1.6 1.6 0 0 1 1.6 1.6v1.9"/><path class="cil-ink" d="M4.5 7.5h15M10.3 11.2v5M13.7 11.2v5"/>`,
  edit: `<path class="cil-enamel-gold" d="m15.6 5.2 3.2 3.2a1.5 1.5 0 0 1 0 2.1l-8.8 8.8-4.2.9.9-4.2 8.8-8.8a1.5 1.5 0 0 1 2.1 0Z"/><path class="cil-enamel-rose" d="m13.8 7 3.2 3.2 1.8-1.8a1.5 1.5 0 0 0 0-2.1l-1.1-1.1a1.5 1.5 0 0 0-2.1 0L13.8 7Z"/>`,
  share: `<path class="cil-enamel-rose" d="M5.5 12.8h13v5a2.2 2.2 0 0 1-2.2 2.2H7.7a2.2 2.2 0 0 1-2.2-2.2v-5Z"/><path class="cil-ink" d="M12 3.8v11M8.2 7.6 12 3.8l3.8 3.8"/>`,
  more: `<circle class="cil-enamel-gold" cx="6" cy="12" r="2.1"/><circle class="cil-enamel-rose" cx="12" cy="12" r="2.1"/><circle class="cil-enamel-gold" cx="18" cy="12" r="2.1"/>`,

  // 4. Status & Secondary Navigation (9)
  back: `<path d="M14.8 5.5 8.2 12l6.6 6.5" stroke-width="2.2"/>`,
  'chevron-right': `<path d="m9.2 5.8 6.4 6.2-6.4 6.2" stroke-width="2.2"/>`,
  'chevron-down': `<path d="m5.8 9.4 6.2 6.2 6.2-6.2" stroke-width="2.2"/>`,
  close: `<path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" stroke-width="2.2"/>`,
  check: `<path d="m4.8 12.6 4.6 4.6 9.8-10.4" stroke-width="2.3"/>`,
  'double-check': `<path d="m2.8 12.8 3.8 3.8 6.4-7.4" stroke-width="2.1"/><path d="m10.2 15.6 1.2 1.2 7.8-9" stroke-width="2.1"/>`,
  clock: `<circle class="cil-enamel-gold" cx="12" cy="12" r="8.6"/><path class="cil-ink" d="M12 7.4V12l3.2 2"/><path class="cil-gloss" d="M7.8 7a5.8 5.8 0 0 1 3.4-1.3"/>`,
  alert: `<circle class="cil-enamel-rose" cx="12" cy="12" r="8.6"/><path class="cil-ink" d="M12 7.8v4.8"/><circle class="cil-enamel-gold" cx="12" cy="16.2" r="1.2"/>`,
  'wifi-off': `<path class="cil-ink" d="M3.5 3.5 20.5 20.5M8.5 15.5a5 5 0 0 1 6.2-.6M5.4 12.4a9.5 9.5 0 0 1 4.2-2.2M14.6 10.3a9.5 9.5 0 0 1 4 2.1M2.5 9a14 14 0 0 1 6-3.2M13 5.3a14 14 0 0 1 8.5 3.7"/><circle class="cil-enamel-gold" cx="12" cy="18.6" r="1.6"/>`,

  // 5. Love & Bespoke Reactions (12 — `react-fire` & `streak` preserved 100% untouched!)
  heart: `<path class="cil-enamel-rose" d="${HEART_FULL}"/><path class="cil-gloss" d="M7.2 8.4a2.4 2.4 0 0 1 2.4-1.3"/>`,
  'heart-broken': `<path class="cil-enamel-rose" d="${HEART_FULL}"/><path class="cil-ink" d="m12 7.2-1.8 4.2 3.2 1.8-2 4.6"/>`,
  'heart-burst': `<path class="cil-enamel-rose" d="M12 18.4s-5.8-3.5-5.8-7.8a3.3 3.3 0 0 1 5.8-2.1 3.3 3.3 0 0 1 5.8 2.1c0 4.3-5.8 7.8-5.8 7.8Z"/><circle class="cil-enamel-gold" cx="12" cy="3.5" r="1.2"/><circle class="cil-enamel-gold" cx="4.6" cy="6.2" r="1.1"/><circle class="cil-enamel-gold" cx="19.4" cy="6.2" r="1.1"/>`,
  'react-love': `<circle class="cil-enamel-gold" cx="12" cy="12" r="8.6"/><path class="cil-enamel-rose" d="M8.5 11.5s-1.8-1-1.8-2.3a1.05 1.05 0 0 1 1.8-.65 1.05 1.05 0 0 1 1.8.65c0 1.3-1.8 2.3-1.8 2.3ZM15.5 11.5s-1.8-1-1.8-2.3a1.05 1.05 0 0 1 1.8-.65 1.05 1.05 0 0 1 1.8.65c0 1.3-1.8 2.3-1.8 2.3Z"/><path class="cil-ink" d="M9 14.6c.9 1.3 1.9 1.9 3 1.9s2.1-.6 3-1.9"/>`,
  'react-haha': `<circle class="cil-enamel-gold" cx="12" cy="12" r="8.6"/><path class="cil-ink" d="m7.8 9.4 1.8 1.2-1.8 1.2M16.2 9.4l-1.8 1.2 1.8 1.2"/><path class="cil-enamel-rose" d="M8.2 13.8h7.6a3.8 3.8 0 0 1-7.6 0Z"/>`,
  'react-wow': `<circle class="cil-enamel-gold" cx="12" cy="12" r="8.6"/><circle class="cil-ink-dot" cx="8.8" cy="9.6" r="1.05"/><circle class="cil-ink-dot" cx="15.2" cy="9.6" r="1.05"/><ellipse class="cil-enamel-rose" cx="12" cy="15" rx="2.1" ry="2.6"/>`,
  'react-ouch': `<circle class="cil-enamel-gold" cx="12" cy="12" r="8.6"/><circle class="cil-ink-dot" cx="8.8" cy="10.2" r="1"/><circle class="cil-ink-dot" cx="15.2" cy="10.2" r="1"/><path class="cil-ink" d="M9 16c.9-1.1 1.9-1.6 3-1.6s2.1.5 3 1.6"/><path class="cil-enamel-rose" d="M17.2 11.8c.8 1.2 1.2 2 1.2 2.6a1.2 1.2 0 0 1-2.4 0c0-.6.4-1.4 1.2-2.6Z"/>`,
  'react-hug': `<path class="cil-enamel-rose" d="M12 19.4s-6.8-4-6.8-9a3.9 3.9 0 0 1 6.8-2.5 3.9 3.9 0 0 1 6.8 2.5c0 5-6.8 9-6.8 9Z"/><path class="cil-enamel-gold" d="M6.2 13.2c2 .9 3.9 1.4 5.8 1.4s3.8-.5 5.8-1.4"/>`,
  'react-fire': `<path class="cil-tone cil-fill-active" d="M12.4 3.2c.4 3.2-1.8 4.8-1.8 7.2a2.4 2.4 0 0 0 4.2 1.6c.4-1 .5-2 .3-3 2.5 1.7 3.9 4.2 3.9 6.8a7 7 0 1 1-14 0c0-3.4 2.2-6.2 7.4-12.6Z"/><path d="M12.4 3.2c.4 3.2-1.8 4.8-1.8 7.2a2.4 2.4 0 0 0 4.2 1.6c.4-1 .5-2 .3-3 2.5 1.7 3.9 4.2 3.9 6.8a7 7 0 1 1-14 0c0-3.4 2.2-6.2 7.4-12.6Z"/>`,
  streak: `<path class="cil-tone cil-fill-active" d="M12.5 3.2c.3 3-1.7 4.6-1.7 6.9a2.3 2.3 0 0 0 4 1.5c.3-.9.4-1.8.2-2.7 2.4 1.6 3.8 4 3.8 6.6a6.8 6.8 0 1 1-13.6 0c0-3.2 2-5.9 7.3-12.3Z"/><path d="M12.5 3.2c.3 3-1.7 4.6-1.7 6.9a2.3 2.3 0 0 0 4 1.5c.3-.9.4-1.8.2-2.7 2.4 1.6 3.8 4 3.8 6.6a6.8 6.8 0 1 1-13.6 0c0-3.2 2-5.9 7.3-12.3Z"/><path d="M12 18.2s-2.1-1.3-2.1-2.8a1.2 1.2 0 0 1 2.1-.8 1.2 1.2 0 0 1 2.1.8c0 1.5-2.1 2.8-2.1 2.8Z"/>`,
  sparkle: `<path class="cil-enamel-gold" d="m10.8 4.4 1.9 4.6 4.6 1.9-4.6 1.9-1.9 4.6-1.9-4.6-4.6-1.9 4.6-1.9 1.9-4.6Z"/><circle class="cil-enamel-rose" cx="18.2" cy="6.2" r="2.1"/><path class="cil-gloss" d="m9.8 8.2 1-2.2"/>`,
  star: `<path class="cil-enamel-gold" d="m12 3.6 2.5 5.1 5.6.8-4.1 4 1 5.6L12 16.4l-5 2.7 1-5.6-4.1-4 5.6-.8Z"/><path class="cil-gloss" d="m10.4 7.6 1.4-2.6"/>`,

  // 6. Occasions & Love Journey (9)
  calendar: `<rect class="cil-enamel-cream" x="3.8" y="5.2" width="16.4" height="15" rx="3.2"/><path class="cil-enamel-gold" d="M3.8 8.4A3.2 3.2 0 0 1 7 5.2h10a3.2 3.2 0 0 1 3.2 3.2v1.4H3.8V8.4Z"/><path class="cil-ink" d="M8 3.5v3M16 3.5v3"/><path class="cil-enamel-rose" d="M12 17.4s-2.5-1.5-2.5-3.2a1.45 1.45 0 0 1 2.5-.95 1.45 1.45 0 0 1 2.5.95c0 1.7-2.5 3.2-2.5 3.2Z"/>`,
  anniversary: `<path class="cil-enamel-rose" d="M5 11.8h14v7a1.8 1.8 0 0 1-1.8 1.8H6.8A1.8 1.8 0 0 1 5 18.8v-7Z"/><path class="cil-enamel-gold" d="M12 6.2c1.1-1.2 1.1-2.6 0-3.3-1.1.7-1.1 2.1 0 3.3Z"/><path class="cil-ink" d="M3.8 11.8h16.4M12 8v3.8M5 15.6c1.5 1 3 1 4.6 0 1.6 1 3.2 1 4.8 0 1.6 1 3.1 1 4.6 0"/>`,
  gift: `<rect class="cil-enamel-rose" x="4.4" y="9" width="15.2" height="11" rx="2.6"/><rect class="cil-enamel-gold" x="3.8" y="6.6" width="16.4" height="3.2" rx="1.4"/><rect class="cil-enamel-gold" x="10.7" y="6.6" width="2.6" height="13.4"/><path class="cil-enamel-gold" d="M8.6 6.6c-1.8 0-2.8-1.1-2.4-2.3.4-1.2 2-1.3 3.7.5L12 6.6l2.1-1.8c1.7-1.8 3.3-1.7 3.7-.5.4 1.2-.6 2.3-2.4 2.3"/>`,
  'location-pin': `<path class="cil-enamel-rose" d="M12 20.8s6.6-5.6 6.6-10.8a6.6 6.6 0 0 0-13.2 0c0 5.2 6.6 10.8 6.6 10.8Z"/><circle class="cil-enamel-gold" cx="12" cy="10" r="2.6"/><path class="cil-gloss" d="M8.2 7.2a4.6 4.6 0 0 1 3-1.8"/>`,
  map: `<path class="cil-enamel-rose" d="m3.8 6.2 5.4-2 5.6 2 5.4-2v13.6l-5.4 2-5.6-2-5.4 2V6.2Z"/><path class="cil-ink" d="M9.2 4.2v13.6M14.8 6.2v13.6"/><circle class="cil-enamel-gold" cx="12" cy="10.8" r="2.4"/>`,
  route: `<path class="cil-ink" d="M8.8 17.5h4.7a3 3 0 0 0 0-6h-3a3 3 0 0 1 0-5h4.7"/><circle class="cil-enamel-rose" cx="6.5" cy="17.5" r="2.4"/><circle class="cil-enamel-gold" cx="17.5" cy="6.5" r="2.4"/>`,
  'bucket-list': `<rect class="cil-enamel-rose" x="4.4" y="3.8" width="15.2" height="16.4" rx="3.2"/><circle class="cil-enamel-gold" cx="12" cy="12" r="4.3"/><path class="cil-ink" d="m10.1 12 1.3 1.4 2.6-2.7"/><path class="cil-gloss" d="M7.2 6.4h4"/>`,
  'scratch-card': `<rect class="cil-enamel-gold" x="3.5" y="5.5" width="17" height="13" rx="3.2"/><path class="cil-enamel-rose" d="m7.5 15 6.8-5.8M11 15.4l4.4-3.8M8 11.4l3.2-2.8"/><path class="cil-gloss" d="M6.2 8h3.5"/>`,
  dice: `<rect class="cil-enamel-rose" x="4" y="4" width="16" height="16" rx="3.8"/><circle class="cil-enamel-gold" cx="8.5" cy="8.5" r="1.4"/><circle class="cil-enamel-gold" cx="15.5" cy="8.5" r="1.4"/><circle class="cil-enamel-gold" cx="12" cy="12" r="1.5"/><circle class="cil-enamel-gold" cx="8.5" cy="15.5" r="1.4"/><circle class="cil-enamel-gold" cx="15.5" cy="15.5" r="1.4"/>`,

  // 7. Discovery & Settings (11) — `settings` upgraded to 8-tooth cogwheel in Demo 3 style
  search: `<circle class="cil-enamel-rose" cx="10.8" cy="10.8" r="6.5"/><circle class="cil-enamel-cream" cx="10.8" cy="10.8" r="3.3"/><path class="cil-enamel-gold" d="m15.6 15.6 4.2 4.2" stroke-width="3"/><path class="cil-gloss" d="M8.8 8.8a2.6 2.6 0 0 1 2-.8"/>`,
  filter: `<rect class="cil-enamel-rose" x="3.8" y="5.2" width="16.4" height="13.6" rx="3.2" stroke="none"/><path class="cil-ink" d="M4.5 7.5h15M7.5 12h9M10.2 16.5h3.6"/><circle class="cil-enamel-gold" cx="9.2" cy="7.5" r="1.6"/><circle class="cil-enamel-gold" cx="14.8" cy="12" r="1.6"/>`,
  settings: `<path class="cil-enamel-rose" d="${GEAR_8_TEETH}"/><circle class="cil-enamel-gold" cx="12" cy="12" r="3.3"/><path class="cil-gloss" d="M10.6 9.8a2.5 2.5 0 0 1 2.3-.2"/>`,
  bell: `<path class="cil-enamel-gold" d="M6.4 10.2a5.6 5.6 0 0 1 11.2 0v4.2l1.5 2H4.9l1.5-2v-4.2Z"/><circle class="cil-enamel-rose" cx="12" cy="18.8" r="2"/><path class="cil-gloss" d="M8.8 7.5a3.8 3.8 0 0 1 2.8-1.2"/>`,
  'bell-off': `<path class="cil-enamel-rose" d="M6.4 10.2a5.6 5.6 0 0 1 11.2 0v4.2l1.5 2H4.9l1.5-2v-4.2Z"/><path class="cil-ink" d="M3.8 3.8l16.4 16.4"/>`,
  moon: `<path class="cil-enamel-gold" d="M19.4 14.6A7.8 7.8 0 0 1 9.4 4.6a7.8 7.8 0 1 0 10 10Z"/><circle class="cil-enamel-rose" cx="16.5" cy="7.2" r="1.5"/>`,
  sun: `<circle class="cil-enamel-gold" cx="12" cy="12" r="4.5"/><path class="cil-ink" d="M12 3.2v2.1M12 18.7v2.1M3.2 12h2.1M18.7 12h2.1M5.8 5.8l1.5 1.5M16.7 16.7l1.5 1.5M18.2 5.8l-1.5 1.5M7.3 16.7l-1.5 1.5"/><path class="cil-gloss" d="M10.4 9.8a2.4 2.4 0 0 1 2-.4"/>`,
  palette: `<path class="cil-enamel-rose" d="M12 3.6a8.4 8.4 0 0 0 0 16.8h1.5a2.3 2.3 0 0 0 1.7-3.8 1.6 1.6 0 0 1 1.2-2.6H18A6 6 0 0 0 12 3.6Z"/><circle class="cil-enamel-gold" cx="8.2" cy="10.5" r="1.3"/><circle class="cil-enamel-gold" cx="11.4" cy="7.6" r="1.3"/><circle class="cil-enamel-cream" cx="15.2" cy="9.2" r="1.3"/>`,
  refresh: `<circle class="cil-enamel-gold" cx="12" cy="12" r="7.8" fill-opacity="0.32" stroke="none"/><path class="cil-ink" d="M18.8 9.4A7.2 7.2 0 0 0 6.2 7.8L4.8 9.4M4.8 5.4v4h4M5.2 14.6a7.2 7.2 0 0 0 12.6 1.6l1.4-1.6M19.2 18.6v-4h-4"/>`,
  download: `<path class="cil-enamel-gold" d="M4.8 15.8h14.4v2.6a1.8 1.8 0 0 1-1.8 1.8H6.6a1.8 1.8 0 0 1-1.8-1.8v-2.6Z"/><path class="cil-ink" d="M12 4v10.2M8.2 10.6 12 14.4l3.8-3.8"/>`,
  upload: `<path class="cil-enamel-gold" d="M4.8 15.8h14.4v2.6a1.8 1.8 0 0 1-1.8 1.8H6.6a1.8 1.8 0 0 1-1.8-1.8v-2.6Z"/><path class="cil-ink" d="M12 14.4V4.2M8.2 7.8 12 4l3.8 3.8"/>`,

  // 8. Auth, Security & App (14)
  lock: `<path class="cil-ink" d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7"/><rect class="cil-enamel-rose" x="5.2" y="10.5" width="13.6" height="9.8" rx="3"/><circle class="cil-enamel-gold" cx="12" cy="15.4" r="1.7"/><path class="cil-gloss" d="M7.6 12.8h3.4"/>`,
  shield: `<path class="cil-enamel-rose" d="M12 3.6 5.2 6.4v5.2c0 4.5 2.9 7.6 6.8 9 3.9-1.4 6.8-4.5 6.8-9V6.4L12 3.6Z"/><circle class="cil-enamel-gold" cx="12" cy="11.8" r="3.4"/><path class="cil-ink" d="m10.5 11.8 1.1 1.2 2.1-2.2"/>`,
  key: `<circle class="cil-enamel-gold" cx="8.5" cy="13.5" r="4.2"/><path class="cil-ink" d="m11.6 10.4 8-6.4M16.5 6.5l2.2 2.4M14 8.5l2 2.2"/><circle class="cil-enamel-rose" cx="8.5" cy="13.5" r="1.5"/>`,
  mail: `<rect class="cil-enamel-rose" x="3.5" y="5.5" width="17" height="13" rx="3"/><path class="cil-enamel-gold" d="m4.2 6.4 7.8 5.8 7.8-5.8A2.6 2.6 0 0 0 17.8 5.5H6.2a2.6 2.6 0 0 0-2 .9Z"/>`,
  google: `<path fill="#4285F4" stroke="none" d="M20.64 12.2c0-.64-.06-1.25-.16-1.84H12v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"/><path fill="#34A853" stroke="none" d="M12 21c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.33-1.58-5.04-3.71H3.96v2.33A9 9 0 0 0 12 21Z"/><path fill="#FBBC05" stroke="none" d="M6.96 13.71a5.4 5.4 0 0 1 0-3.42V7.96H3.96a9 9 0 0 0 0 8.08l3-2.33Z"/><path fill="#EA4335" stroke="none" d="M12 6.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C16.46 3.89 14.42 3 12 3a9 9 0 0 0-8.04 4.96l3 2.33C7.67 8.16 9.66 6.58 12 6.58Z"/>`,
  eye: `<path class="cil-enamel-rose" d="M2.8 12s3.4-6 9.2-6 9.2 6 9.2 6-3.4 6-9.2 6-9.2-6-9.2-6Z"/><circle class="cil-enamel-gold" cx="12" cy="12" r="2.8"/><circle class="cil-ink-dot" cx="12" cy="12" r="1.1"/>`,
  'eye-off': `<path class="cil-enamel-rose" d="M2.8 12s3.4-6 9.2-6 9.2 6 9.2 6-3.4 6-9.2 6-9.2-6-9.2-6Z"/><path class="cil-ink" d="M3.8 3.8 20.2 20.2"/>`,
  link: `<circle class="cil-enamel-gold" cx="8.5" cy="15.5" r="3.8" fill-opacity="0.35" stroke="none"/><circle class="cil-enamel-rose" cx="15.5" cy="8.5" r="3.8" stroke="none"/><path class="cil-ink" d="M10.2 13.8a4.2 4.2 0 0 0 6 0l2.6-2.6a4.2 4.2 0 0 0-6-6l-1.3 1.3M13.8 10.2a4.2 4.2 0 0 0-6 0l-2.6 2.6a4.2 4.2 0 0 0 6 6l1.3-1.3"/>`,
  user: `<circle class="cil-enamel-gold" cx="12" cy="8" r="3.8"/><path class="cil-enamel-rose" d="M4.8 19c.8-3.2 3.6-5 7.2-5s6.4 1.8 7.2 5a1.2 1.2 0 0 1-1.2 1.4H6A1.2 1.2 0 0 1 4.8 19Z"/>`,
  couple: `<circle class="cil-enamel-gold" cx="8.4" cy="8.4" r="3"/><circle class="cil-enamel-rose" cx="15.6" cy="8.4" r="3"/><path class="cil-ink" d="M3.5 19.4c.7-2.8 2.6-4.3 5.2-4.3M15.3 15.1c2.6 0 4.5 1.5 5.2 4.3"/><path class="cil-enamel-rose" d="M12 19.4s-2.5-1.5-2.5-3.2a1.4 1.4 0 0 1 2.5-.9 1.4 1.4 0 0 1 2.5.9c0 1.7-2.5 3.2-2.5 3.2Z"/>`,
  logout: `<rect class="cil-enamel-rose" x="4.5" y="4.5" width="7.2" height="15" rx="2.4"/><path class="cil-ink" d="m14.8 8.2 4 3.8-4 3.8M9.8 12h8.8"/>`,
  install: `<rect class="cil-enamel-rose" x="6" y="3.2" width="12" height="17.6" rx="2.8"/><circle class="cil-enamel-gold" cx="12" cy="11.2" r="3.6"/><path class="cil-ink" d="M12 9v4.2M10.2 11.6 12 13.4l1.8-1.8M10.2 17.8h3.6"/>`,
  info: `<circle class="cil-enamel-gold" cx="12" cy="12" r="8.6"/><path class="cil-ink" d="M12 11.2v4.8"/><circle class="cil-enamel-rose" cx="12" cy="8" r="1.2"/>`,
  help: `<circle class="cil-enamel-rose" cx="12" cy="12" r="8.6"/><path class="cil-ink" d="M9.8 9.4a2.3 2.3 0 0 1 4.4.8c0 1.5-2.2 2-2.2 3.3"/><circle class="cil-enamel-gold" cx="12" cy="16.8" r="1.2"/>`,
} as const;

export type IconName = keyof typeof ICON_PATHS;

export const ICON_NAMES = Object.keys(ICON_PATHS) as IconName[];

export const REACTION_ICON_MAP: Record<string, IconName> = {
  love: 'react-love',
  '❤️': 'heart',
  '💕': 'react-love',
  '🥰': 'react-love',
  '😘': 'react-hug',
  haha: 'react-haha',
  '😂': 'react-haha',
  '😆': 'react-haha',
  wow: 'react-wow',
  '😮': 'react-wow',
  ouch: 'react-ouch',
  '😢': 'react-ouch',
  hug: 'react-hug',
  fire: 'react-fire',
  '🔥': 'react-fire',
};

export interface IconOptions {
  size?: IconSize;
  variant?: IconVariant;
  motion?: IconMotion;
  className?: string;
  label?: string;
}

export function ensureIconSprite(doc: Document = document): SVGSVGElement | null {
  if (!doc.body) return null;
  const existing = doc.getElementById(SPRITE_ID);
  if (existing instanceof SVGSVGElement) return existing;

  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.id = SPRITE_ID;
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';

  const defs = doc.createElementNS(SVG_NS, 'defs');
  defs.innerHTML = ICON_NAMES.map(
    (name) => `<symbol id="cil-icon-${name}" viewBox="0 0 24 24">${ICON_PATHS[name]}</symbol>`,
  ).join('');
  svg.appendChild(defs);
  doc.body.insertBefore(svg, doc.body.firstChild);
  return svg;
}

function buildClassList(options: IconOptions): string {
  const classes = ['c-icon'];
  const size = options.size ?? 24;
  classes.push(`c-icon--${size}`);
  if (options.variant === 'filled') classes.push('c-icon--filled');
  if (options.motion) classes.push(`c-icon--${options.motion}`);
  if (options.className) classes.push(options.className);
  return classes.join(' ');
}

function escapeAttr(value: string): string {
  return value.replace(/[&"<>\u00A0]/g, (c) => ({
    '&': '&amp;',
    '"': '&quot;',
    '<': '&lt;',
    '>': '&gt;',
    '\u00A0': '&nbsp;',
  }[c] ?? c));
}

export function iconMarkup(name: IconName, options: IconOptions = {}): string {
  const cls = buildClassList(options);
  const size = options.size ?? 24;
  const a11y = options.label
    ? `role="img" aria-label="${escapeAttr(options.label)}"`
    : 'aria-hidden="true" focusable="false"';
  return `<svg class="${escapeAttr(cls)}" data-cil-icon="${name}" width="${size}" height="${size}" viewBox="0 0 24 24" ${a11y}>${ICON_PATHS[name]}</svg>`;
}

export function icon(name: IconName, options: IconOptions = {}): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  const size = options.size ?? 24;
  svg.setAttribute('class', buildClassList(options));
  svg.setAttribute('data-cil-icon', name);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  if (options.label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', options.label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
  }
  svg.innerHTML = ICON_PATHS[name];
  return svg;
}
