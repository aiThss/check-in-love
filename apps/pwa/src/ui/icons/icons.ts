/**
 * Bespoke "Nét Yêu" SVG Icon System — Check IN Love Design System v2
 * 78 custom icons on 24x24 grid, stroke 1.75px, rounded organic corners & heart-aperture motif.
 * Zero external icon dependencies. Supports `outline` and `filled` (duotone) variants.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const SPRITE_ID = 'cil-icon-sprite';

export type IconVariant = 'outline' | 'filled';
export type IconSize = 16 | 20 | 24 | 28 | 32;
export type IconMotion = 'pop' | 'heartbeat' | 'shutter' | 'fly' | 'spin' | 'shake' | 'draw';

const HEART_INNER_SM = 'M12 15.8s-3.3-2.1-3.3-4.5a1.9 1.9 0 0 1 3.3-1.2 1.9 1.9 0 0 1 3.3 1.2c0 2.4-3.3 4.5-3.3 4.5Z';
const HEART_FULL = 'M12 20.2s-7.5-4.5-7.5-10.1a4.3 4.3 0 0 1 7.5-2.8 4.3 4.3 0 0 1 7.5 2.8c0 5.6-7.5 10.1-7.5 10.1Z';

export const ICON_PATHS = {
  // 1. Navigation (5)
  home: `<path class="cil-tone" d="M4.5 10.8 12 4.2l7.5 6.6V19a1.8 1.8 0 0 1-1.8 1.8H6.3A1.8 1.8 0 0 1 4.5 19Z"/><path d="M3.5 11.4 12 4l8.5 7.4"/><path d="M5.2 10.2V19a1.8 1.8 0 0 0 1.8 1.8h10a1.8 1.8 0 0 0 1.8-1.8v-8.8"/><path d="M12 16.4s-2.4-1.5-2.4-3.2a1.4 1.4 0 0 1 2.4-.9 1.4 1.4 0 0 1 2.4.9c0 1.7-2.4 3.2-2.4 3.2Z"/>`,
  memories: `<rect class="cil-tone" x="4" y="4" width="16" height="16" rx="4"/><rect x="4" y="4" width="16" height="16" rx="4"/><path d="m4.5 16.2 4.2-4 3.3 2.9 2.6-2.3 4.9 4.2"/><circle cx="8.6" cy="8.6" r="1.4"/>`,
  'checkin-lens': `<circle class="cil-tone" cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="9"/><path class="cil-fill-active" d="${HEART_INNER_SM}"/><path d="M12 5.4v1.3M12 17.3v1.3M5.4 12h1.3M17.3 12h1.3"/>`,
  chat: `<path class="cil-tone" d="M20.2 11.5a7.5 7 0 0 1-11.2 6.1L4.2 19l1.4-4.2A7 7 0 1 1 20.2 11.5Z"/><path d="M20.2 11.5a7.5 7 0 0 1-11.2 6.1L4.2 19l1.4-4.2A7 7 0 1 1 20.2 11.5Z"/><path d="M9.2 11.5h.01M12.2 11.5h.01M15.2 11.5h.01"/>`,
  profile: `<circle class="cil-tone" cx="12" cy="8.2" r="3.6"/><path class="cil-tone" d="M5.2 19.8c.9-3.4 3.6-5.2 6.8-5.2s5.9 1.8 6.8 5.2Z"/><circle cx="12" cy="8.2" r="3.6"/><path d="M5.2 19.8c.9-3.4 3.6-5.2 6.8-5.2s5.9 1.8 6.8 5.2"/>`,

  // 2. Camera & Media (8)
  camera: `<path class="cil-tone" d="M4 9a2 2 0 0 1 2-2h2l1.3-2h5.4L16 7h2a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M4 9a2 2 0 0 1 2-2h2l1.3-2h5.4L16 7h2a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><circle cx="12" cy="13" r="3.3"/>`,
  flash: `<path class="cil-tone cil-fill-active" d="M13.2 3.2 5.8 13.4h5.3l-1.1 7.4 8.2-10.4h-5.3Z"/><path d="M13.2 3.2 5.8 13.4h5.3l-1.1 7.4 8.2-10.4h-5.3Z"/>`,
  'flash-off': `<path d="M13.2 3.2 9.4 8.4M7.2 11.5l-1.4 1.9h5.3l-1.1 7.4 5.2-6.6M3.8 3.8l16.4 16.4"/>`,
  'flip-camera': `<path d="M4.2 11.5a7.8 7.8 0 0 1 13.4-5.2L19.8 8.5"/><path d="M19.8 4.2v4.3h-4.3"/><path d="M19.8 12.5a7.8 7.8 0 0 1-13.4 5.2L4.2 15.5"/><path d="M4.2 19.8v-4.3h4.3"/>`,
  shutter: `<circle class="cil-tone" cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.2"/><path d="m14.2 8.4 4.4 2.6M9.8 8.4l2.4-4.8M7.8 12l-2.2 4.6M9.8 15.6l-4.4-2.6M14.2 15.6l-2.4 4.8M16.2 12l2.2-4.6"/>`,
  gallery: `<rect class="cil-tone" x="3.5" y="5" width="14.5" height="14.5" rx="3.2"/><rect x="3.5" y="5" width="14.5" height="14.5" rx="3.2"/><path d="M7.5 3.5h10.3A2.7 2.7 0 0 1 20.5 6.2v10.3"/><path d="m4 16 3.8-3.6 2.8 2.4 2.2-1.8 4.7 4"/>`,
  image: `<rect class="cil-tone" x="3.8" y="4.5" width="16.4" height="15" rx="3.5"/><rect x="3.8" y="4.5" width="16.4" height="15" rx="3.5"/><circle cx="8.8" cy="9.2" r="1.5"/><path d="m4.5 16.8 4.6-4.4 3.6 3.1 2.5-2.1 4.5 3.8"/>`,
  polaroid: `<rect class="cil-tone" x="4.5" y="3.5" width="15" height="17" rx="2.5"/><rect x="4.5" y="3.5" width="15" height="17" rx="2.5"/><rect x="7" y="6" width="10" height="9.2" rx="1.2"/><path d="M12 12.8s-1.8-1.1-1.8-2.4a1 1 0 0 1 1.8-.6 1 1 0 0 1 1.8.6c0 1.3-1.8 2.4-1.8 2.4Z"/><path d="M9.5 17.8h5"/>`,

  // 3. Messaging & Actions (12)
  send: `<path class="cil-tone" d="M20.4 4.1 3.8 10.6l6.3 2.5 2.5 6.3Z"/><path d="M20.4 4.1 3.8 10.6l6.3 2.5 2.5 6.3Z"/><path d="M10.1 13.1 20.2 4.3"/>`,
  attach: `<path d="m19.2 11.4-7.6 7.6a5 5 0 0 1-7.1-7.1l8.1-8.1a3.3 3.3 0 0 1 4.7 4.7l-8.1 8.1a1.6 1.6 0 0 1-2.3-2.3l7.1-7.1"/>`,
  sticker: `<path class="cil-tone" d="M5 4h9.5L20 9.5V19a1.8 1.8 0 0 1-1.8 1.8H5A1.8 1.8 0 0 1 3.2 19V5.8A1.8 1.8 0 0 1 5 4Z"/><path d="M14.2 3.8H6A2.2 2.2 0 0 0 3.8 6v12A2.2 2.2 0 0 0 6 20.2h6.8a7.4 7.4 0 0 0 7.4-7.4V9.8Z"/><path d="M13.5 20v-4.2a2.3 2.3 0 0 1 2.3-2.3H20"/><path d="M9 10.2h.01M13.5 10.2h.01M8.8 13.6c.9.9 2.2 1.2 3.4.8"/>`,
  emoji: `<circle class="cil-tone" cx="12" cy="12" r="8.8"/><circle cx="12" cy="12" r="8.8"/><path d="M8.6 14.2c.9 1.4 2.1 2.1 3.4 2.1s2.5-.7 3.4-2.1"/><path d="M9.2 9.8h.01M14.8 9.8h.01"/>`,
  mic: `<rect class="cil-tone" x="9" y="3.5" width="6" height="10.5" rx="3"/><rect x="9" y="3.5" width="6" height="10.5" rx="3"/><path d="M5.8 11.2a6.2 6.2 0 0 0 12.4 0M12 17.4v3.2M9 20.6h6"/>`,
  reply: `<path d="M9.8 7.5 4.5 12l5.3 4.5"/><path d="M5 12h8.6a5.8 5.8 0 0 1 5.8 5.8v.7"/>`,
  forward: `<path d="m14.2 7.5 5.3 4.5-5.3 4.5"/><path d="M19 12h-8.6a5.8 5.8 0 0 0-5.8 5.8v.7"/>`,
  copy: `<rect class="cil-tone" x="8.5" y="8.5" width="11" height="11" rx="2.8"/><rect x="8.5" y="8.5" width="11" height="11" rx="2.8"/><path d="M15.5 8.5V6.8A2.3 2.3 0 0 0 13.2 4.5H6.8A2.3 2.3 0 0 0 4.5 6.8v6.4a2.3 2.3 0 0 0 2.3 2.3h1.7"/>`,
  delete: `<path class="cil-tone" d="M6.5 7.5h11l-.9 11.2a2 2 0 0 1-2 1.8H9.4a2 2 0 0 1-2-1.8Z"/><path d="M4.5 7.5h15M9.5 7.5V5.6a1.6 1.6 0 0 1 1.6-1.6h1.8a1.6 1.6 0 0 1 1.6 1.6v1.9"/><path d="M6.8 7.5 7.6 18.7a2 2 0 0 0 2 1.8h4.8a2 2 0 0 0 2-1.8L17.2 7.5M10.2 11.2v5.2M13.8 11.2v5.2"/>`,
  edit: `<path class="cil-tone" d="m15.6 5.2 3.2 3.2-9.6 9.6-4 .8.8-4Z"/><path d="m15.6 5.2 3.2 3.2a1.5 1.5 0 0 1 0 2.1l-8.8 8.8-4.2.9.9-4.2 8.8-8.8a1.5 1.5 0 0 1 2.1 0Z"/><path d="m14.2 6.6 3.2 3.2"/>`,
  share: `<path d="M12 3.8v11.4M8 7.8l4-4 4 4"/><path d="M5.5 13.5v4.2a2.3 2.3 0 0 0 2.3 2.3h8.4a2.3 2.3 0 0 0 2.3-2.3v-4.2"/>`,
  more: `<circle class="cil-solid" cx="6" cy="12" r="1.6"/><circle class="cil-solid" cx="12" cy="12" r="1.6"/><circle class="cil-solid" cx="18" cy="12" r="1.6"/>`,

  // 4. Status & Secondary Navigation (9)
  back: `<path d="M14.8 5.5 8.2 12l6.6 6.5"/>`,
  'chevron-right': `<path d="m9.2 5.8 6.4 6.2-6.4 6.2"/>`,
  'chevron-down': `<path d="m5.8 9.4 6.2 6.2 6.2-6.2"/>`,
  close: `<path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"/>`,
  check: `<path d="m4.8 12.6 4.6 4.6 9.8-10.4"/>`,
  'double-check': `<path d="m2.8 12.8 3.8 3.8 6.4-7.4"/><path d="m10.2 15.6 1.2 1.2 7.8-9"/>`,
  clock: `<circle class="cil-tone" cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="8.6"/><path d="M12 7.4V12l3.2 2"/>`,
  alert: `<circle class="cil-tone" cx="12" cy="12" r="8.8"/><circle cx="12" cy="12" r="8.8"/><path d="M12 8v4.8M12 16h.01"/>`,
  'wifi-off': `<path d="M3.5 3.5 20.5 20.5"/><path d="M8.5 15.5a5 5 0 0 1 6.2-.6M5.4 12.4a9.5 9.5 0 0 1 4.2-2.2M14.6 10.3a9.5 9.5 0 0 1 4 2.1M2.5 9a14 14 0 0 1 6-3.2M13 5.3a14 14 0 0 1 8.5 3.7"/><circle class="cil-solid" cx="12" cy="18.6" r="1.2"/>`,

  // 5. Love & Bespoke Reactions (12 — custom set, zero system emojis!)
  heart: `<path class="cil-tone cil-fill-active" d="${HEART_FULL}"/><path d="${HEART_FULL}"/>`,
  'heart-broken': `<path class="cil-tone" d="${HEART_FULL}"/><path d="${HEART_FULL}"/><path d="m12 7.2-1.8 4.2 3.2 1.8-2 4.6"/>`,
  'heart-burst': `<path class="cil-tone cil-fill-active" d="M12 18.2s-5.8-3.5-5.8-7.8a3.3 3.3 0 0 1 5.8-2.1 3.3 3.3 0 0 1 5.8 2.1c0 4.3-5.8 7.8-5.8 7.8Z"/><path d="M12 18.2s-5.8-3.5-5.8-7.8a3.3 3.3 0 0 1 5.8-2.1 3.3 3.3 0 0 1 5.8 2.1c0 4.3-5.8 7.8-5.8 7.8Z"/><path d="M12 2.8v1.8M4.2 5.6l1.3 1.2M19.8 5.6l-1.3 1.2M2.8 13.2h1.7M19.5 13.2h1.7"/>`,
  'react-love': `<circle class="cil-tone" cx="12" cy="12" r="8.8"/><circle cx="12" cy="12" r="8.8"/><path class="cil-solid" d="M8.5 11.4s-1.7-1-1.7-2.2a1 1 0 0 1 1.7-.6 1 1 0 0 1 1.7.6c0 1.2-1.7 2.2-1.7 2.2ZM15.5 11.4s-1.7-1-1.7-2.2a1 1 0 0 1 1.7-.6 1 1 0 0 1 1.7.6c0 1.2-1.7 2.2-1.7 2.2Z"/><path d="M9 14.6c.9 1.3 1.9 1.9 3 1.9s2.1-.6 3-1.9"/>`,
  'react-haha': `<circle class="cil-tone" cx="12" cy="12" r="8.8"/><circle cx="12" cy="12" r="8.8"/><path d="m7.8 9.4 1.8 1.2-1.8 1.2M16.2 9.4l-1.8 1.2 1.8 1.2"/><path d="M8.2 13.8h7.6a3.8 3.8 0 0 1-7.6 0Z"/>`,
  'react-wow': `<circle class="cil-tone" cx="12" cy="12" r="8.8"/><circle cx="12" cy="12" r="8.8"/><path d="M8.8 9.4h.01M15.2 9.4h.01"/><ellipse cx="12" cy="15" rx="2" ry="2.5"/>`,
  'react-ouch': `<circle class="cil-tone" cx="12" cy="12" r="8.8"/><circle cx="12" cy="12" r="8.8"/><path d="M8.8 10.2h.01M15.2 10.2h.01"/><path d="M9 16c.9-1.1 1.9-1.6 3-1.6s2.1.5 3 1.6"/><path d="M16.8 12.2c.6 1 .9 1.7.9 2.2a.9.9 0 0 1-1.8 0c0-.5.3-1.2.9-2.2Z"/>`,
  'react-hug': `<path class="cil-tone cil-fill-active" d="M12 19.4s-6.8-4-6.8-9a3.9 3.9 0 0 1 6.8-2.5 3.9 3.9 0 0 1 6.8 2.5c0 5-6.8 9-6.8 9Z"/><path d="M12 19.4s-6.8-4-6.8-9a3.9 3.9 0 0 1 6.8-2.5 3.9 3.9 0 0 1 6.8 2.5c0 5-6.8 9-6.8 9Z"/><path d="M6.2 13.4c2 .9 3.9 1.3 5.8 1.3s3.8-.4 5.8-1.3"/>`,
  'react-fire': `<path class="cil-tone cil-fill-active" d="M12.4 3.2c.4 3.2-1.8 4.8-1.8 7.2a2.4 2.4 0 0 0 4.2 1.6c.4-1 .5-2 .3-3 2.5 1.7 3.9 4.2 3.9 6.8a7 7 0 1 1-14 0c0-3.4 2.2-6.2 7.4-12.6Z"/><path d="M12.4 3.2c.4 3.2-1.8 4.8-1.8 7.2a2.4 2.4 0 0 0 4.2 1.6c.4-1 .5-2 .3-3 2.5 1.7 3.9 4.2 3.9 6.8a7 7 0 1 1-14 0c0-3.4 2.2-6.2 7.4-12.6Z"/>`,
  streak: `<path class="cil-tone cil-fill-active" d="M12.5 3.2c.3 3-1.7 4.6-1.7 6.9a2.3 2.3 0 0 0 4 1.5c.3-.9.4-1.8.2-2.7 2.4 1.6 3.8 4 3.8 6.6a6.8 6.8 0 1 1-13.6 0c0-3.2 2-5.9 7.3-12.3Z"/><path d="M12.5 3.2c.3 3-1.7 4.6-1.7 6.9a2.3 2.3 0 0 0 4 1.5c.3-.9.4-1.8.2-2.7 2.4 1.6 3.8 4 3.8 6.6a6.8 6.8 0 1 1-13.6 0c0-3.2 2-5.9 7.3-12.3Z"/><path d="M12 18.2s-2.1-1.3-2.1-2.8a1.2 1.2 0 0 1 2.1-.8 1.2 1.2 0 0 1 2.1.8c0 1.5-2.1 2.8-2.1 2.8Z"/>`,
  sparkle: `<path class="cil-tone cil-fill-active" d="m12 3.2 2.1 5.7 5.7 2.1-5.7 2.1L12 18.8 9.9 13.1 4.2 11l5.7-2.1Z"/><path d="m12 3.2 2.1 5.7 5.7 2.1-5.7 2.1L12 18.8 9.9 13.1 4.2 11l5.7-2.1Z"/><path d="M18.8 16.8v3.2M17.2 18.4h3.2"/>`,
  star: `<path class="cil-tone cil-fill-active" d="m12 3.6 2.5 5.1 5.6.8-4.1 4 1 5.6L12 16.4l-5 2.7 1-5.6-4.1-4 5.6-.8Z"/><path d="m12 3.6 2.5 5.1 5.6.8-4.1 4 1 5.6L12 16.4l-5 2.7 1-5.6-4.1-4 5.6-.8Z"/>`,

  // 6. Occasions & Love Journey (9)
  calendar: `<rect class="cil-tone" x="3.8" y="5.2" width="16.4" height="15" rx="3.4"/><rect x="3.8" y="5.2" width="16.4" height="15" rx="3.4"/><path d="M8 3.5v3.2M16 3.5v3.2M3.8 9.6h16.4"/><path d="M12 17.2s-2.4-1.5-2.4-3.1a1.4 1.4 0 0 1 2.4-.9 1.4 1.4 0 0 1 2.4.9c0 1.6-2.4 3.1-2.4 3.1Z"/>`,
  anniversary: `<path class="cil-tone" d="M5 12h14v7a1.8 1.8 0 0 1-1.8 1.8H6.8A1.8 1.8 0 0 1 5 19Z"/><path d="M5 12h14v7a1.8 1.8 0 0 1-1.8 1.8H6.8A1.8 1.8 0 0 1 5 19Z"/><path d="M3.8 12h16.4M5 15.6c1.5 1 3 1 4.6 0 1.6 1 3.2 1 4.8 0 1.6 1 3.1 1 4.6 0"/><path d="M12 8.2v3.8M12 5.8c.9-1 .9-2.2 0-2.8-.9.6-.9 1.8 0 2.8Z"/>`,
  gift: `<rect class="cil-tone" x="4.5" y="9.5" width="15" height="10.5" rx="2.2"/><rect x="3.8" y="6.5" width="16.4" height="3.5" rx="1.4"/><path d="M5.2 10v8a2 2 0 0 0 2 2h9.6a2 2 0 0 0 2-2v-8M12 6.5V20"/><path d="M12 6.5H8.8a2.1 2.1 0 1 1 0-4.2c2 0 3.2 2.2 3.2 4.2ZM12 6.5h3.2a2.1 2.1 0 1 0 0-4.2c-2 0-3.2 2.2-3.2 4.2Z"/>`,
  'location-pin': `<path class="cil-tone" d="M12 20.8s6.6-5.6 6.6-10.8a6.6 6.6 0 0 0-13.2 0c0 5.2 6.6 10.8 6.6 10.8Z"/><path d="M12 20.8s6.6-5.6 6.6-10.8a6.6 6.6 0 0 0-13.2 0c0 5.2 6.6 10.8 6.6 10.8Z"/><path d="M12 12.6s-2.2-1.4-2.2-2.9a1.3 1.3 0 0 1 2.2-.8 1.3 1.3 0 0 1 2.2.8c0 1.5-2.2 2.9-2.2 2.9Z"/>`,
  map: `<path class="cil-tone" d="m3.8 6.2 5.4-2.2 5.6 2.2 5.4-2.2v13.8l-5.4 2.2-5.6-2.2-5.4 2.2Z"/><path d="m3.8 6.2 5.4-2.2 5.6 2.2 5.4-2.2v13.8l-5.4 2.2-5.6-2.2-5.4 2.2Z"/><path d="M9.2 4v13.8M14.8 6.2V20"/>`,
  route: `<circle cx="6.5" cy="17.5" r="2.3"/><circle cx="17.5" cy="6.5" r="2.3"/><path d="M8.8 17.5h4.7a3 3 0 0 0 0-6h-3a3 3 0 0 1 0-5h4.7"/>`,
  'bucket-list': `<rect class="cil-tone" x="4.2" y="3.8" width="15.6" height="16.4" rx="3.4"/><rect x="4.2" y="3.8" width="15.6" height="16.4" rx="3.4"/><path d="m8 9.6 1.6 1.6 3-3.2M15 9.6h1.8M8 15h8.8"/>`,
  'scratch-card': `<rect class="cil-tone" x="3.5" y="5.5" width="17" height="13" rx="3.2"/><rect x="3.5" y="5.5" width="17" height="13" rx="3.2"/><path d="m8 14.8 6.5-5.6M11.2 15.2l4.2-3.6M8.2 11.4l3-2.6"/>`,
  dice: `<rect class="cil-tone" x="4" y="4" width="16" height="16" rx="3.8"/><rect x="4" y="4" width="16" height="16" rx="3.8"/><circle class="cil-solid" cx="8.5" cy="8.5" r="1.2"/><circle class="cil-solid" cx="15.5" cy="8.5" r="1.2"/><circle class="cil-solid" cx="12" cy="12" r="1.2"/><circle class="cil-solid" cx="8.5" cy="15.5" r="1.2"/><circle class="cil-solid" cx="15.5" cy="15.5" r="1.2"/>`,

  // 7. Discovery & Settings (11)
  search: `<circle class="cil-tone" cx="11" cy="11" r="6.8"/><circle cx="11" cy="11" r="6.8"/><path d="m16 16 4.2 4.2"/>`,
  filter: `<path d="M4.2 7h15.6M7.2 12h9.6M10.2 17h3.6"/>`,
  settings: `<circle class="cil-tone" cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="3.2"/><path d="M12 3.6v2M12 18.4v2M3.6 12h2M18.4 12h2M6.1 6.1l1.4 1.4M16.5 16.5l1.4 1.4M17.9 6.1l-1.4 1.4M7.5 16.5l-1.4 1.4"/>`,
  bell: `<path class="cil-tone" d="M6.2 16.4V11a5.8 5.8 0 0 1 11.6 0v5.4l1.6 1.6H4.6Z"/><path d="M6.2 16.4V11a5.8 5.8 0 0 1 11.6 0v5.4l1.6 1.6H4.6Z"/><path d="M10 18.2a2.2 2.2 0 0 0 4 0"/>`,
  'bell-off': `<path d="M9.2 5.9A5.8 5.8 0 0 1 17.8 11v3.2M6.2 9.8v6.6L4.6 18h11.8M10 18.2a2.2 2.2 0 0 0 4 0M3.8 3.8l16.4 16.4"/>`,
  moon: `<path class="cil-tone cil-fill-active" d="M19.4 14.6A7.8 7.8 0 0 1 9.4 4.6a7.8 7.8 0 1 0 10 10Z"/><path d="M19.4 14.6A7.8 7.8 0 0 1 9.4 4.6a7.8 7.8 0 1 0 10 10Z"/>`,
  sun: `<circle class="cil-tone" cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="4.2"/><path d="M12 3.2v2.1M12 18.7v2.1M3.2 12h2.1M18.7 12h2.1M5.8 5.8l1.5 1.5M16.7 16.7l1.5 1.5M18.2 5.8l-1.5 1.5M7.3 16.7l-1.5 1.5"/>`,
  palette: `<path class="cil-tone" d="M12 3.6a8.4 8.4 0 0 0 0 16.8h1.5a2.3 2.3 0 0 0 1.7-3.8 1.6 1.6 0 0 1 1.2-2.6H18A6 6 0 0 0 12 3.6Z"/><path d="M12 3.6a8.4 8.4 0 0 0 0 16.8h1.5a2.3 2.3 0 0 0 1.7-3.8 1.6 1.6 0 0 1 1.2-2.6H18A6 6 0 0 0 12 3.6Z"/><circle class="cil-solid" cx="8.2" cy="10.5" r="1.1"/><circle class="cil-solid" cx="11.2" cy="7.8" r="1.1"/><circle class="cil-solid" cx="15" cy="9.2" r="1.1"/>`,
  refresh: `<path d="M19.6 10.2A8 8 0 0 0 5.8 7.4L4.2 9.2"/><path d="M4.2 5v4.2h4.2"/><path d="M4.4 13.8a8 8 0 0 0 13.8 2.8l1.6-1.8"/><path d="M19.8 19v-4.2h-4.2"/>`,
  download: `<path d="M12 4v11.2M8 11.4l4 4 4-4"/><path d="M4.8 17.2v1.3A1.8 1.8 0 0 0 6.6 20.3h10.8a1.8 1.8 0 0 0 1.8-1.8v-1.3"/>`,
  upload: `<path d="M12 15.6V4.4M8 8.2l4-4 4 4"/><path d="M4.8 17.2v1.3A1.8 1.8 0 0 0 6.6 20.3h10.8a1.8 1.8 0 0 0 1.8-1.8v-1.3"/>`,

  // 8. Auth, Security & App (14)
  lock: `<rect class="cil-tone" x="5.2" y="10.5" width="13.6" height="9.8" rx="3"/><rect x="5.2" y="10.5" width="13.6" height="9.8" rx="3"/><path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7"/><circle class="cil-solid" cx="12" cy="15.4" r="1.3"/>`,
  shield: `<path class="cil-tone" d="M12 3.6 5.2 6.4v5.2c0 4.5 2.9 7.6 6.8 9 3.9-1.4 6.8-4.5 6.8-9V6.4Z"/><path d="M12 3.6 5.2 6.4v5.2c0 4.5 2.9 7.6 6.8 9 3.9-1.4 6.8-4.5 6.8-9V6.4Z"/><path d="m9.2 12.2 2 2 3.8-4"/>`,
  key: `<circle class="cil-tone" cx="8.5" cy="13.5" r="4.2"/><circle cx="8.5" cy="13.5" r="4.2"/><path d="m11.6 10.4 8-6.4M16.5 6.5l2.2 2.4M14 8.5l2 2.2"/>`,
  mail: `<rect class="cil-tone" x="3.5" y="5.5" width="17" height="13" rx="3"/><rect x="3.5" y="5.5" width="17" height="13" rx="3"/><path d="m4.5 7 7.5 5.6L19.5 7"/>`,
  google: `<path fill="#4285F4" stroke="none" d="M20.64 12.2c0-.64-.06-1.25-.16-1.84H12v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"/><path fill="#34A853" stroke="none" d="M12 21c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.33-1.58-5.04-3.71H3.96v2.33A9 9 0 0 0 12 21Z"/><path fill="#FBBC05" stroke="none" d="M6.96 13.71a5.4 5.4 0 0 1 0-3.42V7.96H3.96a9 9 0 0 0 0 8.08l3-2.33Z"/><path fill="#EA4335" stroke="none" d="M12 6.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C16.46 3.89 14.42 3 12 3a9 9 0 0 0-8.04 4.96l3 2.33C7.67 8.16 9.66 6.58 12 6.58Z"/>`,
  eye: `<path class="cil-tone" d="M2.8 12s3.4-6 9.2-6 9.2 6 9.2 6-3.4 6-9.2 6-9.2-6-9.2-6Z"/><path d="M2.8 12s3.4-6 9.2-6 9.2 6 9.2 6-3.4 6-9.2 6-9.2-6-9.2-6Z"/><circle cx="12" cy="12" r="2.6"/>`,
  'eye-off': `<path d="M3.8 3.8 20.2 20.2"/><path d="M9.9 6.3A9.6 9.6 0 0 1 12 6c5.8 0 9.2 6 9.2 6a16.4 16.4 0 0 1-3.3 3.9M6.5 8.4A16.2 16.2 0 0 0 2.8 12s3.4 6 9.2 6c1.4 0 2.7-.3 3.8-.8"/><path d="M10.2 10.2a2.6 2.6 0 0 0 3.6 3.6"/>`,
  link: `<path d="M10.2 13.8a4.2 4.2 0 0 0 6 0l2.6-2.6a4.2 4.2 0 0 0-6-6l-1.3 1.3"/><path d="M13.8 10.2a4.2 4.2 0 0 0-6 0l-2.6 2.6a4.2 4.2 0 0 0 6 6l1.3-1.3"/>`,
  user: `<circle class="cil-tone" cx="12" cy="8.2" r="3.6"/><path class="cil-tone" d="M5.2 19.8c.9-3.4 3.6-5.2 6.8-5.2s5.9 1.8 6.8 5.2Z"/><circle cx="12" cy="8.2" r="3.6"/><path d="M5.2 19.8c.9-3.4 3.6-5.2 6.8-5.2s5.9 1.8 6.8 5.2"/>`,
  couple: `<circle class="cil-tone" cx="8.5" cy="8.5" r="3"/><circle class="cil-tone" cx="15.8" cy="8.5" r="3"/><circle cx="8.5" cy="8.5" r="3"/><circle cx="15.8" cy="8.5" r="3"/><path d="M3.5 19.5c.7-2.9 2.6-4.4 5.2-4.4M15.3 15.1c2.6 0 4.5 1.5 5.2 4.4"/><path d="M12 19.2s-2.4-1.5-2.4-3.1a1.4 1.4 0 0 1 2.4-.9 1.4 1.4 0 0 1 2.4.9c0 1.6-2.4 3.1-2.4 3.1Z"/>`,
  logout: `<path d="M10 4.5H6.8A2.3 2.3 0 0 0 4.5 6.8v10.4a2.3 2.3 0 0 0 2.3 2.3H10"/><path d="m14.5 8 4.2 4-4.2 4M9.5 12h9"/>`,
  install: `<rect class="cil-tone" x="6" y="3.2" width="12" height="17.6" rx="2.8"/><rect x="6" y="3.2" width="12" height="17.6" rx="2.8"/><path d="M12 7.8v6.6M9.4 12l2.6 2.6 2.6-2.6M10.2 17.8h3.6"/>`,
  info: `<circle class="cil-tone" cx="12" cy="12" r="8.8"/><circle cx="12" cy="12" r="8.8"/><path d="M12 11.2v4.8M12 8.2h.01"/>`,
  help: `<circle class="cil-tone" cx="12" cy="12" r="8.8"/><circle cx="12" cy="12" r="8.8"/><path d="M9.8 9.4a2.3 2.3 0 0 1 4.4.8c0 1.5-2.2 2-2.2 3.3M12 16.8h.01"/>`,
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
