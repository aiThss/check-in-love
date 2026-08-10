import { getMe, type MeResponse } from '../api/auth';
import { updateProfile } from '../api/profile';
import { store } from '../store/index';
import { showToast } from '../components/toast';

const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';
const SEEN_PREFIX = 'lovecheck:occasion-card:seen:v1:';
const PREVIEW_QUERY = 'cardPreview';
const SCRATCH_THRESHOLD = 0.88;
const BIRTHDAY_NOTICE_PREFIX = 'lovecheck:birthday-setup-notice:v1:';
let birthdaySettingsLoading = false;
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
      <path d="M52 126 Q46 122 42 120" stroke="#2d6a4f" stroke-width=".7" fill="none" opacity=".45"/>
      <path d="M54 129 Q50 126 46 124" stroke="#2d6a4f" stroke-width=".7" fill="none" opacity=".4"/>
      <path d="M56 130 C48 126 38 120 34 116" stroke="#95d5b2" stroke-width="1" fill="none" opacity=".35" stroke-linecap="round"/>
    </g>
    <g class="occasion-leaf-r" filter="url(#occasionLeafSh)">
      <path d="M72 134 C82 131 96 126 100 120 C104 114 98 108 90 112 C82 116 76 126 72 134Z" fill="url(#occasionLeafGradR)"/>
      <path d="M74 132 Q82 125 92 118" stroke="#081c15" stroke-width="1.1" fill="none" opacity=".5" stroke-linecap="round"/>
      <path d="M78 128 Q84 124 88 122" stroke="#1b4332" stroke-width=".7" fill="none" opacity=".4"/>
      <path d="M76 131 Q80 128 84 126" stroke="#1b4332" stroke-width=".7" fill="none" opacity=".35"/>
      <path d="M74 132 C82 129 94 124 98 120" stroke="#74c69d" stroke-width="1" fill="none" opacity=".3" stroke-linecap="round"/>
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
    coverImage: '/design/100-1day.png',
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

    /* Revealed card: a theme-led paper surface with a calmer text panel. */
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
      --panel: rgba(255, 255, 255, 0.58);
      --hint-bg: rgba(39, 17, 38, 0.74);
      position: relative; min-height: 540px; padding: 46px 24px 28px;
      overflow: hidden; border-radius: 30px;
      background:
        radial-gradient(circle at 84% 8%, var(--paper-glow), transparent 28%),
        radial-gradient(circle at 10% 94%, var(--paper-glow-2), transparent 31%),
        repeating-linear-gradient(116deg, transparent 0 24px, rgba(255, 255, 255, 0.12) 25px 26px),
        linear-gradient(150deg, var(--paper-start), var(--paper-mid) 48%, var(--paper-end));
      color: var(--paper-ink);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.88),
                  inset 0 0 0 6px rgba(255, 255, 255, 0.46),
                  inset 0 0 0 8px var(--paper-line),
                  0 22px 70px rgba(32, 11, 27, 0.22);
      isolation: isolate;
    }
    .occasion-paper::before,
    .occasion-paper::after {
      content: ''; position: absolute; inset: 0; pointer-events: none;
    }
    .occasion-paper::before {
      z-index: 0; inset: -22%;
      background:
        radial-gradient(ellipse at 72% 18%, var(--paper-glow) 0 7%, transparent 22%),
        radial-gradient(ellipse at 18% 82%, var(--paper-glow-2) 0 6%, transparent 22%);
      filter: blur(18px); transform: rotate(-9deg);
    }
    .occasion-paper::after {
      z-index: 3; opacity: 0.2; mix-blend-mode: multiply;
      background-image: radial-gradient(rgba(76, 31, 58, 0.22) 0.55px, transparent 0.7px);
      background-size: 6px 6px;
    }
    .occasion-paper[data-pattern='confetti'] {
      --paper-start: #fffdf1; --paper-mid: #fff0c9; --paper-end: #ffd8c9;
      --paper-strong: #8c3d42; --paper-accent: #d46657;
      --paper-glow: rgba(255, 195, 67, 0.28); --paper-glow-2: rgba(255, 117, 130, 0.18);
      --paper-line: rgba(208, 105, 79, 0.3);
    }
    .occasion-paper[data-pattern='stars'] {
      --paper-start: #f8fdff; --paper-mid: #e7f1ff; --paper-end: #d8dcfa;
      --paper-ink: #263352; --paper-strong: #334184; --paper-accent: #5267c3;
      --paper-glow: rgba(86, 187, 255, 0.24); --paper-glow-2: rgba(117, 105, 235, 0.18);
      --paper-line: rgba(74, 93, 181, 0.28);
    }
    .occasion-paper[data-card-id='new-year'] {
      --paper-start: #fff9e9; --paper-mid: #ffedbf; --paper-end: #f7d3c3;
      --paper-strong: #743849; --paper-accent: #bd6a45;
      --paper-glow: rgba(255, 201, 67, 0.3); --paper-glow-2: rgba(216, 83, 91, 0.16);
    }
    .occasion-paper[data-pattern='snow'] {
      --paper-start: #f5fffd; --paper-mid: #dcf4ef; --paper-end: #c8e5df;
      --paper-ink: #244745; --paper-strong: #1c5c58; --paper-accent: #2f8d83;
      --paper-glow: rgba(255, 255, 255, 0.72); --paper-glow-2: rgba(82, 177, 164, 0.18);
      --paper-line: rgba(38, 126, 117, 0.28);
    }
    .occasion-paper[data-pattern='ribbons'] {
      --paper-start: #fffaff; --paper-mid: #f3e8ff; --paper-end: #dfd1f3;
      --paper-strong: #59397f; --paper-accent: #815ab0;
      --paper-glow: rgba(215, 173, 255, 0.3); --paper-glow-2: rgba(134, 104, 223, 0.16);
      --paper-line: rgba(112, 78, 162, 0.26);
    }
    .occasion-paper[data-pattern='candy'] {
      --paper-start: #f8fffe; --paper-mid: #dcfbf5; --paper-end: #d6e5ff;
      --paper-ink: #224250; --paper-strong: #355488; --paper-accent: #4c90bd;
      --paper-glow: rgba(106, 229, 215, 0.3); --paper-glow-2: rgba(112, 157, 255, 0.18);
      --paper-line: rgba(69, 132, 180, 0.25);
    }
    .occasion-border-frame {
      position: absolute; inset: 12px; z-index: 1; pointer-events: none;
      border: 1px solid var(--paper-line); border-radius: 22px;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.34);
    }
    .occasion-corner {
      position: absolute; z-index: 2; width: 24px; height: 24px;
      color: transparent; font-size: 0; pointer-events: none; line-height: 1;
    }
    .occasion-corner.top-left { border-top: 1px solid var(--paper-accent); border-left: 1px solid var(--paper-accent); }
    .occasion-corner.top-right { border-top: 1px solid var(--paper-accent); border-right: 1px solid var(--paper-accent); }
    .occasion-corner.bottom-left { border-bottom: 1px solid var(--paper-accent); border-left: 1px solid var(--paper-accent); }
    .occasion-corner.bottom-right { border-bottom: 1px solid var(--paper-accent); border-right: 1px solid var(--paper-accent); }
    .occasion-corner.top-left { top: 16px; left: 16px; }
    .occasion-corner.top-right { top: 16px; right: 16px; }
    .occasion-corner.bottom-left { bottom: 16px; left: 16px; }
    .occasion-corner.bottom-right { bottom: 16px; right: 16px; }

    .occasion-inner {
      position: relative; z-index: 2; padding: 18px 18px 20px; text-align: center;
      border: 1px solid rgba(255, 255, 255, 0.68); border-radius: 25px;
      background: linear-gradient(145deg, var(--panel), rgba(255, 255, 255, 0.24));
      box-shadow: 0 14px 32px rgba(72, 26, 59, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.86);
      -webkit-backdrop-filter: blur(5px); backdrop-filter: blur(5px);
    }
    .occasion-art-wrap {
      display: inline-flex; align-items: center; justify-content: center;
      width: 92px; height: 98px; margin-bottom: 13px; border-radius: 25px;
      background: linear-gradient(145deg, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0.3));
      box-shadow: 0 14px 28px rgba(78, 32, 70, 0.14), inset 0 0 0 1px rgba(255, 255, 255, 0.8);
      transform: rotate(-3deg); transition: transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
      overflow: visible;
    }
    .occasion-art-wrap:hover { transform: rotate(2deg) translateY(-2px); }
    .occasion-art { display: block; width: 100%; height: 100%; overflow: visible; }
    .occasion-eyebrow {
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      font-size: 11px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase;
      color: var(--paper-accent); margin-bottom: 8px; opacity: 0.9;
    }
    .occasion-title {
      font-family: 'Playfair Display', 'Cormorant Garamond', Georgia, serif;
      font-size: 27px; font-weight: 700; line-height: 1.25; color: var(--paper-strong);
      max-width: 100%; margin: 0 0 16px; white-space: nowrap;
      letter-spacing: -0.035em; text-shadow: 0 2px 4px rgba(140, 40, 80, 0.08);
    }
    .occasion-divider {
      display: flex; align-items: center; justify-content: center; gap: 12px;
      width: 140px; margin: 0 auto 18px;
    }
    .divider-line { flex: 1; height: 1px; background: linear-gradient(90deg, transparent, var(--paper-accent), transparent); }
    .divider-heart { font-size: 12px; color: var(--paper-accent); opacity: 0.8; }
    .occasion-message {
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-size: 19.5px; font-weight: 600; line-height: 1.72; color: var(--paper-ink); margin: 0;
      letter-spacing: 0.01em;
    }
    .occasion-signature-wrap {
      margin-top: 26px; display: flex; align-items: flex-end; justify-content: space-between; gap: 14px;
      padding-top: 14px; border-top: 1px dashed rgba(180, 120, 145, 0.28);
    }
    .occasion-signature {
      flex: 1 1 auto; min-width: 0; max-width: 210px; margin: 0;
      font-family: 'Dancing Script', cursive; font-size: 23px; font-weight: 700;
      line-height: 1.08; text-align: left; color: var(--paper-accent);
    }
    .occasion-signature--birthday { max-width: 178px; }
    .occasion-stamp-wrap {
      position: relative; flex: 0 0 auto; transform: rotate(6deg);
    }
    .occasion-stamp {
      font-family: 'Plus Jakarta Sans', sans-serif; font-size: 9px; font-weight: 800;
      letter-spacing: 0.15em; color: rgba(160, 80, 110, 0.65);
      border: 1.5px solid rgba(160, 80, 110, 0.35); padding: 4px 8px; border-radius: 6px;
      color: color-mix(in srgb, var(--paper-accent) 68%, transparent);
      border-color: color-mix(in srgb, var(--paper-accent) 38%, transparent);
      text-transform: uppercase;
    }
    .occasion-seal-scratch {
      position: absolute; inset: -3px; z-index: 1; width: calc(100% + 6px); height: calc(100% + 6px);
      border-radius: 9px; cursor: crosshair; touch-action: none;
      backdrop-filter: blur(4px) saturate(70%); -webkit-backdrop-filter: blur(4px) saturate(70%);
      transition: opacity 360ms ease, transform 360ms ease;
    }
    .occasion-seal-scratch.is-revealed {
      opacity: 0; transform: scale(1.08); pointer-events: none;
    }

    .occasion-scratch {
      position: absolute; inset: 0; width: 100%; height: 100%; z-index: 4;
      touch-action: none; cursor: grab; transition: opacity 0.65s ease;
    }
    .occasion-scratch.scratching { cursor: grabbing; }
    .occasion-scratch.revealed { opacity: 0; pointer-events: none; }
    .occasion-hint {
      position: absolute; z-index: 5; left: 50%; bottom: 20px; transform: translateX(-50%);
      display: flex; align-items: center; gap: 10px;
      padding: 7px 8px 7px 14px; border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.28);
      background: var(--hint-bg); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      box-shadow: 0 14px 30px rgba(21, 7, 20, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.2);
      font-family: 'Plus Jakarta Sans', sans-serif; font-size: 10.5px; font-weight: 800;
      letter-spacing: 0.12em; white-space: nowrap; color: rgba(255, 255, 255, 0.92); pointer-events: none; transition: opacity 0.2s ease;
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
    .birthday-settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .birthday-field { display: flex; flex-direction: column; gap: 6px; }
    .birthday-field label { font-size: 11px; font-weight: 700; color: var(--text-secondary); }
    .birthday-field input { width: 100%; min-width: 0; padding: 10px; border: 1px solid var(--border); border-radius: 12px; background: var(--bg); color: var(--text-primary); }
    .birthday-save { align-self: flex-end; border: 0; border-radius: 12px; padding: 9px 13px; background: var(--accent); color: #fff; font-size: 12px; font-weight: 800; cursor: pointer; }
    .birthday-save:disabled { opacity: 0.55; }

    @media(max-width:370px) {
      .occasion-paper { padding-left: 20px; padding-right: 20px; }
      .occasion-title { font-size: 24px; }
      .occasion-message { font-size: 18px; }
      .occasion-signature { font-size: 20px; }
      .occasion-signature--birthday { max-width: 156px; }
      .occasion-hint { padding: 7px 10px; font-size: 9px; letter-spacing: 0.08em; }
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

function hexToRgba(value: string, alpha: number): string {
  const hex = value.replace('#', '');
  const normalized = hex.length === 3 ? hex.split('').map((part) => part + part).join('') : hex;
  const number = Number.parseInt(normalized, 16);
  if (!Number.isFinite(number)) return `rgba(255, 255, 255, ${alpha})`;
  return `rgba(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255}, ${alpha})`;
}

function drawStarMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const radius = point % 2 ? size * 0.38 : size;
    const angle = -Math.PI / 2 + point * Math.PI / 5;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (point === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function drawFlowerMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  petalColor: string,
  centerColor: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = petalColor;
  for (let petal = 0; petal < 5; petal += 1) {
    ctx.save();
    ctx.rotate((petal * Math.PI * 2) / 5);
    ctx.beginPath();
    ctx.ellipse(0, -size * 0.45, size * 0.23, size * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = centerColor;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawThemeIllustration(
  ctx: CanvasRenderingContext2D,
  card: OccasionCard,
  x: number,
  y: number,
  scale: number,
  light = false,
): void {
  const ink = light ? 'rgba(255, 255, 255, 0.96)' : card.colors[2];
  const accent = light ? 'rgba(255, 222, 238, 0.98)' : card.colors[1];
  const soft = light ? 'rgba(255, 255, 255, 0.38)' : hexToRgba(card.colors[0], 0.54);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2.3;
  ctx.shadowColor = light ? 'rgba(28, 8, 26, 0.18)' : 'rgba(61, 22, 58, 0.12)';
  ctx.shadowBlur = light ? 7 : 4;

  ctx.fillStyle = light ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.54)';
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.fill();

  if (card.id === 'birthday') {
    ctx.fillStyle = soft;
    roundedRectAt(ctx, -27, -5, 54, 25, 7);
    ctx.fill();
    ctx.fillStyle = accent;
    roundedRectAt(ctx, -30, -14, 60, 11, 5);
    ctx.fill();
    ctx.stroke();
    [-17, 0, 17].forEach((candleX) => {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(candleX, -17); ctx.lineTo(candleX, -24); ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(candleX, -27); ctx.bezierCurveTo(candleX - 4, -23, candleX + 4, -23, candleX, -17);
      ctx.fill();
    });
  } else if (card.id === 'christmas') {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(0, -28); ctx.lineTo(-24, 8); ctx.lineTo(24, 8); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -11); ctx.lineTo(-30, 21); ctx.lineTo(30, 21); ctx.closePath(); ctx.fill();
    ctx.fillStyle = soft;
    roundedRectAt(ctx, -5, 19, 10, 10, 3); ctx.fill();
    ctx.fillStyle = ink;
    drawStarMark(ctx, 0, -30, 5);
    ctx.fillStyle = light ? 'rgba(255,255,255,.9)' : card.colors[0];
    [[-15, 11], [13, 5], [-10, 23], [16, 20]].forEach(([dotX, dotY]) => {
      ctx.beginPath(); ctx.arc(dotX, dotY, 2.3, 0, Math.PI * 2); ctx.fill();
    });
  } else if (card.id === 'valentine') {
    ctx.fillStyle = light ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.65)';
    roundedRectAt(ctx, -30, -16, 60, 40, 8); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-27, -12); ctx.lineTo(0, 8); ctx.lineTo(27, -12); ctx.stroke();
    ctx.fillStyle = accent;
    drawHeart(ctx, 0, 6, 18);
  } else if (card.id === 'day-500') {
    ctx.fillStyle = soft;
    roundedRectAt(ctx, -24, -3, 48, 27, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = accent;
    roundedRectAt(ctx, -28, -12, 56, 12, 4); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, 24); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-27, -6); ctx.bezierCurveTo(-42, -17, -40, -26, -29, -22); ctx.bezierCurveTo(-19, -18, -17, -9, 0, -7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(27, -6); ctx.bezierCurveTo(42, -17, 40, -26, 29, -22); ctx.bezierCurveTo(19, -18, 17, -9, 0, -7); ctx.stroke();
  } else if (card.id === 'new-year') {
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.8;
    [[-18, -14, 12], [20, -4, 9], [2, 15, 13]].forEach(([burstX, burstY, radius]) => {
      for (let ray = 0; ray < 8; ray += 1) {
        const angle = (ray * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(burstX + Math.cos(angle) * (radius * 0.45), burstY + Math.sin(angle) * (radius * 0.45));
        ctx.lineTo(burstX + Math.cos(angle) * radius, burstY + Math.sin(angle) * radius);
        ctx.stroke();
      }
    });
    ctx.fillStyle = accent;
    [[-18, -14, 3], [20, -4, 2.6], [2, 15, 3]].forEach(([dotX, dotY, radius]) => {
      ctx.beginPath(); ctx.arc(dotX, dotY, radius, 0, Math.PI * 2); ctx.fill();
    });
  } else if (card.id === 'day-1000') {
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, 30, 11, -0.25, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, 30, 11, Math.PI / 2 - 0.25, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = accent;
    drawStarMark(ctx, -1, -1, 7);
    ctx.fillStyle = light ? '#fff' : card.colors[0];
    ctx.beginPath(); ctx.arc(-26, -10, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(25, 13, 2.5, 0, Math.PI * 2); ctx.fill();
  } else if (card.id === 'anniversary') {
    ctx.strokeStyle = ink;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(-9, 1, 14, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(9, 1, 14, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = accent;
    drawFlowerMark(ctx, -18, -20, 10, accent, ink);
    drawFlowerMark(ctx, 17, -20, 10, soft, ink);
  } else if (card.id === 'womens-day' || card.id === 'vietnamese-womens-day') {
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(0, 27); ctx.bezierCurveTo(-4, 11, -5, 4, -2, -8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-3, 14); ctx.bezierCurveTo(-20, 11, -20, 3, -7, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-2, 18); ctx.bezierCurveTo(15, 14, 19, 7, 9, 8); ctx.stroke();
    drawFlowerMark(ctx, -10, -10, 17, accent, ink);
    drawFlowerMark(ctx, 10, -15, 15, soft, ink);
    drawFlowerMark(ctx, 0, -25, 15, accent, ink);
  } else if (card.id === 'childrens-day') {
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, 28); ctx.stroke();
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.arc(0, -13, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = light ? 'rgba(255,255,255,.85)' : card.colors[2];
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, -13, 9, -0.8, 1.4); ctx.stroke();
    ctx.fillStyle = soft;
    ctx.beginPath(); ctx.arc(0, -13, 4, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(0, 27); ctx.bezierCurveTo(-4, 11, -2, 3, 0, -7); ctx.stroke();
    ctx.fillStyle = accent;
    drawHeart(ctx, -12, -8, 21);
    ctx.fillStyle = soft;
    drawHeart(ctx, 13, -1, 17);
    ctx.fillStyle = ink;
    ctx.beginPath(); ctx.arc(0, -16, 3, 0, Math.PI * 2); ctx.fill();
  }
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
  ctx.clearRect(0, 0, rect.width, rect.height);

  const drawCoverImage = (img: HTMLImageElement) => {
    ctx.save();
    roundedPath(ctx, rect.width, rect.height, 30);
    ctx.clip();
    ctx.globalAlpha = 0.16;
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(img, 0, 0, rect.width, rect.height);
    ctx.restore();
  };

  const drawFullCoverImage = (img: HTMLImageElement) => {
    ctx.save();
    roundedPath(ctx, rect.width, rect.height, 30);
    ctx.clip();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    const imageWidth = img.naturalWidth || img.width;
    const imageHeight = img.naturalHeight || img.height;
    const scale = Math.max(rect.width / imageWidth, rect.height / imageHeight);
    const drawWidth = imageWidth * scale;
    const drawHeight = imageHeight * scale;
    ctx.drawImage(img, (rect.width - drawWidth) / 2, (rect.height - drawHeight) / 2, drawWidth, drawHeight);
    ctx.restore();
  };

  const gradient = ctx.createLinearGradient(0, 0, rect.width, rect.height);
  gradient.addColorStop(0, card.colors[0]);
  gradient.addColorStop(0.52, card.colors[1]);
  gradient.addColorStop(1, card.colors[2]);
  roundedPath(ctx, rect.width, rect.height, 30);
  ctx.fillStyle = gradient;
  ctx.fill();

  if (card.id === 'day-100' && card.coverImage) {
    const img = new Image();
    img.src = card.coverImage;
    if (img.complete && img.naturalWidth > 0) drawFullCoverImage(img);
    else img.onload = () => drawFullCoverImage(img);
    return ctx;
  }

  // Soft colour blooms make the cover feel like a small illustrated object,
  // while the deterministic seed keeps every redraw stable during resize.
  ctx.save();
  roundedPath(ctx, rect.width, rect.height, 30);
  ctx.clip();
  const blooms = [
    [rect.width * 0.08, rect.height * 0.12, rect.width * 0.52, card.colors[0], 0.48],
    [rect.width * 0.92, rect.height * 0.24, rect.width * 0.44, card.colors[1], 0.34],
    [rect.width * 0.72, rect.height * 0.96, rect.width * 0.62, card.colors[2], 0.3],
  ] as const;
  blooms.forEach(([x, y, radius, color, alpha]) => {
    const bloom = ctx.createRadialGradient(x, y, 0, x, y, radius);
    bloom.addColorStop(0, hexToRgba(color, alpha));
    bloom.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, rect.width, rect.height);
  });
  ctx.globalAlpha = 0.13;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 0.8;
  for (let index = 0; index < 120; index += 1) {
    const x = seeded(index * 5 + 5) * rect.width;
    const y = seeded(index * 5 + 6) * rect.height;
    const length = 7 + seeded(index * 5 + 7) * 18;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + length, y - length * 0.18);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  roundedPath(ctx, rect.width, rect.height, 30);
  ctx.clip();
  drawPattern(ctx, rect.width, rect.height, card.pattern);

  // Layered frame and gloss keep the scratch surface tactile instead of flat.
  ctx.strokeStyle = hexToRgba('#fff5cf', 0.44);
  ctx.lineWidth = 1.6;
  ctx.save();
  ctx.translate(14, 14);
  roundedPath(ctx, rect.width - 28, rect.height - 28, 22);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1;
  ctx.save();
  ctx.translate(21, 21);
  roundedPath(ctx, rect.width - 42, rect.height - 42, 17);
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

  // The 100-day cover stays intentionally open in the middle. Its reference
  // artwork contains a faded flower there, so do not place either that asset
  // or another central badge on this milestone's scratch surface.
  if (card.id !== 'day-100') {
    ctx.save();
    ctx.fillStyle = 'rgba(24, 8, 26, 0.2)';
    ctx.shadowColor = 'rgba(18, 4, 22, 0.32)';
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.ellipse(rect.width / 2, rect.height / 2 - 58, 58, 46, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    const artHalo = ctx.createRadialGradient(
      rect.width / 2 - 12, rect.height / 2 - 70, 2,
      rect.width / 2, rect.height / 2 - 58, 54,
    );
    artHalo.addColorStop(0, 'rgba(255, 255, 255, 0.72)');
    artHalo.addColorStop(0.66, 'rgba(255, 231, 244, 0.2)');
    artHalo.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = artHalo;
    ctx.beginPath();
    ctx.arc(rect.width / 2, rect.height / 2 - 58, 54, 0, Math.PI * 2);
    ctx.fill();
    drawThemeIllustration(ctx, card, rect.width / 2, rect.height / 2 - 58, 1.02, true);
    ctx.restore();
  }

  // Keep the existing cover copy verbatim, but give it a soft reading plate.
  const isHundredDay = card.id === 'day-100';
  const copyTop = isHundredDay ? rect.height / 2 + 4 : rect.height / 2 - 4;
  const copyHeight = isHundredDay ? 92 : 116;
  ctx.save();
  roundedRectAt(ctx, rect.width * (isHundredDay ? 0.14 : 0.09), copyTop, rect.width * (isHundredDay ? 0.72 : 0.82), copyHeight, 22);
  const copyPlate = ctx.createLinearGradient(0, copyTop, 0, copyTop + copyHeight);
  copyPlate.addColorStop(0, 'rgba(26, 8, 28, 0.28)');
  copyPlate.addColorStop(1, isHundredDay ? 'rgba(26, 8, 28, 0.48)' : 'rgba(26, 8, 28, 0.56)');
  ctx.fillStyle = copyPlate;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = isHundredDay ? 7 : 10;
  ctx.font = isHundredDay
    ? '700 21px "Dancing Script", "Brush Script MT", cursive'
    : '800 16.5px "Plus Jakarta Sans", Inter, -apple-system, sans-serif';
  wrapCanvasText(
    ctx,
    card.coverText,
    rect.width / 2,
    isHundredDay ? rect.height / 2 + 42 : rect.height / 2 + 18,
    rect.width * (isHundredDay ? 0.66 : 0.76),
    isHundredDay ? 26 : 24,
  );

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.92;
  ctx.font = '800 10.5px "Plus Jakarta Sans", Inter, sans-serif';
  if (!isHundredDay) ctx.fillText('✦ DÙNG TAY CÀO ĐỂ MỞ BÍ MẬT ✦', rect.width / 2, rect.height / 2 + 82);
  ctx.globalAlpha = 1;

  if (card.coverImage && card.id !== 'day-100') {
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

function fitOccasionTitleToLine(title: HTMLElement): void {
  title.style.whiteSpace = 'nowrap';
  let fontSize = 27;
  title.style.fontSize = `${fontSize}px`;
  while (title.scrollWidth > title.clientWidth && fontSize > 17) {
    fontSize -= 0.5;
    title.style.fontSize = `${fontSize}px`;
  }
}

function drawSealScratchCover(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  roundedRectAt(ctx, 0, 0, rect.width, rect.height, 8);
  const glass = ctx.createLinearGradient(0, 0, rect.width, rect.height);
  glass.addColorStop(0, 'rgba(255, 255, 255, 0.82)');
  glass.addColorStop(0.48, 'rgba(255, 255, 255, 0.56)');
  glass.addColorStop(1, 'rgba(255, 232, 240, 0.72)');
  ctx.fillStyle = glass;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.82)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.save();
  roundedRectAt(ctx, 0, 0, rect.width, rect.height, 8);
  ctx.clip();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.8;
  for (let x = -rect.height; x < rect.width + rect.height; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - rect.height, rect.height);
    ctx.stroke();
  }
  ctx.restore();
  return ctx;
}

function installSealScratch(canvas: HTMLCanvasElement): () => void {
  let ctx = drawSealScratchCover(canvas);
  if (!ctx) return () => {};
  let drawing = false;
  let revealed = false;
  let lastPoint: { x: number; y: number } | null = null;

  const reveal = () => {
    if (revealed) return;
    revealed = true;
    canvas.classList.add('is-revealed');
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
    ctx.lineWidth = 15;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
    if (clearedRatio(ctx, canvas) >= 0.24) reveal();
  };
  canvas.addEventListener('pointerdown', (event) => {
    drawing = true;
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
    drawing = false;
    lastPoint = null;
    try { canvas.releasePointerCapture?.(event.pointerId); } catch { /* optional */ }
  };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);

  const resize = () => {
    if (!revealed) ctx = drawSealScratchCover(canvas);
  };
  window.addEventListener('resize', resize, { passive: true });
  return () => {
    window.removeEventListener('resize', resize);
  };
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
  // Birthday card is handled by the unified polaroid scratch system.
  if (card.id === 'birthday') {
    void import('../components/polaroid-cover').then(({ openPolaroidCoverModal }) => {
      openPolaroidCoverModal({
        imageUrl: '/design/birthday-placeholder.jpg',
        title: card.title,
        dateText: card.eyebrow,
        coverText: card.coverText,
        theme: 'birthday-foil',
        forceScratch: true,
        restartScratch: true,
        onRevealed,
      });
    });
    return;
  }
  ensureStyles();
  document.querySelector('.occasion-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'occasion-overlay';
  overlay.innerHTML = `
    <section class="occasion-shell" role="dialog" aria-modal="true" aria-label="${escapeHtml(card.title)}" style="--occasion-a:${card.colors[0]};--occasion-b:${card.colors[1]}">
      <button class="occasion-close" type="button" aria-label="Đóng">×</button>
      <article class="occasion-paper" data-pattern="${card.pattern}" data-card-id="${card.id}">
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
            <p class="occasion-signature${(card.id as string) === 'birthday' ? ' occasion-signature--birthday' : ''}">${formatOccasionSignature(card)}</p>
            <div class="occasion-stamp-wrap">
              <div class="occasion-stamp">LOVE SEAL</div>
              <canvas class="occasion-seal-scratch" aria-label="Cào nhẹ để mở Love Seal"></canvas>
            </div>
          </div>
        </div>
      </article>
      <canvas class="occasion-scratch" aria-label="Lớp phủ cào để mở thiệp"></canvas>
      <div class="occasion-hint">
        <span>Cào để mở bí mật</span>
      </div>
    </section>
  `;
  document.body.appendChild(overlay);
  const title = overlay.querySelector<HTMLElement>('.occasion-title');
  if (title) {
    const fitTitle = () => {
      if (title.isConnected) fitOccasionTitleToLine(title);
    };
    fitTitle();
    window.setTimeout(fitTitle, 80);
    document.fonts?.ready.then(fitTitle).catch(() => {});
  }
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
  const sealScratchCanvas = overlay.querySelector<HTMLCanvasElement>('.occasion-seal-scratch');
  const cleanupSealScratch = sealScratchCanvas ? installSealScratch(sealScratchCanvas) : () => {};
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
    cleanupSealScratch();
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] || character);
}

function formatOccasionSignature(card: OccasionCard): string {
  const signature = escapeHtml(card.signature);
  return card.id === 'birthday' ? signature.replace(', ', ',<br>') : signature;
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

export function needsBirthdaySetup(me: Pick<MeResponse, 'user' | 'partnerUser'>): boolean {
  return !me.user.birthday || !(me.user.partnerBirthday || me.partnerUser?.birthday);
}

function notifyMissingBirthday(me: MeResponse): void {
  if (!needsBirthdaySetup(me)) return;

  const key = `${BIRTHDAY_NOTICE_PREFIX}${me.user.id}`;
  if (birthdayNoticeSession.has(key)) return;

  try {
    if (sessionStorage.getItem(key) === '1') {
      birthdayNoticeSession.add(key);
      return;
    }
    sessionStorage.setItem(key, '1');
  } catch {
    // The in-memory guard still prevents duplicate notices if storage is unavailable.
  }

  birthdayNoticeSession.add(key);
  window.setTimeout(() => {
    showToast('Bạn chưa lưu đủ Birthday. Thêm ngày đặc biệt để giữ bất ngờ nhé 🎂', 'info');
  }, 700);
}

async function mountBirthdaySettings(): Promise<void> {
  ensureStyles();
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
      <span class="birthday-settings-icon">🎂</span>
      <div>
        <span class="birthday-settings-title">Ngày sinh nhật</span>
        <span class="birthday-settings-subtitle">Cập nhật sinh nhật hai bạn để nhận thiệp chúc mừng tự động</span>
      </div>
    </div>
    <div class="birthday-settings-grid">
      <div class="birthday-field">
        <label for="birthday-self">Birthday của bạn</label>
        <input id="birthday-self" type="date" value="${toInputDate(me.user.birthday)}" />
      </div>
      <div class="birthday-field">
        <label for="birthday-partner">Birthday người ấy</label>
        <input id="birthday-partner" type="date" value="${toInputDate(me.user.partnerBirthday || me.partnerUser?.birthday)}" />
      </div>
    </div>
    <button type="button" class="birthday-save">Lưu Birthday</button>
  `;
  editRow.insertAdjacentElement('afterend', card);
  const selfInput = card.querySelector<HTMLInputElement>('#birthday-self');
  const partnerInput = card.querySelector<HTMLInputElement>('#birthday-partner');
  const save = card.querySelector<HTMLButtonElement>('.birthday-save');
  const max = toDateKey(getCalendarDate(new Date()));
  if (selfInput) selfInput.max = max;
  if (partnerInput) partnerInput.max = max;
  save?.addEventListener('click', async () => {
    save.disabled = true;
    save.textContent = '⏳ Đang lưu...';
    try {
      await updateProfile({
        birthday: selfInput?.value || null,
        partnerBirthday: partnerInput?.value || null,
      });
      await getMe();
      showToast('Đã lưu Birthday!', 'success');
      save.textContent = '✨ Đã lưu';
      window.setTimeout(() => { save.textContent = 'Lưu Birthday'; }, 1200);
    } catch (error) {
      showToast(`Không lưu được Birthday: ${(error as Error).message}`, 'error');
      save.textContent = '🔄 Thử lại';
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
  let checkedSessionKey: string | null = null;
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
    const todayKey = toDateKey(getCalendarDate(new Date()));
    const sessionKey = token ? `${token}:${todayKey}` : null;
    if (!token || checking || (!force && checkedSessionKey === sessionKey)) return;
    checking = true;
    try {
      latestMe = await getMe();
      checkedSessionKey = sessionKey;
      notifyMissingBirthday(latestMe);
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
  window.addEventListener('popstate', () => {
    scheduleProfileMount();
    void checkToday();
  });
  window.addEventListener('focus', () => void checkToday(true));
  window.addEventListener('pageshow', () => void checkToday(true));
  window.LoveCheckCards = {
    open: (id) => openCard(buildCard(id, previewContext(latestMe))),
    list: () => [...PREVIEW_ORDER],
  };
  scheduleProfileMount();
  void checkToday();
}
