import { getMe, type MeResponse } from '../api/auth';
import { updateProfile } from '../api/profile';
import { store } from '../store/index';
import { showToast } from '../components/toast';

const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';
const SEEN_PREFIX = 'lovecheck:occasion-card:seen:v1:';
const PREVIEW_QUERY = 'cardPreview';
const SCRATCH_THRESHOLD = 0.88;
let birthdaySettingsLoading = false;

export type OccasionCardId =
  | 'day-100'
  | 'day-500'
  | 'day-1000'
  | 'anniversary'
  | 'birthday'
  | 'new-year'
  | 'valentine'
  | 'womens-day'
  | 'childrens-day'
  | 'vietnamese-womens-day'
  | 'christmas';

type Pattern = 'hearts' | 'petals' | 'confetti' | 'stars' | 'snow' | 'ribbons' | 'candy';

interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

interface OccasionContext {
  today: CalendarDate;
  dateKey: string;
  daysTogether: number;
  yearsTogether: number;
  displayName: string;
  partnerName: string;
  partnerAge?: number;
}

export interface OccasionCard {
  id: OccasionCardId;
  title: string;
  eyebrow: string;
  message: string;
  signature: string;
  coverText: string;
  icon: string;
  pattern: Pattern;
  colors: [string, string, string];
  coverImage?: string;
}

interface CardDefinition {
  id: OccasionCardId;
  title: (context: OccasionContext) => string;
  eyebrow: (context: OccasionContext) => string;
  message: (context: OccasionContext) => string;
  signature: (context: OccasionContext) => string;
  coverText: string;
  icon: string;
  pattern: Pattern;
  colors: [string, string, string];
  coverImage?: string;
}

const CARD_DEFINITIONS: Record<OccasionCardId, CardDefinition> = {
  'day-100': {
    id: 'day-100',
    title: () => '100 ngày của anh và em',
    eyebrow: () => 'Một cột mốc nhỏ xinh',
    message: () =>
      'Vậy là anh với em đã đi cùng nhau được 100 ngày rồi. Chưa phải thật lâu, nhưng đủ để anh thấy có em trong những ngày bình thường là một điều rất dễ thương. Mình cứ chậm rãi bên nhau như thế nhé.',
    signature: () => 'Thương em, từ anh.',
    coverText: 'Cào nhẹ để mở 100 ngày đầu tiên của hai đứa',
    icon: '💯',
    pattern: 'hearts',
    colors: ['#ff8fb1', '#ff5f8f', '#9f3564'],
    coverImage: '/design/100day.png',
  },
  'day-500': {
    id: 'day-500',
    title: () => '500 ngày có nhau',
    eyebrow: () => 'Mình đi được khá xa rồi đấy',
    message: () =>
      '500 ngày nghe cũng nhiều thật đấy. Cảm ơn em vì vẫn ở đây, cùng anh đi qua cả những ngày vui lẫn mấy hôm chẳng vui lắm. Anh vẫn muốn những ngày sau này có em.',
    signature: () => 'Anh vẫn chọn em.',
    coverText: 'Mở xem điều anh muốn nhắn ở ngày 500',
    icon: '🎀',
    pattern: 'ribbons',
    colors: ['#d7a8ff', '#9c66db', '#5b338d'],
    coverImage: '/design/500-1day.webp',
  },
  'day-1000': {
    id: 'day-1000',
    title: () => '1.000 ngày rồi em ạ',
    eyebrow: () => 'Một nghìn ngày, rất nhiều chuyện để nhớ',
    message: () =>
      'Mình đã có một đoạn đường đủ dài để nhớ, và anh vẫn mong phía trước còn thật nhiều ngày để hai đứa cùng kể tiếp. Cảm ơn em vì đã là một phần rất quan trọng trong những ngày của anh.',
    signature: () => 'Còn nhiều ngày nữa nhé em.',
    coverText: 'Chạm cào ngàn ngày bên nhau em nhé',
    icon: '✨',
    pattern: 'stars',
    colors: ['#72d7ff', '#5d7df3', '#35408d'],
  },
  anniversary: {
    id: 'anniversary',
    title: (context) => `${context.yearsTogether} năm bên nhau`,
    eyebrow: () => 'Ngày mình bắt đầu',
    message: () =>
      'Thêm một năm anh với em ở cạnh nhau. Anh không hứa lúc nào cũng hoàn hảo, chỉ mong mình vẫn chọn nói chuyện, chọn hiểu nhau và chọn ở lại. Chúc cho hai đứa mình có thêm thật nhiều ngày kỷ niệm như hôm nay.',
    signature: () => 'Mừng ngày của chúng mình.',
    coverText: 'Cào mở ngày kỷ niệm của hai đứa mình',
    icon: '💍',
    pattern: 'petals',
    colors: ['#f6c86f', '#e9965b', '#9b5a42'],
  },
  birthday: {
    id: 'birthday',
    title: (context) =>
      context.partnerAge ? `Chúc mừng tuổi ${context.partnerAge}, em nhé` : 'Chúc mừng sinh nhật em',
    eyebrow: () => 'Hôm nay là ngày của em',
    message: () =>
      'Tuổi mới cứ vui hơn một chút, nhẹ lòng hơn một chút và được yêu nhiều thật nhiều. Anh sẽ cố góp phần vào mấy điều đó. Cứ là em như bây giờ nhé, vì anh thương phiên bản ấy lắm.',
    signature: () => 'Sinh nhật vui vẻ, em bé của anh.',
    coverText: 'Món quà nhỏ mừng ngày em ra đời',
    icon: '🎂',
    pattern: 'confetti',
    colors: ['#ffd66e', '#ff9c64', '#d94b78'],
  },
  'new-year': {
    id: 'new-year',
    title: () => 'Năm mới, vẫn là anh và em',
    eyebrow: () => 'Ngày đầu tiên của một năm mới',
    message: () =>
      'Mong anh với em vẫn là một đội: vui thì cùng cười, mệt thì dựa vào nhau, có chuyện gì cũng đừng buông tay quá nhanh. Chúc hai đứa mình một năm bình yên, nhiều niềm vui và nhiều lần được gặp nhau.',
    signature: () => 'Năm mới vẫn thương em.',
    coverText: 'Cào lấy may và thương nhau cả năm mới',
    icon: '🎆',
    pattern: 'stars',
    colors: ['#ffcf56', '#ed6a4a', '#8f263d'],
  },
  valentine: {
    id: 'valentine',
    title: () => 'Valentine vui vẻ nhé em',
    eyebrow: () => '14 tháng 2',
    message: () =>
      'Anh không giỏi nói lời hoa mỹ, nhưng chuyện anh thương em thì là thật. Hôm nay và cả những ngày không phải lễ, anh vẫn mong em luôn cảm thấy mình được yêu và được trân trọng.',
    signature: () => 'Người yêu em.',
    coverText: 'Một chiếc thư Valentine bí mật dành riêng em',
    icon: '💌',
    pattern: 'hearts',
    colors: ['#ff839d', '#e43d68', '#8a2148'],
  },
  'womens-day': {
    id: 'womens-day',
    title: () => '8/3 vui vẻ nhé em',
    eyebrow: () => 'Ngày Quốc tế Phụ nữ',
    message: () =>
      'Hôm nay em cứ việc xinh, vui và được chiều. Còn những ngày bình thường, anh cũng sẽ nhớ thương em tử tế. Mong em luôn tự tin, thoải mái và làm những điều khiến mình hạnh phúc.',
    signature: () => 'Một bông hoa của riêng anh.',
    coverText: 'Một bông hoa nhỏ dành tặng em ngày 8/3',
    icon: '🌷',
    pattern: 'petals',
    colors: ['#ffb7cf', '#ef73aa', '#8e416d'],
  },
  'childrens-day': {
    id: 'childrens-day',
    title: () => '1/6 vui vẻ, em bé',
    eyebrow: () => 'Người lớn vẫn được nhận quà',
    message: () =>
      'Người lớn rồi vẫn được quyền nhõng nhẽo, thích quà và cười vì mấy chuyện bé xíu. Với anh, em vẫn là em bé. Hôm nay cứ vui thật nhiều và đừng ngại đòi anh chiều nhé.',
    signature: () => 'Anh của em bé.',
    coverText: 'Em bé cào quà nào',
    icon: '🍭',
    pattern: 'candy',
    colors: ['#75e5dc', '#75aef5', '#7657c6'],
  },
  'vietnamese-womens-day': {
    id: 'vietnamese-womens-day',
    title: () => '20/10 vui vẻ nhé em',
    eyebrow: () => 'Ngày Phụ nữ Việt Nam',
    message: () =>
      'Cảm ơn em vì đã xuất hiện và làm những ngày của anh có thêm nhiều điều để mong. Mong em luôn được yêu thương đúng cách, được lắng nghe và được là chính mình.',
    signature: () => 'Thương em nhiều.',
    coverText: 'Lời thương gửi người phụ nữ anh yêu nhất',
    icon: '🌸',
    pattern: 'petals',
    colors: ['#f3a8c8', '#d76da8', '#7f416f'],
  },
  christmas: {
    id: 'christmas',
    title: () => 'Giáng sinh ấm áp nhé em',
    eyebrow: () => 'Merry Christmas',
    message: () =>
      'Giáng sinh này anh không cần điều ước gì cầu kỳ. Chỉ mong anh với em vẫn có nhau, ấm áp và bình yên. Trời có lạnh thì nhớ ở gần anh thêm một chút nhé.',
    signature: () => 'Quà Noel của anh là em.',
    coverText: 'Cào lớp tuyết lạnh để nhận hơi ấm Noel',
    icon: '🎄',
    pattern: 'snow',
    colors: ['#9be3d2', '#3aa58f', '#1d5e58'],
  },
};

const PREVIEW_ORDER: OccasionCardId[] = [
  'day-100',
  'anniversary',
  'day-500',
  'day-1000',
  'birthday',
  'valentine',
  'womens-day',
  'childrens-day',
  'vietnamese-womens-day',
  'christmas',
  'new-year',
];

function getCalendarDate(value: Date | string, timeZone = VIETNAM_TIMEZONE): CalendarDate {
  const date = value instanceof Date ? value : new Date(value);
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
  return left.month === right.month && left.day === right.day;
}

function createContext(me: MeResponse, now = new Date()): OccasionContext {
  const today = getCalendarDate(now);
  const start = me.couple.loveStartDate ? getCalendarDate(me.couple.loveStartDate) : undefined;
  const birthday = me.user.partnerBirthday || me.partnerUser?.birthday;
  return {
    today,
    dateKey: toDateKey(today),
    daysTogether: start ? Math.max(0, dayDifference(start, today)) : 0,
    yearsTogether: start && isSameDay(start, today) ? Math.max(0, today.year - start.year) : 0,
    displayName: me.user.displayName || 'anh',
    partnerName: me.user.partnerName || me.partnerUser?.displayName || 'em',
    partnerAge: calculateAge(birthday, today),
  };
}

function buildCard(id: OccasionCardId, context: OccasionContext): OccasionCard {
  const definition = CARD_DEFINITIONS[id];
  return {
    id,
    title: definition.title(context),
    eyebrow: definition.eyebrow(context),
    message: definition.message(context),
    signature: definition.signature(context),
    coverText: definition.coverText,
    icon: definition.icon,
    pattern: definition.pattern,
    colors: definition.colors,
    coverImage: definition.coverImage,
  };
}

export function resolveOccasionCard(me: MeResponse, now = new Date()): OccasionCard | null {
  const context = createContext(me, now);
  const birthday = me.user.partnerBirthday || me.partnerUser?.birthday;
  if (birthday && isSameDay(getCalendarDate(birthday), context.today)) return buildCard('birthday', context);

  if (context.daysTogether === 100) return buildCard('day-100', context);
  if (context.daysTogether === 500) return buildCard('day-500', context);
  if (context.daysTogether === 1000) return buildCard('day-1000', context);
  if (context.yearsTogether >= 1) return buildCard('anniversary', context);

  const fixed: Array<[number, number, OccasionCardId]> = [
    [1, 1, 'new-year'],
    [2, 14, 'valentine'],
    [3, 8, 'womens-day'],
    [6, 1, 'childrens-day'],
    [10, 20, 'vietnamese-womens-day'],
    [12, 24, 'christmas'],
  ];
  const match = fixed.find(([month, day]) => context.today.month === month && context.today.day === day);
  return match ? buildCard(match[2], context) : null;
}

function previewContext(me?: MeResponse): OccasionContext {
  if (me) return createContext(me);
  const today = getCalendarDate(new Date());
  return {
    today,
    dateKey: toDateKey(today),
    daysTogether: 100,
    yearsTogether: 1,
    displayName: 'anh',
    partnerName: 'em',
    partnerAge: 20,
  };
}

function ensureStyles(): void {
  if (document.getElementById('occasion-card-styles')) return;
  const style = document.createElement('style');
  style.id = 'occasion-card-styles';
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,600&family=Dancing+Script:wght@700&family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=Plus+Jakarta+Sans:wght@700;800&display=swap');

    .occasion-overlay {
      position: fixed; inset: 0; z-index: 5000;
      display: flex; align-items: center; justify-content: center;
      padding: 16px; background: rgba(14, 8, 16, 0.78);
      backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      animation: occasionFade 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    .occasion-shell {
      position: relative; width: min(390px, 100%);
      max-height: calc(100dvh - 32px); overflow: auto;
      border-radius: 30px;
      box-shadow: 0 30px 100px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.15);
      background: #1a101b; animation: occasionRise 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    .occasion-close {
      position: absolute; top: 14px; right: 14px; z-index: 8;
      width: 36px; height: 36px; border: 0; border-radius: 999px;
      background: rgba(255, 255, 255, 0.92); color: #3e2233;
      font-size: 20px; font-weight: 700; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
      cursor: pointer; transition: transform 0.2s ease, background 0.2s ease;
    }
    .occasion-close:active { transform: scale(0.92); }

    /* Revealed Card Paper Background */
    .occasion-paper {
      position: relative; min-height: 540px; padding: 60px 28px 36px;
      overflow: hidden; border-radius: 30px;
      background: radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.98), rgba(255, 248, 242, 0.96) 55%, #f6e3db 100%),
                  linear-gradient(145deg, #fffcf8 0%, #fff0e6 48%, #f4ded5 100%);
      color: #3b2533;
      box-shadow: inset 0 0 0 1px rgba(212, 175, 55, 0.42),
                  inset 0 0 0 6px rgba(255, 255, 255, 0.85),
                  inset 0 0 0 8px rgba(212, 175, 55, 0.32);
    }
    .occasion-border-frame {
      position: absolute; inset: 12px; pointer-events: none;
      border: 1px solid rgba(195, 145, 60, 0.35); border-radius: 22px;
    }
    .occasion-corner {
      position: absolute; z-index: 2; font-size: 11px; color: rgba(195, 145, 60, 0.65);
      pointer-events: none; line-height: 1;
    }
    .occasion-corner.top-left { top: 16px; left: 16px; }
    .occasion-corner.top-right { top: 16px; right: 16px; }
    .occasion-corner.bottom-left { bottom: 16px; left: 16px; }
    .occasion-corner.bottom-right { bottom: 16px; right: 16px; }

    .occasion-inner { position: relative; z-index: 2; text-align: center; }
    .occasion-icon-wrap {
      display: inline-flex; align-items: center; justify-content: center;
      width: 66px; height: 66px; margin-bottom: 12px; border-radius: 999px;
      background: radial-gradient(circle, rgba(255, 255, 255, 0.92), rgba(255, 240, 245, 0.6));
      box-shadow: 0 10px 24px rgba(160, 70, 110, 0.15), inset 0 0 0 1px rgba(255, 255, 255, 0.9);
    }
    .occasion-icon { font-size: 38px; filter: drop-shadow(0 4px 8px rgba(80, 20, 50, 0.18)); }
    .occasion-eyebrow {
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      font-size: 11px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase;
      color: var(--occasion-b, #b35279); margin-bottom: 8px; opacity: 0.9;
    }
    .occasion-title {
      font-family: 'Playfair Display', 'Cormorant Garamond', Georgia, serif;
      font-size: 27px; font-weight: 700; line-height: 1.25; color: #5a223f;
      margin: 0 0 16px; text-shadow: 0 2px 4px rgba(140, 40, 80, 0.08);
    }
    .occasion-divider {
      display: flex; align-items: center; justify-content: center; gap: 12px;
      width: 140px; margin: 0 auto 18px;
    }
    .divider-line { flex: 1; height: 1px; background: linear-gradient(90deg, transparent, var(--occasion-b, #c47192), transparent); }
    .divider-heart { font-size: 12px; color: var(--occasion-b, #c47192); opacity: 0.8; }
    .occasion-message {
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-size: 19.5px; font-weight: 600; line-height: 1.72; color: #3e2634; margin: 0;
      letter-spacing: 0.01em;
    }
    .occasion-signature-wrap {
      margin-top: 26px; display: flex; align-items: center; justify-content: space-between;
      padding-top: 14px; border-top: 1px dashed rgba(180, 120, 145, 0.28);
    }
    .occasion-signature {
      font-family: 'Dancing Script', cursive; font-size: 23px; font-weight: 700;
      color: var(--occasion-b, #933860); margin: 0; transform: rotate(-3deg);
    }
    .occasion-stamp {
      font-family: 'Plus Jakarta Sans', sans-serif; font-size: 9px; font-weight: 800;
      letter-spacing: 0.15em; color: rgba(160, 80, 110, 0.5);
      border: 1.5px solid rgba(160, 80, 110, 0.35); padding: 4px 8px; border-radius: 6px;
      transform: rotate(6deg); text-transform: uppercase;
    }

    .occasion-scratch {
      position: absolute; inset: 0; width: 100%; height: 100%; z-index: 4;
      touch-action: none; cursor: grab; transition: opacity 0.65s ease;
    }
    .occasion-scratch.scratching { cursor: grabbing; }
    .occasion-scratch.revealed { opacity: 0; pointer-events: none; }
    .occasion-hint {
      position: absolute; z-index: 5; left: 50%; bottom: 20px; transform: translateX(-50%);
      padding: 9px 16px; border-radius: 999px;
      background: rgba(255, 255, 255, 0.92); backdrop-filter: blur(8px);
      box-shadow: 0 10px 28px rgba(35, 12, 25, 0.22);
      font-family: 'Plus Jakarta Sans', sans-serif; font-size: 10.5px; font-weight: 800;
      letter-spacing: 0.12em; color: #4e293a; pointer-events: none; transition: opacity 0.2s ease;
    }
    .occasion-shell.is-revealed .occasion-hint { opacity: 0; }

    .occasion-preview-button { position: fixed; right: 16px; bottom: calc(var(--safe-bottom, 0px) + 92px); z-index: 4500; width: 52px; height: 52px; border: 0; border-radius: 18px; background: linear-gradient(145deg, #ff7ca8, #9c5bda); color: #fff; font-size: 24px; box-shadow: 0 12px 30px rgba(118, 58, 126, 0.35); cursor: pointer; }
    .occasion-picker-overlay { position: fixed; inset: 0; z-index: 4900; display: flex; align-items: flex-end; justify-content: center; background: rgba(18, 12, 20, 0.58); backdrop-filter: blur(8px); }
    .occasion-picker { width: min(480px, 100%); max-height: 80dvh; overflow: auto; padding: 18px 16px calc(var(--safe-bottom, 0px) + 20px); border-radius: 26px 26px 0 0; background: var(--bg, #fff); box-shadow: 0 -20px 60px rgba(0, 0, 0, 0.24); }
    .occasion-picker h3 { font-size: 18px; margin: 0 0 4px; }
    .occasion-picker p { font-size: 12px; color: var(--text-secondary); margin: 0 0 14px; }
    .occasion-picker-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .occasion-picker-item { border: 1px solid var(--border, rgba(0, 0, 0, 0.1)); border-radius: 16px; padding: 13px; text-align: left; background: var(--surface, #fff); color: var(--text-primary, #222); cursor: pointer; }
    .occasion-picker-item span { display: block; font-size: 23px; margin-bottom: 7px; }
    .occasion-picker-item strong { display: block; font-size: 13px; }
    .occasion-picker-close { width: 100%; margin-top: 12px; padding: 12px; border: 0; border-radius: 14px; background: var(--surface-solid, #eee); color: var(--text-primary, #222); font-weight: 700; }

    .birthday-settings-card { padding: 16px; display: flex; flex-direction: column; gap: 13px; }
    .birthday-settings-head { display: flex; gap: 12px; align-items: flex-start; }
    .birthday-settings-head>span { font-size: 21px; }
    .birthday-settings-head strong { display: block; font-size: 14px; }
    .birthday-settings-head small { display: block; margin-top: 3px; color: var(--text-secondary); line-height: 1.4; }
    .birthday-settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .birthday-field { display: flex; flex-direction: column; gap: 6px; }
    .birthday-field label { font-size: 11px; font-weight: 700; color: var(--text-secondary); }
    .birthday-field input { width: 100%; min-width: 0; padding: 10px; border: 1px solid var(--border); border-radius: 12px; background: var(--bg); color: var(--text-primary); }
    .birthday-age { min-height: 16px; font-size: 10px; color: var(--text-secondary); }
    .birthday-save { align-self: flex-end; border: 0; border-radius: 12px; padding: 9px 13px; background: var(--accent); color: #fff; font-size: 12px; font-weight: 800; cursor: pointer; }
    .birthday-save:disabled { opacity: 0.55; }

    @media(max-width:370px) {
      .occasion-paper { padding-left: 20px; padding-right: 20px; }
      .occasion-title { font-size: 24px; }
      .occasion-message { font-size: 18px; }
      .birthday-settings-grid { grid-template-columns: 1fr; }
    }
    @keyframes occasionFade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes occasionRise { from { opacity: 0; transform: translateY(24px) scale(0.97); } to { opacity: 1; transform: none; } }
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

function seeded(index: number): number {
  const value = Math.sin(index * 91.733 + 17.17) * 43758.5453;
  return value - Math.floor(value);
}

function drawPattern(ctx: CanvasRenderingContext2D, width: number, height: number, pattern: Pattern): void {
  for (let index = 0; index < 46; index += 1) {
    const x = seeded(index * 3 + 1) * width;
    const y = seeded(index * 3 + 2) * height;
    const size = 7 + seeded(index * 3 + 3) * 18;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((seeded(index + 80) - 0.5) * 1.8);
    ctx.globalAlpha = 0.16 + seeded(index + 140) * 0.25;
    ctx.fillStyle = index % 2 ? '#fff' : 'rgba(255,255,255,.55)';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    if (pattern === 'hearts') drawHeart(ctx, 0, 0, size);
    else if (pattern === 'petals') {
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.34, size * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (pattern === 'confetti') {
      ctx.fillRect(-size * 0.15, -size * 0.55, size * 0.3, size * 1.1);
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

function drawScratchCover(canvas: HTMLCanvasElement, card: OccasionCard): CanvasRenderingContext2D | null {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const drawCoverImage = (img: HTMLImageElement) => {
    ctx.save();
    roundedPath(ctx, rect.width, rect.height, 30);
    ctx.clip();
    ctx.drawImage(img, 0, 0, rect.width, rect.height);
    ctx.restore();
  };

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

  // Outer Golden Filigree Frame
  ctx.strokeStyle = 'rgba(255, 225, 160, 0.42)';
  ctx.lineWidth = 2;
  ctx.save();
  ctx.translate(14, 14);
  roundedPath(ctx, rect.width - 28, rect.height - 28, 22);
  ctx.stroke();
  ctx.restore();

  // Shimmering Diagonal Gloss Highlight
  const shine = ctx.createLinearGradient(0, 0, rect.width, rect.height);
  shine.addColorStop(0, 'rgba(255,255,255,0)');
  shine.addColorStop(0.42, 'rgba(255,255,255,.08)');
  shine.addColorStop(0.50, 'rgba(255,255,255,.32)');
  shine.addColorStop(0.58, 'rgba(255,255,255,.08)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, rect.width, rect.height);
  ctx.restore();

  // Centered 3D Wax Seal Badge behind Icon
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  ctx.beginPath();
  ctx.arc(rect.width / 2, rect.height / 2 - 58, 44, 0, Math.PI * 2);
  const sealGrad = ctx.createRadialGradient(
    rect.width / 2 - 10, rect.height / 2 - 68, 4,
    rect.width / 2, rect.height / 2 - 58, 44
  );
  sealGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  sealGrad.addColorStop(0.7, 'rgba(255, 240, 246, 0.85)');
  sealGrad.addColorStop(1, 'rgba(250, 215, 230, 0.72)');
  ctx.fillStyle = sealGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();

  // Render Icon
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 40px "Segoe UI Emoji", sans-serif';
  ctx.fillText(card.icon, rect.width / 2, rect.height / 2 - 57);

  // Cover Text
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 8;
  ctx.font = '800 17.5px "Plus Jakarta Sans", Inter, -apple-system, sans-serif';
  wrapCanvasText(ctx, card.coverText, rect.width / 2, rect.height / 2 + 18, rect.width * 0.76, 24);

  // Action Badge Prompt
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.92;
  ctx.font = '800 10.5px "Plus Jakarta Sans", Inter, sans-serif';
  ctx.fillText('✦ DÙNG TAY CÀO ĐỂ MỞ BÍ MẬT ✦', rect.width / 2, rect.height / 2 + 82);
  ctx.globalAlpha = 1;

  if (card.coverImage) {
    const img = new Image();
    img.src = card.coverImage;
    if (img.complete && img.naturalWidth > 0) {
      drawCoverImage(img);
    } else {
      img.onload = () => drawCoverImage(img);
    }
  }

  return ctx;
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): void {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.slice(0, 3).forEach((current, index) => ctx.fillText(current, x, startY + index * lineHeight));
}

function clearedRatio(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): number {
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const step = Math.max(4, Math.floor((window.devicePixelRatio || 1) * 7));
  let cleared = 0;
  let sampled = 0;
  for (let y = 0; y < canvas.height; y += step) {
    for (let x = 0; x < canvas.width; x += step) {
      sampled += 1;
      if (pixels[(y * canvas.width + x) * 4 + 3] < 30) cleared += 1;
    }
  }
  return sampled ? cleared / sampled : 0;
}

function openCard(card: OccasionCard, onRevealed?: () => void): void {
  ensureStyles();
  document.querySelector('.occasion-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'occasion-overlay';
  overlay.innerHTML = `
    <section class="occasion-shell" role="dialog" aria-modal="true" aria-label="${escapeHtml(card.title)}" style="--occasion-a:${card.colors[0]};--occasion-b:${card.colors[1]}">
      <button class="occasion-close" type="button" aria-label="Đóng">×</button>
      <article class="occasion-paper">
        <div class="occasion-border-frame"></div>
        <div class="occasion-corner top-left">✦</div>
        <div class="occasion-corner top-right">✦</div>
        <div class="occasion-corner bottom-left">✦</div>
        <div class="occasion-corner bottom-right">✦</div>
        <div class="occasion-inner">
          <div class="occasion-icon-wrap">
            <span class="occasion-icon">${card.icon}</span>
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
            <div class="occasion-stamp">LOVE SEAL</div>
          </div>
        </div>
      </article>
      <canvas class="occasion-scratch" aria-label="Lớp phủ cào để mở thiệp"></canvas>
      <div class="occasion-hint">✦ CÀO ĐỂ MỞ BÍ MẬT ✦</div>
    </section>
  `;
  document.body.appendChild(overlay);
  const shell = overlay.querySelector<HTMLElement>('.occasion-shell');
  const canvas = overlay.querySelector<HTMLCanvasElement>('.occasion-scratch');
  let cleanup = () => {};
  const close = () => {
    cleanup();
    overlay.remove();
  };
  overlay.querySelector('.occasion-close')?.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') close();
  };
  window.addEventListener('keydown', onKey);
  if (!canvas || !shell) return;
  let ctx = drawScratchCover(canvas, card);
  if (!ctx) return;
  let drawing = false;
  let lastPoint: { x: number; y: number } | null = null;
  let checkTimer: number | null = null;
  let revealed = false;

  const reveal = () => {
    if (revealed) return;
    revealed = true;
    canvas.classList.add('revealed');
    shell.classList.add('is-revealed');
    onRevealed?.();
  };
  const check = () => {
    if (checkTimer !== null || revealed) return;
    checkTimer = window.setTimeout(() => {
      checkTimer = null;
      if (ctx && clearedRatio(ctx, canvas) >= SCRATCH_THRESHOLD) reveal();
    }, 110);
  };
  const point = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const scratch = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 42;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
    check();
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
    try { canvas.releasePointerCapture?.(event.pointerId); } catch { /* optional */ }
    check();
  };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
  const resize = () => {
    if (revealed) return;
    ctx = drawScratchCover(canvas, card);
  };
  window.addEventListener('resize', resize, { passive: true });
  cleanup = () => {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', resize);
    if (checkTimer !== null) window.clearTimeout(checkTimer);
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] || character);
}

function seenKey(card: OccasionCard, context: OccasionContext, userId: string): string {
  return `${SEEN_PREFIX}${userId}:${context.dateKey}:${card.id}`;
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
  button.textContent = '🎴';
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
    <section class="occasion-picker" role="dialog" aria-modal="true">
      <h3>Demo thiệp cào</h3>
      <p>Chọn một dịp để ép mở. Chế độ này không đánh dấu đã xem.</p>
      <div class="occasion-picker-grid">
        ${PREVIEW_ORDER.map((id) => {
          const card = buildCard(id, context);
          return `<button type="button" class="occasion-picker-item" data-card-id="${id}"><span>${card.icon}</span><strong>${escapeHtml(card.title)}</strong></button>`;
        }).join('')}
      </div>
      <button type="button" class="occasion-picker-close">Đóng</button>
    </section>
  `;
  document.body.appendChild(overlay);
  overlay.querySelectorAll<HTMLButtonElement>('[data-card-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.cardId as OccasionCardId;
      overlay.remove();
      openCard(buildCard(id, context));
    });
  });
  overlay.querySelector('.occasion-picker-close')?.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) overlay.remove();
  });
}

function toInputDate(value?: string): string {
  if (!value) return '';
  const date = getCalendarDate(value);
  return date.year ? toDateKey(date) : '';
}

function ageLabel(value: string): string {
  const age = calculateAge(value || undefined);
  return age === undefined ? 'Chưa có tuổi hiển thị' : `${age} tuổi`;
}

async function mountBirthdaySettings(): Promise<void> {
  const page = document.querySelector<HTMLElement>('.profile-page');
  if (!page || page.querySelector('.birthday-settings-card') || birthdaySettingsLoading) return;
  const editRow = Array.from(page.querySelectorAll<HTMLElement>('.card-solid')).find((row) =>
    row.textContent?.includes('Chỉnh sửa thông tin'),
  );
  const container = editRow?.parentElement;
  if (!container) return;
  birthdaySettingsLoading = true;
  let me: MeResponse;
  try {
    me = await getMe();
  } catch {
    return;
  } finally {
    birthdaySettingsLoading = false;
  }
  if (!document.body.contains(page) || page.querySelector('.birthday-settings-card')) return;
  const card = document.createElement('div');
  card.className = 'card-solid birthday-settings-card';
  card.innerHTML = `
    <div class="birthday-settings-head">
      <span>🎂</span>
      <div><strong>Sinh nhật và tuổi</strong><small>Lưu ngày sinh để hai đứa tự nhận thiệp đúng ngày. Tuổi được tính tự động.</small></div>
    </div>
    <div class="birthday-settings-grid">
      <div class="birthday-field">
        <label for="birthday-self">Sinh nhật của bạn</label>
        <input id="birthday-self" type="date" value="${toInputDate(me.user.birthday)}" />
        <span class="birthday-age" data-age-self>${ageLabel(toInputDate(me.user.birthday))}</span>
      </div>
      <div class="birthday-field">
        <label for="birthday-partner">Sinh nhật người ấy</label>
        <input id="birthday-partner" type="date" value="${toInputDate(me.user.partnerBirthday || me.partnerUser?.birthday)}" />
        <span class="birthday-age" data-age-partner>${ageLabel(toInputDate(me.user.partnerBirthday || me.partnerUser?.birthday))}</span>
      </div>
    </div>
    <button type="button" class="birthday-save">Lưu ngày sinh</button>
  `;
  editRow.insertAdjacentElement('afterend', card);
  const selfInput = card.querySelector<HTMLInputElement>('#birthday-self');
  const partnerInput = card.querySelector<HTMLInputElement>('#birthday-partner');
  const selfAge = card.querySelector<HTMLElement>('[data-age-self]');
  const partnerAge = card.querySelector<HTMLElement>('[data-age-partner]');
  const save = card.querySelector<HTMLButtonElement>('.birthday-save');
  const max = toDateKey(getCalendarDate(new Date()));
  if (selfInput) selfInput.max = max;
  if (partnerInput) partnerInput.max = max;
  selfInput?.addEventListener('input', () => { if (selfAge) selfAge.textContent = ageLabel(selfInput.value); });
  partnerInput?.addEventListener('input', () => { if (partnerAge) partnerAge.textContent = ageLabel(partnerInput.value); });
  save?.addEventListener('click', async () => {
    save.disabled = true;
    save.textContent = 'Đang lưu...';
    try {
      await updateProfile({
        birthday: selfInput?.value || null,
        partnerBirthday: partnerInput?.value || null,
      });
      await getMe();
      showToast('Đã lưu ngày sinh và cập nhật tuổi!', 'success');
      save.textContent = 'Đã lưu';
      window.setTimeout(() => { save.textContent = 'Lưu ngày sinh'; }, 1200);
    } catch (error) {
      showToast(`Không lưu được ngày sinh: ${(error as Error).message}`, 'error');
      save.textContent = 'Thử lại';
    } finally {
      save.disabled = false;
    }
  });
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
  let checkedToken: string | null = null;
  let mountTimer: number | null = null;

  const scheduleProfileMount = () => {
    if (mountTimer !== null) return;
    mountTimer = window.setTimeout(() => {
      mountTimer = null;
      void mountBirthdaySettings();
      mountPreviewButton(() => latestMe);
    }, 60);
  };

  const checkToday = async (force = false) => {
    const token = store.getToken();
    if (!token || checking || (!force && checkedToken === token)) return;
    checking = true;
    try {
      latestMe = await getMe();
      checkedToken = token;
      const card = resolveOccasionCard(latestMe);
      if (!card) return;
      const context = createContext(latestMe);
      const key = seenKey(card, context, latestMe.user.id);
      if (localStorage.getItem(key) === '1') return;
      window.setTimeout(() => {
        openCard(card, () => localStorage.setItem(key, '1'));
      }, 350);
    } catch {
      // Occasion cards are a non-blocking enhancement.
    } finally {
      checking = false;
      mountPreviewButton(() => latestMe);
    }
  };

  const observer = new MutationObserver(scheduleProfileMount);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  store.subscribe((state, previous) => {
    if (state.token && state.token !== previous.token) void checkToday(true);
    scheduleProfileMount();
  });
  window.addEventListener('popstate', scheduleProfileMount);
  window.addEventListener('focus', () => void checkToday(true));
  window.addEventListener('pageshow', () => void checkToday(true));
  window.LoveCheckCards = {
    open: (id) => openCard(buildCard(id, previewContext(latestMe))),
    list: () => [...PREVIEW_ORDER],
  };
  scheduleProfileMount();
  void checkToday();
}
