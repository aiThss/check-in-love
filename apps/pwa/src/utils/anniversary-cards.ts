import { getMe, type MeResponse } from '../api/auth';
import {
  getTodayOccasionCard,
  markOccasionCardRevealed,
  type AuthoredOccasionCard,
  type ResolvedServerOccasionCard,
} from '../api/occasion-cards';
import { showToast } from '../components/toast';
import { navigate } from '../router';
import { store } from '../store/index';
import { triggerHaptic } from '../ui/haptics';
import { iconMarkup, type IconName } from '../ui/icons/icons';
import {
  OCCASION_CATALOG,
  VIETNAM_TIMEZONE,
  getLunarMonthDay,
  type BuiltinOccasionKey,
  type OccasionCardId,
  type OccasionPattern,
} from './occasion-catalog';

export type { BuiltinOccasionKey, OccasionCardId, OccasionPattern };

const SEEN_PREFIX = 'lovecheck:occasion-card:seen:v1:';
const PREVIEW_QUERY = 'cardPreview';
const SCRATCH_THRESHOLD = 0.72;
const BIRTHDAY_NOTICE_PREFIX = 'lovecheck:birthday-setup-notice:v1:';
const SPECIAL_MODAL_CLOSED_EVENT = 'lovecheck:special-modal-closed';
const birthdayNoticeSession = new Set<string>();

const OCCASION_ART_SVG = `
<svg class="occasion-art" viewBox="0 0 130 155" width="160" height="185" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="occasionStemG" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#1b4332"/><stop offset="50%" stop-color="#40916c"/><stop offset="100%" stop-color="#1b4332"/>
    </linearGradient>
    <linearGradient id="occasionLeafGradL" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#95d5b2"/><stop offset="45%" stop-color="#40916c"/><stop offset="100%" stop-color="#1b4332"/>
    </linearGradient>
    <linearGradient id="occasionLeafGradR" x1="1" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#74c69d"/><stop offset="50%" stop-color="#2d6a4f"/><stop offset="100%" stop-color="#081c15"/>
    </linearGradient>
    <radialGradient id="occasionHp" cx="35%" cy="20%" r="70%">
      <stop offset="0%" stop-color="#ffd6e0" stop-opacity=".95"/><stop offset="40%" stop-color="#ff6b8a" stop-opacity=".85"/><stop offset="100%" stop-color="#a4133c" stop-opacity=".7"/>
    </radialGradient>
    <radialGradient id="occasionHp2" cx="35%" cy="20%" r="70%">
      <stop offset="0%" stop-color="#ffe5ec" stop-opacity=".9"/><stop offset="45%" stop-color="#ff85a1" stop-opacity=".8"/><stop offset="100%" stop-color="#c9184a" stop-opacity=".65"/>
    </radialGradient>
    <radialGradient id="occasionHi" cx="40%" cy="25%" r="65%">
      <stop offset="0%" stop-color="#fff0f5" stop-opacity=".9"/><stop offset="50%" stop-color="#ffb3c6" stop-opacity=".7"/><stop offset="100%" stop-color="#ff4d6d" stop-opacity=".45"/>
    </radialGradient>
    <radialGradient id="occasionCosmic" cx="40%" cy="35%" r="60%">
      <stop offset="0%" stop-color="#c77dff"/><stop offset="40%" stop-color="#7b2cbf"/><stop offset="100%" stop-color="#10002b"/>
    </radialGradient>
    <filter id="occasionDs"><feDropShadow dx="0" dy="2" stdDeviation="2.2" flood-color="#800f2f" flood-opacity=".3"/></filter>
    <filter id="occasionGlow"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="occasionSg"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="occasionLeafSh"><feDropShadow dx="0" dy="1.5" stdDeviation="1.2" flood-color="#081c15" flood-opacity=".35"/></filter>
  </defs>
  <style>
    .occasion-fl{transform-origin:65px 135px;animation:occasionSway 4s ease-in-out infinite}
    .occasion-core{animation:occasionPulse 2.4s ease-in-out infinite;transform-origin:65px 60px}
    .occasion-dot{animation:occasionTw 1.8s ease-in-out infinite}
    .occasion-d1{animation-delay:0s}.occasion-d2{animation-delay:.4s}.occasion-d3{animation-delay:.8s}.occasion-d4{animation-delay:1.2s}
    .occasion-petal{transform-origin:65px 60px;animation:occasionBloomPetal 4.2s ease-in-out infinite}
    .occasion-p0{animation-delay:0s}.occasion-p1{animation-delay:.35s}.occasion-p2{animation-delay:.7s}
    .occasion-p3{animation-delay:1.05s}.occasion-p4{animation-delay:1.4s}.occasion-p5{animation-delay:1.75s}
    .occasion-petal-in{transform-origin:65px 60px;animation:occasionBloomInner 4.2s ease-in-out infinite}
    .occasion-i0{animation-delay:.15s}.occasion-i1{animation-delay:.5s}.occasion-i2{animation-delay:.85s}
    .occasion-i3{animation-delay:1.2s}.occasion-i4{animation-delay:1.55s}.occasion-i5{animation-delay:1.9s}
    .occasion-leaf-l{transform-origin:58px 132px;animation:occasionLeafL 3.6s ease-in-out infinite}
    .occasion-leaf-r{transform-origin:72px 134px;animation:occasionLeafR 3.6s ease-in-out infinite;animation-delay:.5s}
    @keyframes occasionSway{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(7deg)}}
    @keyframes occasionPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
    @keyframes occasionTw{0%,100%{opacity:.3}50%{opacity:1}}
    @keyframes occasionBloomPetal{0%{transform:scale(.4);opacity:.4}18%{transform:scale(1);opacity:.9}72%{transform:scale(1);opacity:.9}100%{transform:scale(.4);opacity:.4}}
    @keyframes occasionBloomInner{0%{transform:scale(.35);opacity:.25}22%{transform:scale(.72);opacity:.75}68%{transform:scale(.72);opacity:.75}100%{transform:scale(.35);opacity:.25}}
    @keyframes occasionLeafL{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(10deg)}}
    @keyframes occasionLeafR{0%,100%{transform:rotate(4deg)}50%{transform:rotate(-10deg)}}
  </style>
  <g class="occasion-fl">
    <path d="M65 140 Q62 105 65 68" stroke="url(#occasionStemG)" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    <g class="occasion-leaf-l" filter="url(#occasionLeafSh)">
      <path d="M58 132 C48 128 36 122 32 116 C28 110 34 104 42 108 C50 112 56 122 58 132Z" fill="url(#occasionLeafGradL)"/>
      <path d="M56 130 Q48 122 40 116" stroke="#1b4332" stroke-width="1.1" fill="none" opacity=".55" stroke-linecap="round"/>
    </g>
    <g class="occasion-leaf-r" filter="url(#occasionLeafSh)">
      <path d="M72 134 C82 131 96 126 100 120 C104 114 98 108 90 112 C82 116 76 126 72 134Z" fill="url(#occasionLeafGradR)"/>
      <path d="M74 132 Q82 125 92 118" stroke="#081c15" stroke-width="1.1" fill="none" opacity=".5" stroke-linecap="round"/>
    </g>
    <g filter="url(#occasionDs)">
      <g transform="rotate(0 65 60)"><g class="occasion-petal occasion-p0"><path d="M65 18C65 8 79 2 88 16C97 2 111 8 111 18C111 38 88 58 88 58C88 58 65 38 65 18Z" fill="url(#occasionHp)" transform="translate(-23 10)" filter="url(#occasionGlow)" opacity=".88"/></g></g>
      <g transform="rotate(60 65 60)"><g class="occasion-petal occasion-p1"><path d="M65 18C65 8 79 2 88 16C97 2 111 8 111 18C111 38 88 58 88 58C88 58 65 38 65 18Z" fill="url(#occasionHp2)" transform="translate(-23 10)" opacity=".85"/></g></g>
      <g transform="rotate(120 65 60)"><g class="occasion-petal occasion-p2"><path d="M65 18C65 8 79 2 88 16C97 2 111 8 111 18C111 38 88 58 88 58C88 58 65 38 65 18Z" fill="url(#occasionHp)" transform="translate(-23 10)" opacity=".88"/></g></g>
      <g transform="rotate(180 65 60)"><g class="occasion-petal occasion-p3"><path d="M65 18C65 8 79 2 88 16C97 2 111 8 111 18C111 38 88 58 88 58C88 58 65 38 65 18Z" fill="url(#occasionHp2)" transform="translate(-23 10)" opacity=".85"/></g></g>
      <g transform="rotate(240 65 60)"><g class="occasion-petal occasion-p4"><path d="M65 18C65 8 79 2 88 16C97 2 111 8 111 18C111 38 88 58 88 58C88 58 65 38 65 18Z" fill="url(#occasionHp)" transform="translate(-23 10)" opacity=".88"/></g></g>
      <g transform="rotate(300 65 60)"><g class="occasion-petal occasion-p5"><path d="M65 18C65 8 79 2 88 16C97 2 111 8 111 18C111 38 88 58 88 58C88 58 65 38 65 18Z" fill="url(#occasionHp2)" transform="translate(-23 10)" opacity=".85"/></g></g>
      <g transform="rotate(0 65 60)"><g class="occasion-petal-in occasion-i0"><path d="M65 31C65 25 73 21 78 28C83 21 91 25 91 31C91 42 78 51 78 51C78 51 65 42 65 31Z" fill="url(#occasionHi)" transform="translate(-13 7)" opacity=".7"/></g></g>
      <g transform="rotate(60 65 60)"><g class="occasion-petal-in occasion-i1"><path d="M65 31C65 25 73 21 78 28C83 21 91 25 91 31C91 42 78 51 78 51C78 51 65 42 65 31Z" fill="url(#occasionHi)" transform="translate(-13 7)" opacity=".65"/></g></g>
      <g transform="rotate(120 65 60)"><g class="occasion-petal-in occasion-i2"><path d="M65 31C65 25 73 21 78 28C83 21 91 25 91 31C91 42 78 51 78 51C78 51 65 42 65 31Z" fill="url(#occasionHi)" transform="translate(-13 7)" opacity=".7"/></g></g>
      <g transform="rotate(180 65 60)"><g class="occasion-petal-in occasion-i3"><path d="M65 31C65 25 73 21 78 28C83 21 91 25 91 31C91 42 78 51 78 51C78 51 65 42 65 31Z" fill="url(#occasionHi)" transform="translate(-13 7)" opacity=".65"/></g></g>
      <g transform="rotate(240 65 60)"><g class="occasion-petal-in occasion-i4"><path d="M65 31C65 25 73 21 78 28C83 21 91 25 91 31C91 42 78 51 78 51C78 51 65 42 65 31Z" fill="url(#occasionHi)" transform="translate(-13 7)" opacity=".7"/></g></g>
      <g transform="rotate(300 65 60)"><g class="occasion-petal-in occasion-i5"><path d="M65 31C65 25 73 21 78 28C83 21 91 25 91 31C91 42 78 51 78 51C78 51 65 42 65 31Z" fill="url(#occasionHi)" transform="translate(-13 7)" opacity=".65"/></g></g>
    </g>
    <g class="occasion-core">
      <circle cx="65" cy="60" r="14.5" fill="url(#occasionCosmic)" filter="url(#occasionSg)"/>
      <path d="M65 47 L68 56.5 L78 56.5 L70 62.5 L73 72 L65 66 L57 72 L60 62.5 L52 56.5 L62 56.5 Z" fill="#e0aaff" filter="url(#occasionSg)"/>
      <circle cx="65" cy="60" r="3" fill="#f8f7ff"/>
      <circle class="occasion-dot occasion-d1" cx="57" cy="52" r="1.4" fill="#c77dff"/>
      <circle class="occasion-dot occasion-d2" cx="73" cy="52" r="1.3" fill="#e0aaff"/>
      <circle class="occasion-dot occasion-d3" cx="74" cy="68" r="1.4" fill="#c77dff"/>
      <circle class="occasion-dot occasion-d4" cx="56" cy="68" r="1.2" fill="#fff"/>
    </g>
  </g>
</svg>`;

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

interface OccasionContext {
  today: CalendarDate;
  dateKey: string;
  daysTogether: number;
  yearsTogether: number;
  recipientName: string;
  senderName: string;
  recipientAge?: number;
}

export interface OccasionCard {
  id: OccasionCardId;
  occasionKey?: string;
  title: string;
  eyebrow: string;
  message: string;
  signature: string;
  coverText: string;
  icon: IconName;
  pattern: OccasionPattern;
  colors: [string, string, string];
  coverImage?: string;
  scratchCoverUrl?: string;
  backgroundImageUrl?: string;
}

export interface OpenOccasionCardOptions {
  skipScratch?: boolean;
  isDraftPreview?: boolean;
  onRevealed?: () => void;
}

const PREVIEW_ORDER: BuiltinOccasionKey[] = OCCASION_CATALOG.map((item) => item.key);

export function getCalendarDate(value: Date | string, timeZone = VIETNAM_TIMEZONE): CalendarDate {
  if (typeof value === 'string') {
    const plain = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (plain) {
      return { year: Number(plain[1]), month: Number(plain[2]), day: Number(plain[3]) };
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return { year: 0, month: 0, day: 0 };
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value || 0);
  return { year: get('year'), month: get('month'), day: get('day') };
}

function toDateKey(date: CalendarDate): string {
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

function dayDifference(start: CalendarDate, end: CalendarDate): number {
  const startUtc = Date.UTC(start.year, start.month - 1, start.day);
  const endUtc = Date.UTC(end.year, end.month - 1, end.day);
  return Math.floor((endUtc - startUtc) / 86400000);
}

export function calculateAge(birthday: string | undefined, today = getCalendarDate(new Date())): number | undefined {
  if (!birthday) return undefined;
  const birth = getCalendarDate(birthday);
  if (!birth.year) return undefined;
  let age = today.year - birth.year;
  if (today.month < birth.month || (today.month === birth.month && today.day < birth.day)) age -= 1;
  return age >= 0 && age <= 130 ? age : undefined;
}

function isSameDay(left: CalendarDate, right: CalendarDate): boolean {
  return left.month > 0 && left.day > 0 && left.month === right.month && left.day === right.day;
}

function createContext(me: MeResponse, now = new Date()): OccasionContext {
  const today = getCalendarDate(now);
  const start = me.couple?.loveStartDate ? getCalendarDate(me.couple.loveStartDate) : undefined;
  const myBirthday = me.user.birthday;
  return {
    today,
    dateKey: toDateKey(today),
    daysTogether: start && start.year ? Math.max(0, dayDifference(start, today)) : 0,
    yearsTogether: start && start.year && isSameDay(start, today) ? Math.max(0, today.year - start.year) : 0,
    recipientName: me.user.displayName || 'bạn',
    senderName: me.user.partnerName || me.partnerUser?.displayName || 'người ấy',
    recipientAge: calculateAge(myBirthday, today),
  };
}

export function buildBuiltinOccasionCard(
  key: BuiltinOccasionKey,
  context: OccasionContext,
  override?: Partial<AuthoredOccasionCard>,
): OccasionCard {
  const entry = OCCASION_CATALOG.find((item) => item.key === key) ?? OCCASION_CATALOG[0];
  const defaults = entry.defaultCopy({
    recipientName: context.recipientName,
    senderName: context.senderName,
    recipientAge: context.recipientAge,
    yearsTogether: context.yearsTogether,
  });
  return {
    id: key,
    occasionKey: key,
    eyebrow: override?.eyebrow?.trim() || defaults.eyebrow,
    title: override?.title?.trim() || defaults.title,
    message: override?.message?.trim() || defaults.message,
    signature: override?.signature?.trim() || defaults.signature,
    coverText: override?.coverText?.trim() || defaults.coverText,
    icon: entry.icon,
    pattern: override?.pattern || entry.pattern,
    colors: override?.colors ?? entry.colors,
    coverImage: override?.scratchCoverUrl || entry.coverImage,
    scratchCoverUrl: override?.scratchCoverUrl,
    backgroundImageUrl: override?.backgroundImageUrl,
  };
}

export function toOccasionCardFromServer(dto: ResolvedServerOccasionCard): OccasionCard {
  return {
    id: dto.id,
    occasionKey: dto.occasionKey,
    eyebrow: dto.eyebrow,
    title: dto.title,
    message: dto.message,
    signature: dto.signature,
    coverText: dto.coverText,
    icon: (dto.icon as IconName) || 'gift',
    pattern: dto.pattern,
    colors: dto.colors,
    coverImage: dto.scratchCoverUrl || dto.coverImage,
    scratchCoverUrl: dto.scratchCoverUrl,
    backgroundImageUrl: dto.backgroundImageUrl,
  };
}

export function resolveOccasionCard(
  me: MeResponse,
  now = new Date(),
  partnerAuthoredCards: readonly AuthoredOccasionCard[] = [],
): OccasionCard | null {
  const context = createContext(me, now);
  const byKey = new Map(partnerAuthoredCards.map((c) => [c.occasionKey, c]));

  // 1) Custom date surprise from partner
  for (const c of partnerAuthoredCards) {
    if (c.kind !== 'custom' || !c.enabled || !c.customDate) continue;
    const raw = c.customDate.trim();
    const matched = c.scheduleType === 'annual'
      ? (raw.length >= 10 ? raw.slice(5, 10) : raw) === context.dateKey.slice(5, 10)
      : raw.slice(0, 10) === context.dateKey;
    if (matched) {
      return {
        id: c.occasionKey,
        occasionKey: c.occasionKey,
        eyebrow: c.eyebrow?.trim() || 'Món quà bất ngờ dành riêng bạn',
        title: c.title?.trim() || c.occasionLabel?.trim() || `Gửi ${context.recipientName} thương yêu`,
        message: c.message?.trim() || `Một lời nhắn nhỏ bí mật từ ${context.senderName} gửi đến ${context.recipientName} hôm nay.`,
        signature: c.signature?.trim() || `Thương nhiều — ${context.senderName}.`,
        coverText: c.coverText?.trim() || 'Cào nhẹ để mở bí mật người ấy gửi bạn',
        icon: 'gift',
        pattern: c.pattern || 'hearts',
        colors: c.colors ?? ['#ff8fb1', '#ff4d88', '#8a2148'],
        coverImage: c.scratchCoverUrl,
        scratchCoverUrl: c.scratchCoverUrl,
        backgroundImageUrl: c.backgroundImageUrl,
      };
    }
  }

  const pickBuiltin = (key: BuiltinOccasionKey): OccasionCard | null => {
    const entry = OCCASION_CATALOG.find((item) => item.key === key);
    if (!entry) return null;
    const row = byKey.get(key);
    if (entry.genderSpecific) {
      if (!row || !row.enabled) return null;
      return buildBuiltinOccasionCard(key, context, row);
    }
    if (row && !row.enabled) return null;
    return buildBuiltinOccasionCard(key, context, row);
  };

  // 2) Recipient's own birthday (me.user.birthday)
  if (me.user.birthday && isSameDay(getCalendarDate(me.user.birthday), context.today)) {
    const bday = pickBuiltin('birthday');
    if (bday) return bday;
  }

  // 3) Love milestones
  if (context.daysTogether === 100) {
    const c = pickBuiltin('day-100');
    if (c) return c;
  }
  if (context.daysTogether === 500) {
    const c = pickBuiltin('day-500');
    if (c) return c;
  }
  if (context.daysTogether === 1000) {
    const c = pickBuiltin('day-1000');
    if (c) return c;
  }
  if (context.yearsTogether >= 1) {
    const c = pickBuiltin('anniversary');
    if (c) return c;
  }

  // 4) Lunar Vietnamese holidays
  const lunar = getLunarMonthDay(now);
  if (lunar && !lunar.isLeapMonth) {
    for (const item of OCCASION_CATALOG) {
      if (item.lunar && item.lunar[0] === lunar.month && item.lunar[1] === lunar.day) {
        const c = pickBuiltin(item.key);
        if (c) return c;
      }
    }
  }

  // 5) Solar Vietnamese & couple holidays
  for (const item of OCCASION_CATALOG) {
    if (item.solar && item.solar[0] === context.today.month && item.solar[1] === context.today.day) {
      const c = pickBuiltin(item.key);
      if (c) return c;
    }
  }

  return null;
}

function previewContext(me?: MeResponse): OccasionContext {
  const today = getCalendarDate(new Date());
  if (me) {
    const partnerBday = me.user.partnerBirthday || me.partnerUser?.birthday;
    return {
      today,
      dateKey: toDateKey(today),
      daysTogether: 100,
      yearsTogether: 1,
      recipientName: me.user.partnerName || me.partnerUser?.displayName || 'người ấy',
      senderName: me.user.displayName || 'mình',
      recipientAge: calculateAge(partnerBday, today) ?? 22,
    };
  }
  return {
    today,
    dateKey: toDateKey(today),
    daysTogether: 100,
    yearsTogether: 1,
    recipientName: 'Người thương',
    senderName: 'Mình',
    recipientAge: 22,
  };
}

function ensureStyles(): void {
  if (document.getElementById('occasion-card-styles')) return;
  const style = document.createElement('style');
  style.id = 'occasion-card-styles';
  style.textContent = `
    .occasion-overlay {
      position: fixed; inset: 0; z-index: 5000;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
      padding: max(16px, calc(var(--android-status-bar, env(safe-area-inset-top, 0px)) + 10px)) 16px max(18px, calc(var(--android-nav-bar, env(safe-area-inset-bottom, 0px)) + 12px));
      background: rgba(18, 10, 18, 0.82);
      backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
      animation: occasionFade 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    .occasion-shell {
      position: relative; width: min(390px, 100%);
      max-height: calc(var(--app-viewport-height, 100vh) - 104px); overflow: auto;
      border-radius: 30px;
      box-shadow: 0 30px 100px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.16);
      background: #1a101b; animation: occasionRise 0.42s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    .occasion-paper {
      --paper-start: #fffdf9;
      --paper-mid: #fff2ec;
      --paper-end: #f3dfe4;
      --paper-ink: #3d2634;
      --paper-strong: #602947;
      --paper-accent: #ad5278;
      --paper-glow: rgba(255, 133, 177, 0.25);
      --paper-glow-2: rgba(196, 124, 206, 0.17);
      --paper-line: rgba(161, 76, 115, 0.26);
      --panel: rgba(255, 255, 255, 0.72);
      --hint-bg: rgba(39, 17, 38, 0.76);
      position: relative; min-height: 520px; padding: 42px 22px 26px;
      overflow: hidden; border-radius: 30px;
      background:
        radial-gradient(circle at 84% 8%, var(--paper-glow), transparent 28%),
        radial-gradient(circle at 10% 94%, var(--paper-glow-2), transparent 31%),
        linear-gradient(150deg, var(--paper-start), var(--paper-mid) 48%, var(--paper-end));
      color: var(--paper-ink);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.88),
                  inset 0 0 0 6px rgba(255, 255, 255, 0.46),
                  inset 0 0 0 8px var(--paper-line);
      isolation: isolate;
    }
    .occasion-custom-bg {
      position: absolute; inset: 0; z-index: 0;
      background-position: center; background-size: cover; background-repeat: no-repeat;
      opacity: 0.92;
    }
    .occasion-paper.has-custom-bg {
      --panel: rgba(255, 250, 252, 0.86);
    }
    .occasion-paper[data-pattern='confetti'] {
      --paper-start: #fffdf1; --paper-mid: #fff0c9; --paper-end: #ffd8c9;
      --paper-strong: #8c3d42; --paper-accent: #d46657;
    }
    .occasion-paper[data-pattern='stars'] {
      --paper-start: #f8fdff; --paper-mid: #e7f1ff; --paper-end: #d8dcfa;
      --paper-ink: #263352; --paper-strong: #334184; --paper-accent: #5267c3;
    }
    .occasion-paper[data-pattern='lanterns'] {
      --paper-start: #fffaf0; --paper-mid: #ffebd2; --paper-end: #ffd2c9;
      --paper-ink: #471d1d; --paper-strong: #801b1b; --paper-accent: #c93b2b;
    }
    .occasion-paper[data-pattern='snow'] {
      --paper-start: #f5fffd; --paper-mid: #dcf4ef; --paper-end: #c8e5df;
      --paper-ink: #244745; --paper-strong: #1c5c58; --paper-accent: #2f8d83;
    }
    .occasion-paper[data-pattern='ribbons'] {
      --paper-start: #fffaff; --paper-mid: #f3e8ff; --paper-end: #dfd1f3;
      --paper-strong: #59397f; --paper-accent: #815ab0;
    }
    .occasion-paper[data-pattern='candy'] {
      --paper-start: #f8fffe; --paper-mid: #dcfbf5; --paper-end: #d6e5ff;
      --paper-ink: #224250; --paper-strong: #355488; --paper-accent: #4c90bd;
    }
    .occasion-border-frame {
      position: absolute; inset: 12px; z-index: 1; pointer-events: none;
      border: 1px solid var(--paper-line); border-radius: 22px;
    }
    .occasion-corner {
      position: absolute; z-index: 2; width: 22px; height: 22px;
      color: transparent; font-size: 0; pointer-events: none;
    }
    .occasion-corner.top-left { top: 16px; left: 16px; border-top: 1.5px solid var(--paper-accent); border-left: 1.5px solid var(--paper-accent); }
    .occasion-corner.top-right { top: 16px; right: 16px; border-top: 1.5px solid var(--paper-accent); border-right: 1.5px solid var(--paper-accent); }
    .occasion-corner.bottom-left { bottom: 16px; left: 16px; border-bottom: 1.5px solid var(--paper-accent); border-left: 1.5px solid var(--paper-accent); }
    .occasion-corner.bottom-right { bottom: 16px; right: 16px; border-bottom: 1.5px solid var(--paper-accent); border-right: 1.5px solid var(--paper-accent); }
    .occasion-inner {
      position: relative; z-index: 2; padding: 18px 16px 20px; text-align: center;
      border: 1px solid rgba(255, 255, 255, 0.78); border-radius: 24px;
      background: linear-gradient(145deg, var(--panel), rgba(255, 255, 255, 0.56));
      box-shadow: 0 14px 32px rgba(72, 26, 59, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.9);
      -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
    }
    .occasion-art-wrap {
      display: inline-flex; align-items: center; justify-content: center;
      width: 86px; height: 92px; margin-bottom: 12px; border-radius: 24px;
      background: linear-gradient(145deg, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.35));
      box-shadow: 0 12px 24px rgba(78, 32, 70, 0.14);
      transform: rotate(-3deg);
    }
    .occasion-art { display: block; width: 100%; height: 100%; overflow: visible; }
    .occasion-eyebrow {
      font-family: var(--font-sans); font-size: 10.5px; font-weight: 800;
      letter-spacing: 0.18em; text-transform: uppercase; color: var(--paper-accent); margin-bottom: 8px;
    }
    .occasion-title {
      font-family: var(--font-display); font-size: 25px; font-weight: 700; line-height: 1.24;
      color: var(--paper-strong); margin: 0 0 14px; text-wrap: balance; letter-spacing: -0.025em;
    }
    .occasion-divider {
      display: flex; align-items: center; justify-content: center; gap: 12px;
      width: 136px; margin: 0 auto 16px;
    }
    .divider-line { flex: 1; height: 1px; background: linear-gradient(90deg, transparent, var(--paper-accent), transparent); }
    .divider-heart { font-size: 12px; color: var(--paper-accent); }
    .occasion-message {
      font-family: var(--font-display); font-size: 17px; font-weight: 500; line-height: 1.65;
      color: var(--paper-ink); margin: 0; white-space: pre-wrap;
    }
    .occasion-signature-wrap {
      margin-top: 22px; display: flex; align-items: flex-end; justify-content: space-between; gap: 12px;
      padding-top: 14px; border-top: 1px dashed rgba(180, 120, 145, 0.32);
    }
    .occasion-signature {
      flex: 1 1 auto; min-width: 0; margin: 0;
      font-family: var(--font-display); font-style: italic; font-size: 19px; font-weight: 600;
      line-height: 1.22; text-align: left; color: var(--paper-accent);
    }
    .occasion-stamp-wrap { position: relative; flex: 0 0 auto; transform: rotate(6deg); }
    .occasion-stamp {
      font-family: var(--font-sans); font-size: 9px; font-weight: 800;
      letter-spacing: 0.15em; padding: 4px 8px; border-radius: 6px;
      color: var(--paper-accent); border: 1.5px solid var(--paper-line); text-transform: uppercase;
    }
    .occasion-seal-scratch {
      position: absolute; inset: -3px; z-index: 1; width: calc(100% + 6px); height: calc(100% + 6px);
      border-radius: 9px; cursor: crosshair; touch-action: none;
      transition: opacity 360ms ease, transform 360ms ease;
    }
    .occasion-seal-scratch.is-revealed { opacity: 0; transform: scale(1.08); pointer-events: none; }
    .occasion-scratch {
      position: absolute; inset: 0; width: 100%; height: 100%; z-index: 4;
      touch-action: none; cursor: grab; transition: opacity 0.6s ease;
    }
    .occasion-scratch.scratching { cursor: grabbing; }
    .occasion-scratch.revealed { opacity: 0; pointer-events: none; }
    .occasion-hint {
      position: absolute; z-index: 5; left: 50%; bottom: 18px; transform: translateX(-50%);
      display: flex; align-items: center; gap: 8px; padding: 7px 14px; border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.3); background: var(--hint-bg);
      font-family: var(--font-sans); font-size: 10.5px; font-weight: 800;
      letter-spacing: 0.1em; white-space: nowrap; color: #fff; pointer-events: none; transition: opacity 0.2s ease;
    }
    .occasion-shell.is-revealed .occasion-hint { opacity: 0; }
    .occasion-actions {
      display: none; align-items: center; justify-content: center; flex-wrap: wrap; gap: 8px;
      width: min(390px, 100%);
    }
    .occasion-overlay.is-card-revealed .occasion-actions { display: flex; }
    .occasion-action-btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      min-height: 40px; padding: 8px 14px; border-radius: 999px;
      border: 1.5px solid rgba(255, 255, 255, 0.32);
      background: rgba(42, 22, 38, 0.86); color: #fff;
      font-family: var(--font-sans); font-size: 12.5px; font-weight: 700;
      cursor: pointer; white-space: nowrap;
    }
    .occasion-action-btn--primary {
      background: linear-gradient(135deg, #ff4d88, #d9205f);
      border-color: rgba(255, 220, 234, 0.65);
    }
    .occasion-close-top {
      position: absolute; top: 12px; right: 12px; z-index: 8;
      width: 34px; height: 34px; display: grid; place-items: center;
      border-radius: 50%; border: 1px solid rgba(255, 255, 255, 0.38);
      background: rgba(28, 14, 26, 0.52); color: #fff; cursor: pointer;
    }
    .occasion-preview-button { position: fixed; right: 16px; bottom: calc(var(--safe-bottom, 0px) + 92px); z-index: 4500; width: 52px; height: 52px; border: 0; border-radius: 18px; background: linear-gradient(145deg, #ff7ca8, #9c5bda); color: #fff; box-shadow: 0 12px 30px rgba(118, 58, 126, 0.35); cursor: pointer; }
    .occasion-picker-overlay { position: fixed; inset: 0; z-index: 4900; display: flex; align-items: flex-end; justify-content: center; background: rgba(18, 12, 20, 0.58); backdrop-filter: blur(8px); }
    .occasion-picker { width: min(480px, 100%); max-height: calc(var(--app-viewport-height, 100vh) * 0.8); overflow: auto; padding: 18px 16px calc(var(--safe-bottom, 0px) + 20px); border-radius: 26px 26px 0 0; background: var(--surface-paper, #fff); }
    .occasion-picker-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .occasion-picker-item { border: 1px solid var(--border-subtle, rgba(0,0,0,0.1)); border-radius: 16px; padding: 13px; text-align: left; background: var(--bg-canvas, #fff); color: var(--text-primary, #222); cursor: pointer; }
    @keyframes occasionFade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes occasionRise { from { opacity: 0; transform: translateY(22px) scale(0.97); } to { opacity: 1; transform: none; } }
  `;
  document.head.appendChild(style);
}

function roundedPath(ctx: CanvasRenderingContext2D, width: number, height: number, radius: number): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(width, 0, width, height, r);
  ctx.arcTo(width, height, 0, height, r);
  ctx.arcTo(0, height, 0, 0, r);
  ctx.arcTo(0, 0, width, 0, r);
  ctx.closePath();
}

function roundedRectAt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.beginPath();
  ctx.moveTo(12, 21);
  ctx.bezierCurveTo(10, 18, 2, 13, 2, 7);
  ctx.bezierCurveTo(2, 2, 8, 0, 12, 5);
  ctx.bezierCurveTo(16, 0, 22, 2, 22, 7);
  ctx.bezierCurveTo(22, 13, 14, 18, 12, 21);
  ctx.fill();
  ctx.restore();
}

function hexToRgba(value: string, alpha: number): string {
  const hex = value.replace('#', '');
  const normalized = hex.length === 3 ? hex.split('').map((part) => part + part).join('') : hex;
  const number = Number.parseInt(normalized, 16);
  if (!Number.isFinite(number)) return `rgba(255, 255, 255, ${alpha})`;
  return `rgba(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255}, ${alpha})`;
}

function seeded(index: number): number {
  const value = Math.sin(index * 91.733 + 17.17) * 43758.5453;
  return value - Math.floor(value);
}

function drawPattern(ctx: CanvasRenderingContext2D, width: number, height: number, pattern: OccasionPattern): void {
  for (let index = 0; index < 42; index += 1) {
    const x = seeded(index * 3 + 1) * width;
    const y = seeded(index * 3 + 2) * height;
    const size = 7 + seeded(index * 3 + 3) * 16;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((seeded(index + 80) - 0.5) * 1.6);
    ctx.globalAlpha = 0.16 + seeded(index + 140) * 0.24;
    ctx.fillStyle = index % 2 ? '#fff' : 'rgba(255,244,214,.72)';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.8;
    if (pattern === 'hearts') drawHeart(ctx, 0, 0, size);
    else if (pattern === 'petals') {
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.34, size * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (pattern === 'confetti') {
      ctx.fillRect(-size * 0.15, -size * 0.55, size * 0.3, size * 1.1);
    } else if (pattern === 'lanterns') {
      roundedRectAt(ctx, -size * 0.36, -size * 0.45, size * 0.72, size * 0.9, size * 0.28);
      ctx.fill();
    } else if (pattern === 'stars') {
      ctx.beginPath();
      for (let point = 0; point < 10; point += 1) {
        const radius = point % 2 ? size * 0.28 : size * 0.62;
        const angle = -Math.PI / 2 + point * Math.PI / 5;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        if (point === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    } else if (pattern === 'snow') {
      for (let arm = 0; arm < 6; arm += 1) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.55);
        ctx.lineTo(0, size * 0.55);
        ctx.stroke();
      }
    } else if (pattern === 'ribbons') {
      ctx.beginPath();
      ctx.moveTo(-size, -size * 0.25);
      ctx.bezierCurveTo(-size * 0.35, -size, size * 0.35, size, size, size * 0.25);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(-size * 0.25, 0, size * 0.35, 0, Math.PI * 2);
      ctx.arc(size * 0.25, 0, size * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function wrapCanvasLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = text.split(/\n+/);
  const allLines: string[] = [];
  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(candidate).width > maxWidth) {
        allLines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) allLines.push(line);
  }
  return allLines;
}

function drawCoverOverlayCopy(ctx: CanvasRenderingContext2D, width: number, height: number, card: OccasionCard, hasPhotoCover: boolean): void {
  const copyTop = hasPhotoCover ? height * 0.62 : height / 2 - 14;
  const copyHeight = 112;
  ctx.save();
  roundedRectAt(ctx, width * 0.09, copyTop, width * 0.82, copyHeight, 22);
  const copyPlate = ctx.createLinearGradient(0, copyTop, 0, copyTop + copyHeight);
  copyPlate.addColorStop(0, 'rgba(26, 8, 28, 0.44)');
  copyPlate.addColorStop(1, 'rgba(26, 8, 28, 0.72)');
  ctx.fillStyle = copyPlate;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 245, 225, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 8;
  ctx.font = '700 16.5px "Be Vietnam Pro", system-ui, sans-serif';
  const lines = wrapCanvasLines(ctx, card.coverText, width * 0.72).slice(0, 2);
  const startY = copyTop + 42 - ((lines.length - 1) * 23) / 2;
  lines.forEach((line, i) => ctx.fillText(line, width / 2, startY + i * 23));
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.92;
  ctx.font = '800 10px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.fillText('✦ DÙNG TAY CÀO ĐỂ MỞ BÍ MẬT ✦', width / 2, copyTop + 88);
  ctx.restore();
}

function drawScratchCover(canvas: HTMLCanvasElement, card: OccasionCard): CanvasRenderingContext2D | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const gradient = ctx.createLinearGradient(0, 0, rect.width, rect.height);
  gradient.addColorStop(0, card.colors[0]);
  gradient.addColorStop(0.52, card.colors[1]);
  gradient.addColorStop(1, card.colors[2]);
  roundedPath(ctx, rect.width, rect.height, 30);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.save();
  roundedPath(ctx, rect.width, rect.height, 30);
  ctx.clip();
  drawPattern(ctx, rect.width, rect.height, card.pattern);
  ctx.strokeStyle = hexToRgba('#fff5cf', 0.48);
  ctx.lineWidth = 1.6;
  roundedRectAt(ctx, 14, 14, rect.width - 28, rect.height - 28, 22);
  ctx.stroke();
  ctx.restore();

  if (!card.scratchCoverUrl && card.id !== 'day-100') {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.arc(rect.width / 2, rect.height / 2 - 74, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    drawHeart(ctx, rect.width / 2 - 14, rect.height / 2 - 88, 28);
    ctx.restore();
  }

  drawCoverOverlayCopy(ctx, rect.width, rect.height, card, Boolean(card.scratchCoverUrl));

  const customCoverSrc = card.scratchCoverUrl || (card.id === 'day-100' ? card.coverImage : undefined);
  if (customCoverSrc) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const paintImage = () => {
      if (canvas.classList.contains('revealed')) return;
      ctx.save();
      roundedPath(ctx, rect.width, rect.height, 30);
      ctx.clip();
      const iw = img.naturalWidth || img.width || rect.width;
      const ih = img.naturalHeight || img.height || rect.height;
      const scale = Math.max(rect.width / iw, rect.height / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      ctx.drawImage(img, (rect.width - dw) / 2, (rect.height - dh) / 2, dw, dh);
      const scrim = ctx.createLinearGradient(0, 0, 0, rect.height);
      scrim.addColorStop(0, 'rgba(22, 8, 24, 0.12)');
      scrim.addColorStop(1, 'rgba(22, 8, 24, 0.42)');
      ctx.fillStyle = scrim;
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.strokeStyle = hexToRgba('#fff5cf', 0.55);
      ctx.lineWidth = 1.8;
      roundedRectAt(ctx, 14, 14, rect.width - 28, rect.height - 28, 22);
      ctx.stroke();
      ctx.restore();
      drawCoverOverlayCopy(ctx, rect.width, rect.height, card, true);
    };
    img.onload = paintImage;
    img.src = customCoverSrc;
  }

  return ctx;
}

export async function exportOccasionCardPng(card: OccasionCard): Promise<void> {
  const W = 1080;
  const H = 1480;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Paper background
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, '#fffdf9');
  bgGrad.addColorStop(0.5, '#fff1ec');
  bgGrad.addColorStop(1, hexToRgba(card.colors[0], 0.35));
  roundedPath(ctx, W, H, 68);
  ctx.fillStyle = bgGrad;
  ctx.fill();

  if (card.backgroundImageUrl) {
    try {
      const bgImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image();
        im.crossOrigin = 'anonymous';
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = card.backgroundImageUrl!;
      });
      ctx.save();
      roundedPath(ctx, W, H, 68);
      ctx.clip();
      const scale = Math.max(W / bgImg.naturalWidth, H / bgImg.naturalHeight);
      const dw = bgImg.naturalWidth * scale;
      const dh = bgImg.naturalHeight * scale;
      ctx.drawImage(bgImg, (W - dw) / 2, (H - dh) / 2, dw, dh);
      ctx.restore();
    } catch {
      // Fallback cleanly to artistic gradient paper if image blocks CORS readback
    }
  }

  // Frosted reading panel
  ctx.save();
  roundedRectAt(ctx, 68, 84, W - 136, H - 168, 52);
  ctx.fillStyle = 'rgba(255, 251, 253, 0.88)';
  ctx.fill();
  ctx.strokeStyle = hexToRgba(card.colors[2], 0.34);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  // Heart crest
  ctx.save();
  ctx.fillStyle = card.colors[1];
  drawHeart(ctx, W / 2 - 36, 170, 72);
  ctx.restore();

  // Eyebrow
  ctx.fillStyle = card.colors[1];
  ctx.textAlign = 'center';
  ctx.font = '800 28px "Be Vietnam Pro", sans-serif';
  ctx.fillText(`◆ ${card.eyebrow.toUpperCase()} ◆`, W / 2, 320);

  // Title
  ctx.fillStyle = card.colors[2];
  ctx.font = '700 62px "Fraunces", Georgia, serif';
  const titleLines = wrapCanvasLines(ctx, card.title, W - 240).slice(0, 2);
  titleLines.forEach((line, idx) => {
    ctx.fillText(line, W / 2, 415 + idx * 74);
  });

  // Divider
  const divY = 425 + titleLines.length * 74;
  ctx.strokeStyle = hexToRgba(card.colors[1], 0.45);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 160, divY);
  ctx.lineTo(W / 2 + 160, divY);
  ctx.stroke();

  // Message
  ctx.fillStyle = '#3d2634';
  ctx.font = '500 42px "Fraunces", Georgia, serif';
  const msgLines = wrapCanvasLines(ctx, card.message, W - 250).slice(0, 11);
  msgLines.forEach((line, idx) => {
    ctx.fillText(line, W / 2, divY + 86 + idx * 66);
  });

  // Signature + Love Seal
  ctx.textAlign = 'left';
  ctx.fillStyle = card.colors[1];
  ctx.font = 'italic 600 44px "Fraunces", Georgia, serif';
  const sigLines = wrapCanvasLines(ctx, card.signature, W - 460).slice(0, 2);
  sigLines.forEach((line, idx) => {
    ctx.fillText(line, 136, H - 210 + idx * 54);
  });

  ctx.save();
  ctx.translate(W - 240, H - 185);
  ctx.rotate(0.09);
  roundedRectAt(ctx, -95, -34, 190, 68, 16);
  ctx.strokeStyle = hexToRgba(card.colors[1], 0.65);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = card.colors[1];
  ctx.font = '800 24px "Be Vietnam Pro", sans-serif';
  ctx.fillText('LOVE SEAL', 0, 9);
  ctx.restore();

  const fileName = `thiep-ky-niem-${card.id}.png`;
  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  showToast('Đã lưu ảnh tấm thiệp kỷ niệm!', 'success');
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[ch] || ch);
}

function createGridScratchTracker(cols = 22, rows = 30) {
  const grid = new Uint8Array(cols * rows);
  let clearedCount = 0;

  return {
    markStroke(
      from: { x: number; y: number },
      to: { x: number; y: number },
      width: number,
      height: number,
      brushRadius = 24,
    ): number {
      if (width <= 0 || height <= 0) return 0;
      const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 8));
      for (let s = 0; s <= steps; s += 1) {
        const px = from.x + ((to.x - from.x) * s) / steps;
        const py = from.y + ((to.y - from.y) * s) / steps;
        const minC = Math.max(0, Math.floor(((px - brushRadius) / width) * cols));
        const maxC = Math.min(cols - 1, Math.floor(((px + brushRadius) / width) * cols));
        const minR = Math.max(0, Math.floor(((py - brushRadius) / height) * rows));
        const maxR = Math.min(rows - 1, Math.floor(((py + brushRadius) / height) * rows));
        for (let r = minR; r <= maxR; r += 1) {
          for (let c = minC; c <= maxC; c += 1) {
            const idx = r * cols + c;
            if (grid[idx] === 0) {
              grid[idx] = 1;
              clearedCount += 1;
            }
          }
        }
      }
      return clearedCount / (cols * rows);
    },
  };
}

export function openOccasionCardModal(card: OccasionCard, options: OpenOccasionCardOptions = {}): void {
  if (document.querySelector('.polaroid-modal-backdrop')) {
    const openAfterPhotoCloses = () => {
      if (document.querySelector('.polaroid-modal-backdrop')) return;
      openOccasionCardModal(card, options);
    };
    window.addEventListener(SPECIAL_MODAL_CLOSED_EVENT, openAfterPhotoCloses, { once: true });
    return;
  }

  ensureStyles();
  document.querySelector('.occasion-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = `occasion-overlay${options.skipScratch ? ' is-card-revealed' : ''}`;
  const hasCustomBg = Boolean(card.backgroundImageUrl);

  overlay.innerHTML = `
    <section class="occasion-shell${options.skipScratch ? ' is-revealed' : ''}" role="dialog" aria-modal="true" aria-label="${escapeHtml(card.title)}" style="--occasion-a:${card.colors[0]};--occasion-b:${card.colors[1]}">
      <button type="button" class="occasion-close-top" aria-label="Đóng thiệp">&times;</button>
      <article class="occasion-paper${hasCustomBg ? ' has-custom-bg' : ''}" data-pattern="${card.pattern}" data-card-id="${escapeHtml(String(card.id))}">
        ${hasCustomBg ? `<div class="occasion-custom-bg" style="background-image:url('${escapeHtml(card.backgroundImageUrl!)}')"></div>` : ''}
        <div class="occasion-border-frame"></div>
        <div class="occasion-corner top-left">✦</div>
        <div class="occasion-corner top-right">✦</div>
        <div class="occasion-corner bottom-left">✦</div>
        <div class="occasion-corner bottom-right">✦</div>
        <div class="occasion-inner">
          <div class="occasion-art-wrap">
            ${OCCASION_ART_SVG}
          </div>
          <div class="occasion-eyebrow"><span>◆ ${escapeHtml(card.eyebrow)} ◆</span></div>
          <h2 class="occasion-title">${escapeHtml(card.title)}</h2>
          <div class="occasion-divider">
            <span class="divider-line"></span>
            <span class="divider-heart">♥</span>
            <span class="divider-line"></span>
          </div>
          <p class="occasion-message">${escapeHtml(card.message)}</p>
          <div class="occasion-signature-wrap">
            <p class="occasion-signature">${escapeHtml(card.signature)}</p>
            <div class="occasion-stamp-wrap">
              <div class="occasion-stamp">LOVE SEAL</div>
            </div>
          </div>
        </div>
      </article>
      <canvas class="occasion-scratch${options.skipScratch ? ' revealed' : ''}" aria-label="Lớp phủ cào để mở thiệp"></canvas>
      <div class="occasion-hint">
        <span>Cào để mở bí mật</span>
      </div>
    </section>
    <div class="occasion-actions">
      <button type="button" class="occasion-action-btn" data-card-action="download">
        ${iconMarkup('download', { size: 16 })}<span>Lưu ảnh kỷ niệm</span>
      </button>
      ${options.isDraftPreview ? '' : `
        <button type="button" class="occasion-action-btn occasion-action-btn--primary" data-card-action="reply">
          ${iconMarkup('send', { size: 16 })}<span>Nhắn lời thương</span>
        </button>
      `}
      ${options.skipScratch ? `
        <button type="button" class="occasion-action-btn" data-card-action="rescratch">
          ${iconMarkup('scratch-card', { size: 16 })}<span>Cào lại</span>
        </button>
      ` : ''}
    </div>
  `;

  document.body.appendChild(overlay);

  const shell = overlay.querySelector<HTMLElement>('.occasion-shell');
  const canvas = overlay.querySelector<HTMLCanvasElement>('.occasion-scratch');
  let cleanup = () => {};
  let initFrame: number | null = null;
  let closed = false;

  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') close();
  };
  const close = () => {
    if (closed) return;
    closed = true;
    if (initFrame !== null) cancelAnimationFrame(initFrame);
    cleanup();
    window.removeEventListener('keydown', onKey);
    overlay.remove();
    window.dispatchEvent(new Event(SPECIAL_MODAL_CLOSED_EVENT));
  };

  overlay.querySelector('.occasion-close-top')?.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  window.addEventListener('keydown', onKey);

  overlay.querySelector('[data-card-action="download"]')?.addEventListener('click', () => {
    triggerHaptic('tap');
    void exportOccasionCardPng(card);
  });
  overlay.querySelector('[data-card-action="reply"]')?.addEventListener('click', () => {
    triggerHaptic('tap');
    close();
    navigate('/app/messages');
  });
  overlay.querySelector('[data-card-action="rescratch"]')?.addEventListener('click', () => {
    triggerHaptic('tap');
    close();
    openOccasionCardModal(card, { ...options, skipScratch: false });
  });

  if (!canvas || !shell) {
    close();
    return;
  }

  if (options.skipScratch) {
    return;
  }

  let ctx: CanvasRenderingContext2D | null = null;
  let drawing = false;
  let lastPoint: { x: number; y: number } | null = null;
  let revealed = false;
  const tracker = createGridScratchTracker();

  const initializeScratch = (attempt = 0): void => {
    if (closed || revealed || ctx) return;
    const nextContext = drawScratchCover(canvas, card);
    if (nextContext) {
      ctx = nextContext;
      return;
    }
    if (attempt >= 10) {
      close();
      showToast('Thiệp chưa tải xong, bạn thử lại nhé.', 'error');
      return;
    }
    initFrame = requestAnimationFrame(() => initializeScratch(attempt + 1));
  };

  const reveal = () => {
    if (revealed) return;
    revealed = true;
    triggerHaptic('confirm');
    canvas.classList.add('revealed');
    shell.classList.add('is-revealed');
    overlay.classList.add('is-card-revealed');
    try {
      options.onRevealed?.();
    } catch (error) {
      console.warn('[Occasion card] Could not persist seen state', error);
    }
  };

  const point = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const scratch = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    if (!ctx || revealed) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 44;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();

    const ratio = tracker.markStroke(from, to, rect.width, rect.height, 24);
    if (ratio >= SCRATCH_THRESHOLD) {
      reveal();
    }
  };

  canvas.addEventListener('pointerdown', (event) => {
    drawing = true;
    canvas.classList.add('scratching');
    lastPoint = point(event);
    canvas.setPointerCapture?.(event.pointerId);
    scratch(lastPoint, lastPoint);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drawing || !lastPoint) return;
    const next = point(event);
    scratch(lastPoint, next);
    lastPoint = next;
  });
  const stop = (event: PointerEvent) => {
    if (!drawing) return;
    drawing = false;
    canvas.classList.remove('scratching');
    lastPoint = null;
    try { canvas.releasePointerCapture?.(event.pointerId); } catch {}
  };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);

  const resize = () => {
    if (revealed) return;
    const nextContext = drawScratchCover(canvas, card);
    if (nextContext) ctx = nextContext;
  };
  window.addEventListener('resize', resize, { passive: true });
  const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(shell);

  cleanup = () => {
    window.removeEventListener('resize', resize);
    resizeObserver?.disconnect();
  };

  initializeScratch();
}

function seenKey(occasionKey: string, dateKey: string, userId: string): string {
  return `${SEEN_PREFIX}${userId}:${dateKey}:${occasionKey}`;
}

function hasSeenCard(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function markCardSeen(key: string): void {
  try {
    localStorage.setItem(key, '1');
  } catch {}
}

function isPreviewEnabled(): boolean {
  return new URLSearchParams(window.location.search).get(PREVIEW_QUERY) === '1';
}

function mountPreviewButton(getLatestMe: () => MeResponse | undefined): void {
  if (!isPreviewEnabled() || document.querySelector('.occasion-preview-button')) return;
  ensureStyles();
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'occasion-preview-button';
  button.innerHTML = iconMarkup('scratch-card', { size: 24, variant: 'filled' });
  button.setAttribute('aria-label', 'Xem demo thiệp kỷ niệm');
  button.title = 'Xem demo thiệp kỷ niệm';
  button.addEventListener('click', () => openPreviewPicker(getLatestMe()));
  document.body.appendChild(button);
}

function openPreviewPicker(me?: MeResponse): void {
  ensureStyles();
  document.querySelector('.occasion-picker-overlay')?.remove();
  const context = previewContext(me);
  const overlay = document.createElement('div');
  overlay.className = 'occasion-picker-overlay';
  overlay.innerHTML = `
    <section class="occasion-picker" role="dialog" aria-modal="true" aria-label="Demo thiệp cào">
      <h3>Demo thiệp cào</h3>
      <p>Chọn một dịp để kiểm thử nhanh.</p>
      <div class="occasion-picker-grid">
        ${PREVIEW_ORDER.map((id) => {
          const card = buildBuiltinOccasionCard(id, context);
          return `<button type="button" class="occasion-picker-item" data-card-id="${id}"><span style="color:var(--accent-600);">${iconMarkup(card.icon, { size: 24, variant: 'filled' })}</span><strong>${escapeHtml(card.title)}</strong></button>`;
        }).join('')}
      </div>
    </section>
  `;
  document.body.appendChild(overlay);
  overlay.querySelectorAll<HTMLButtonElement>('[data-card-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.cardId as BuiltinOccasionKey;
      overlay.remove();
      openOccasionCardModal(buildBuiltinOccasionCard(id, context), { isDraftPreview: true });
    });
  });
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) overlay.remove();
  });
}

export function needsBirthdaySetup(me: Pick<MeResponse, 'user' | 'partnerUser'>): boolean {
  return !me.user.birthday || !(me.user.partnerBirthday || me.partnerUser?.birthday);
}

function isOnboardingRoute(): boolean {
  return ['/onboarding', '/login', '/app/onboarding', '/app/google-onboarding']
    .includes(window.location.pathname);
}

function hasSpecialModal(): boolean {
  return Boolean(document.querySelector('.polaroid-modal-backdrop, .occasion-overlay, .occasion-picker-overlay'));
}

function notifyMissingBirthday(me: MeResponse): void {
  if (!needsBirthdaySetup(me)) return;
  const pathname = window.location.pathname;
  if (pathname.includes('/onboarding') || pathname.includes('/login')) return;

  const key = `${BIRTHDAY_NOTICE_PREFIX}${me.user.id}`;
  if (birthdayNoticeSession.has(key)) return;

  try {
    if (sessionStorage.getItem(key) === '1') {
      birthdayNoticeSession.add(key);
      return;
    }
    sessionStorage.setItem(key, '1');
  } catch {}

  birthdayNoticeSession.add(key);
  window.setTimeout(() => {
    showToast('Bạn chưa thiết lập đủ ngày sinh nhật. Vào Hồ sơ để bổ sung nhé 🎂', 'info');
  }, 700);
}

declare global {
  interface Window {
    LoveCheckCards?: {
      open: (id: OccasionCardId) => void;
      list: () => OccasionCardId[];
    };
  }
}

export function initAnniversaryCards(): void {
  let latestMe: MeResponse | undefined;
  let checking = false;
  let checkedSessionKey: string | null = null;
  let scheduledCardKey: string | null = null;

  const checkToday = async (force = false) => {
    const token = store.getToken();
    const todayKey = toDateKey(getCalendarDate(new Date()));
    const sessionKey = token ? `${token}:${todayKey}` : null;
    if (!token || checking || (!force && checkedSessionKey === sessionKey)) return;
    checking = true;
    try {
      latestMe = await getMe({ preserveSessionOnUnauthorized: true });
      if (isOnboardingRoute()) return;
      checkedSessionKey = sessionKey;
      notifyMissingBirthday(latestMe);

      let card: OccasionCard | null = null;
      let occasionKey = '';
      let alreadyRevealed = false;

      try {
        const serverToday = await getTodayOccasionCard();
        if (serverToday.card) {
          card = toOccasionCardFromServer(serverToday.card);
          occasionKey = serverToday.card.occasionKey;
          alreadyRevealed = serverToday.alreadyRevealed;
        }
      } catch {
        card = resolveOccasionCard(latestMe);
        occasionKey = String(card?.occasionKey ?? card?.id ?? '');
      }

      if (!card || !occasionKey) return;
      const localKey = seenKey(occasionKey, todayKey, latestMe.user.id);
      if (alreadyRevealed) {
        markCardSeen(localKey);
        return;
      }
      if (hasSeenCard(localKey) || scheduledCardKey === localKey || hasSpecialModal()) return;
      scheduledCardKey = localKey;
      const cardToOpen = card;
      window.setTimeout(() => {
        scheduledCardKey = null;
        if (hasSeenCard(localKey) || hasSpecialModal()) return;
        openOccasionCardModal(cardToOpen, {
          onRevealed: () => {
            markCardSeen(localKey);
            void markOccasionCardRevealed(occasionKey).catch(() => {});
          },
        });
      }, 350);
    } catch {
      // Occasion cards are a non-blocking enhancement.
    } finally {
      checking = false;
      mountPreviewButton(() => latestMe);
    }
  };

  store.subscribe((state, previous) => {
    if (state.token && state.token !== previous.token) void checkToday(true);
  });
  window.addEventListener('popstate', () => void checkToday());
  window.addEventListener('focus', () => void checkToday(true));
  window.addEventListener('pageshow', () => void checkToday(true));
  window.addEventListener(SPECIAL_MODAL_CLOSED_EVENT, () => void checkToday(true));

  window.LoveCheckCards = {
    open: (id) => {
      const key = (OCCASION_CATALOG.find((c) => c.key === id)?.key ?? 'day-100') as BuiltinOccasionKey;
      openOccasionCardModal(buildBuiltinOccasionCard(key, previewContext(latestMe)), { isDraftPreview: true });
    },
    list: () => [...PREVIEW_ORDER],
  };

  mountPreviewButton(() => latestMe);
  void checkToday();
}
