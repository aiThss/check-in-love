import { parseJsonSafe, type CoupleRow, type UserRow } from '../db/types';

export const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';

export type OccasionPattern =
  | 'hearts'
  | 'petals'
  | 'confetti'
  | 'stars'
  | 'snow'
  | 'ribbons'
  | 'candy'
  | 'lanterns';

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

export interface LunarCalendarDate {
  month: number;
  day: number;
  isLeapMonth: boolean;
}

export interface OccasionCardRow {
  id: string;
  couple_id: string;
  author_id: string;
  occasion_key: string;
  kind: 'builtin' | 'custom';
  enabled: number;
  schedule_type: 'builtin' | 'once' | 'annual';
  custom_date: string | null;
  occasion_label: string | null;
  eyebrow: string | null;
  title: string | null;
  message: string | null;
  signature: string | null;
  cover_text: string | null;
  template_id: string | null;
  pattern: string | null;
  colors_json: string | null;
  scratch_cover_url: string | null;
  scratch_cover_storage_path: string | null;
  background_image_url: string | null;
  background_storage_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface OccasionDeliveryRow {
  id: string;
  couple_id: string;
  recipient_id: string;
  sender_id: string | null;
  occasion_key: string;
  date_key: string;
  card_snapshot_json: string;
  revealed_at: string;
  created_at: string;
}

export interface ResolvedOccasionCardDto {
  id: string;
  occasionKey: string;
  occasionLabel: string;
  title: string;
  eyebrow: string;
  message: string;
  signature: string;
  coverText: string;
  icon: string;
  pattern: OccasionPattern;
  colors: [string, string, string];
  templateId?: string;
  coverImage?: string;
  scratchCoverUrl?: string;
  backgroundImageUrl?: string;
  senderName: string;
  isCustomized: boolean;
}

export interface BuiltinOccasionMeta {
  key: string;
  label: string;
  dateBadge: string;
  category: 'milestone' | 'vietnam' | 'lunar';
  genderSpecific?: boolean;
  prepRemindable?: boolean;
  icon: string;
  pattern: OccasionPattern;
  colors: [string, string, string];
  coverImage?: string;
  solar?: [number, number];
  lunar?: [number, number];
  defaultCopy: (ctx: {
    recipientName: string;
    senderName: string;
    recipientAge?: number;
    yearsTogether: number;
  }) => {
    eyebrow: string;
    title: string;
    message: string;
    signature: string;
    coverText: string;
  };
}

export const BUILTIN_OCCASIONS: readonly BuiltinOccasionMeta[] = [
  {
    key: 'birthday',
    label: 'Sinh nhật người ấy',
    dateBadge: 'Theo ngày sinh đã lưu',
    category: 'milestone',
    prepRemindable: true,
    icon: 'anniversary',
    pattern: 'confetti',
    colors: ['#ffd66e', '#ff9c64', '#d94b78'],
    defaultCopy: ({ recipientName, senderName, recipientAge }) => ({
      eyebrow: 'Hôm nay là ngày của riêng bạn',
      title: recipientAge ? `Mừng tuổi ${recipientAge} rực rỡ nhé ${recipientName}` : `Sinh nhật thật vui nhé ${recipientName}`,
      message: `Tuổi mới mong ${recipientName} luôn bình yên, cười thật tươi và được yêu thương trọn vẹn mỗi ngày. Cảm ơn vì đã xuất hiện và đi cùng ${senderName} trên hành trình này.`,
      signature: `Sinh nhật hạnh phúc nhé, thương từ ${senderName}.`,
      coverText: `Món quà nhỏ mừng ngày ${recipientName} ra đời`,
    }),
  },
  {
    key: 'anniversary',
    label: 'Tròn năm bên nhau',
    dateBadge: 'Kỷ niệm ngày bắt đầu yêu',
    category: 'milestone',
    prepRemindable: true,
    icon: 'anniversary',
    pattern: 'petals',
    colors: ['#f6c86f', '#e9965b', '#9b5a42'],
    defaultCopy: ({ recipientName, senderName, yearsTogether }) => ({
      eyebrow: 'Ngày mình bắt đầu',
      title: `${Math.max(1, yearsTogether)} năm mình có nhau`,
      message: `Thêm một năm ${senderName} và ${recipientName} ở cạnh nhau. Chẳng cần hứa điều gì xa xôi, chỉ mong tụi mình vẫn luôn chọn lắng nghe, chọn thấu hiểu và nắm tay nhau thật lâu.`,
      signature: `Mừng ngày kỷ niệm của hai đứa — ${senderName}.`,
      coverText: 'Cào nhẹ mở ngày kỷ niệm của hai đứa mình',
    }),
  },
  {
    key: 'day-100',
    label: '100 ngày bên nhau',
    dateBadge: 'Cột mốc 100 ngày',
    category: 'milestone',
    prepRemindable: true,
    icon: 'heart-burst',
    pattern: 'hearts',
    colors: ['#ff8fb1', '#ff5f8f', '#9f3564'],
    coverImage: '/design/100-1day.png',
    defaultCopy: ({ recipientName, senderName }) => ({
      eyebrow: 'Một cột mốc nhỏ xinh',
      title: `100 ngày của ${senderName} và ${recipientName}`,
      message: `Vậy là tụi mình đã đi cùng nhau trọn 100 ngày đầu tiên. Đủ để thấy mỗi ngày bình thường có ${recipientName} đều trở nên dễ thương hơn rất nhiều.`,
      signature: `Thương ${recipientName} thật nhiều — ${senderName}.`,
      coverText: 'Cào nhẹ để mở 100 ngày đầu tiên của hai đứa',
    }),
  },
  {
    key: 'day-500',
    label: '500 ngày có nhau',
    dateBadge: 'Cột mốc 500 ngày',
    category: 'milestone',
    prepRemindable: true,
    icon: 'gift',
    pattern: 'ribbons',
    colors: ['#d7a8ff', '#9c66db', '#5b338d'],
    coverImage: '/design/500-1day.webp',
    defaultCopy: ({ recipientName, senderName }) => ({
      eyebrow: 'Mình đi cùng nhau khá xa rồi',
      title: '500 ngày có nhau',
      message: `500 ngày qua cảm ơn ${recipientName} vì vẫn luôn ở đây, cùng đi qua cả những hôm rực rỡ lẫn những chiều mệt nhoài. Những ngày sắp tới vẫn cứ ở cạnh ${senderName} nhé.`,
      signature: `Vẫn luôn chọn ${recipientName} — ${senderName}.`,
      coverText: 'Mở xem điều bí mật ở cột mốc 500 ngày',
    }),
  },
  {
    key: 'day-1000',
    label: '1.000 ngày bên nhau',
    dateBadge: 'Cột mốc 1.000 ngày',
    category: 'milestone',
    prepRemindable: true,
    icon: 'sparkle',
    pattern: 'stars',
    colors: ['#72d7ff', '#5d7df3', '#35408d'],
    defaultCopy: ({ recipientName, senderName }) => ({
      eyebrow: 'Một nghìn ngày thương nhớ',
      title: `1.000 ngày bên ${recipientName}`,
      message: `Một chặng đường thật đáng tự hào của hai đứa mình. Cảm ơn ${recipientName} đã trở thành một phần dịu dàng và thân thuộc nhất trong cuộc sống của ${senderName}.`,
      signature: `Còn nhiều nghìn ngày nữa nhé — ${senderName}.`,
      coverText: 'Chạm cào cột mốc ngàn ngày bên nhau',
    }),
  },
  {
    key: 'new-year',
    label: 'Tết Dương lịch',
    dateBadge: '01 tháng 01',
    category: 'vietnam',
    prepRemindable: true,
    solar: [1, 1],
    icon: 'star',
    pattern: 'stars',
    colors: ['#ffcf56', '#ed6a4a', '#8f263d'],
    defaultCopy: ({ recipientName, senderName }) => ({
      eyebrow: 'Ngày đầu tiên của năm mới',
      title: `Năm mới bình yên bên ${recipientName}`,
      message: `Chúc hai đứa mình một năm mới thật nhiều tiếng cười, nhiều chuyến đi cùng nhau và luôn là chỗ dựa ấm áp nhất của đối phương.`,
      signature: `Năm mới vẫn thương ${recipientName} — ${senderName}.`,
      coverText: 'Cào mở lời chúc đầu năm mới của hai đứa',
    }),
  },
  {
    key: 'lunar-new-year',
    label: 'Tết Nguyên Đán',
    dateBadge: 'Mùng 1 Tết Âm lịch',
    category: 'lunar',
    prepRemindable: true,
    lunar: [1, 1],
    icon: 'sparkle',
    pattern: 'lanterns',
    colors: ['#ffd166', '#e63946', '#780000'],
    defaultCopy: ({ recipientName, senderName }) => ({
      eyebrow: 'Xuân sum vầy · Mùng 1 Tết',
      title: `Chúc mừng năm mới nhé ${recipientName}`,
      message: `Giao thừa qua rồi, năm mới lại tới. Cầu mong mùa xuân này mang thật nhiều may mắn, an nhiên đến với ${recipientName}, và cho hai đứa thêm thật nhiều khoảnh khắc ở cạnh nhau.`,
      signature: `Lì xì trọn trái tim từ ${senderName}.`,
      coverText: 'Cào mở phong bao lì xì đầu xuân',
    }),
  },
  {
    key: 'valentine',
    label: 'Lễ Tình nhân (Valentine)',
    dateBadge: '14 tháng 02',
    category: 'vietnam',
    prepRemindable: true,
    solar: [2, 14],
    icon: 'mail',
    pattern: 'hearts',
    colors: ['#ff839d', '#e43d68', '#8a2148'],
    defaultCopy: ({ recipientName, senderName }) => ({
      eyebrow: '14 tháng 2 · mùa yêu',
      title: `Valentine ngọt ngào nhé ${recipientName}`,
      message: `Chẳng cần đợi đến ngày lễ mới nhớ thương nhau, nhưng hôm nay là cớ thật đẹp để ${senderName} nhắc lại rằng có ${recipientName} bên cạnh là điều tuyệt vời nhất.`,
      signature: `Người luôn thương ${recipientName} — ${senderName}.`,
      coverText: 'Một bức thư Valentine bí mật dành riêng bạn',
    }),
  },
  {
    key: 'womens-day',
    label: 'Quốc tế Phụ nữ 8/3',
    dateBadge: '08 tháng 03',
    category: 'vietnam',
    genderSpecific: true,
    prepRemindable: true,
    solar: [3, 8],
    icon: 'star',
    pattern: 'petals',
    colors: ['#ffb7cf', '#ef73aa', '#8e416d'],
    defaultCopy: ({ recipientName, senderName }) => ({
      eyebrow: 'Ngày Quốc tế Phụ nữ 8/3',
      title: `8/3 rạng rỡ nhé ${recipientName}`,
      message: `Hôm nay ${recipientName} cứ việc thật xinh tươi, vui vẻ và được yêu chiều hết mực nhé. Mong nụ cười của bạn luôn dịu dàng như nắng sớm.`,
      signature: `Bông hoa nhỏ từ ${senderName}.`,
      coverText: 'Một đoá hoa nhỏ dành tặng người thương ngày 8/3',
    }),
  },
  {
    key: 'white-day',
    label: 'Valentine Trắng',
    dateBadge: '14 tháng 03',
    category: 'vietnam',
    prepRemindable: false,
    solar: [3, 14],
    icon: 'heart',
    pattern: 'hearts',
    colors: ['#ffc8dd', '#ff758f', '#800f2f'],
    defaultCopy: ({ recipientName, senderName }) => ({
      eyebrow: '14 tháng 3 · White Day',
      title: `Lời hồi đáp ngọt ngào gửi ${recipientName}`,
      message: `Ngày Valentine Trắng là ngày đáp lại yêu thương — và câu trả lời của ${senderName} trước sau như một vẫn luôn là ${recipientName}.`,
      signature: `Mãi bên nhau nhé — ${senderName}.`,
      coverText: 'Cào mở lời hồi đáp ngày Valentine Trắng',
    }),
  },
  {
    key: 'reunification-holiday',
    label: 'Kỳ nghỉ lễ 30/4 – 1/5',
    dateBadge: '30 tháng 04',
    category: 'vietnam',
    prepRemindable: false,
    solar: [4, 30],
    icon: 'map',
    pattern: 'confetti',
    colors: ['#ffd166', '#f77f00', '#9b2226'],
    defaultCopy: ({ recipientName, senderName }) => ({
      eyebrow: 'Kỳ nghỉ dài bên nhau',
      title: `Đi trốn cùng nhau nhé ${recipientName}`,
      message: `Tới kỳ nghỉ thảnh thơi rồi! Dù đi xa khám phá nơi mới hay chỉ nằm cạnh nhau ăn món ngon, miễn đi cùng ${recipientName} là ngày nghỉ nào cũng trọn vẹn.`,
      signature: `Hẹn hò thôi nào — ${senderName}.`,
      coverText: 'Cào mở tấm vé hẹn hò kỳ nghỉ lễ của hai đứa',
    }),
  },
  {
    key: 'childrens-day',
    label: 'Quốc tế Thiếu nhi 1/6',
    dateBadge: '01 tháng 06',
    category: 'vietnam',
    prepRemindable: false,
    solar: [6, 1],
    icon: 'sparkle',
    pattern: 'candy',
    colors: ['#75e5dc', '#75aef5', '#7657c6'],
    defaultCopy: ({ recipientName, senderName }) => ({
      eyebrow: '1/6 · Lớn rồi vẫn được nhận quà',
      title: `1/6 vui vẻ nhé em bé ${recipientName}`,
      message: `Người lớn ngoài xã hội thế nào cũng được, về bên ${senderName} vẫn được quyền vô tư, thích kẹo ngọt và cười tít mắt vì những điều nhỏ xíu nhé.`,
      signature: `Luôn chiều chuộng bạn — ${senderName}.`,
      coverText: 'Cào mở kẹo ngọt ngày 1/6 nào',
    }),
  },
  {
    key: 'vietnam-family-day',
    label: 'Ngày Gia đình Việt Nam',
    dateBadge: '28 tháng 06',
    category: 'vietnam',
    prepRemindable: false,
    solar: [6, 28],
    icon: 'home',
    pattern: 'petals',
    colors: ['#f9c74f', '#f8961e', '#7f4f24'],
    defaultCopy: ({ recipientName, senderName }) => ({
      eyebrow: '28 tháng 6 · Nhà là nơi có nhau',
      title: `Bình yên nhất là khi có ${recipientName}`,
      message: `Giữa phố xá tấp nập, ở đâu có ${recipientName} thì ở đó thấy ấm lòng như về nhà. Cảm ơn bạn đã luôn là góc bình yên của ${senderName}.`,
      signature: `Thương mái ấm nhỏ của tụi mình — ${senderName}.`,
      coverText: 'Cào mở hơi ấm ngày Gia đình Việt Nam',
    }),
  },
  {
    key: 'that-tich',
    label: 'Lễ Thất Tịch',
    dateBadge: 'Mùng 7 tháng 7 Âm lịch',
    category: 'lunar',
    prepRemindable: true,
    lunar: [7, 7],
    icon: 'sparkle',
    pattern: 'stars',
    colors: ['#cdb4db', '#9d4edd', '#3c096c'],
    defaultCopy: ({ recipientName, senderName }) => ({
      eyebrow: 'Mùng 7 tháng 7 Âm lịch · Thất Tịch',
      title: `Mưa Ngâu có nhau chẳng sợ xa`,
      message: `Người ta ăn chè đậu đỏ để cầu duyên, còn ${senderName} ăn cùng ${recipientName} để giữ duyên mình bền chặt thêm nhiều mùa Thất Tịch nữa.`,
      signature: `Duyên lành của ${senderName}.`,
      coverText: 'Cào mở điều ước đêm mưa Thất Tịch',
    }),
  },
  {
    key: 'national-day',
    label: 'Kỳ nghỉ Quốc khánh 2/9',
    dateBadge: '02 tháng 09',
    category: 'vietnam',
    prepRemindable: false,
    solar: [9, 2],
    icon: 'star',
    pattern: 'confetti',
    colors: ['#ffd166', '#ef476f', '#9b2226'],
    defaultCopy: ({ recipientName, senderName }) => ({
      eyebrow: '02 tháng 09 · Ngày thu rực rỡ',
      title: `Dạo phố mùa thu cùng ${recipientName}`,
      message: `Nắng thu dịu nhẹ rồi, tạm gác bận rộn sang một bên để hai đứa dành trọn thời gian đi dạo, chụp thật nhiều ảnh kỷ niệm bên nhau nhé.`,
      signature: `Mùa thu có bạn — ${senderName}.`,
      coverText: 'Cào mở lời hẹn ngày nghỉ lễ mùa thu',
    }),
  },
  {
    key: 'mid-autumn',
    label: 'Tết Trung Thu',
    dateBadge: 'Rằm tháng 8 Âm lịch',
    category: 'lunar',
    prepRemindable: true,
    lunar: [8, 15],
    icon: 'moon',
    pattern: 'lanterns',
    colors: ['#ffe66d', '#ff9f1c', '#6f1d1b'],
    defaultCopy: ({ recipientName, senderName }) => ({
      eyebrow: 'Rằm tháng Tám · Đêm trăng đoàn viên',
      title: `Trăng tròn nhất khi đi cạnh ${recipientName}`,
      message: `Đêm rằm phố phường lung linh đèn lồng, chỉ muốn nắm tay ${recipientName} đi dạo thật chậm, cắt miếng bánh nướng thơm lừng và ngắm trăng cùng nhau.`,
      signature: `Ánh trăng của ${senderName}.`,
      coverText: 'Cào mở ánh trăng rằm Trung Thu của hai đứa',
    }),
  },
  {
    key: 'vietnamese-womens-day',
    label: 'Phụ nữ Việt Nam 20/10',
    dateBadge: '20 tháng 10',
    category: 'vietnam',
    genderSpecific: true,
    prepRemindable: true,
    solar: [10, 20],
    icon: 'heart',
    pattern: 'petals',
    colors: ['#f3a8c8', '#d76da8', '#7f416f'],
    defaultCopy: ({ recipientName, senderName }) => ({
      eyebrow: 'Ngày Phụ nữ Việt Nam 20/10',
      title: `20/10 thật hạnh phúc nhé ${recipientName}`,
      message: `Cảm ơn ${recipientName} vì đã đến và làm những ngày thường nhật trở nên đáng mong chờ hơn biết bao. Chúc bạn luôn tự tin, dịu dàng và ngập tràn yêu thương.`,
      signature: `Thương bạn nhất — ${senderName}.`,
      coverText: 'Lời thương gửi riêng bạn ngày 20/10',
    }),
  },
  {
    key: 'mens-day',
    label: 'Quốc tế Nam giới 19/11',
    dateBadge: '19 tháng 11',
    category: 'vietnam',
    genderSpecific: true,
    prepRemindable: true,
    solar: [11, 19],
    icon: 'star',
    pattern: 'stars',
    colors: ['#90e0ef', '#0077b6', '#03045e'],
    defaultCopy: ({ recipientName, senderName }) => ({
      eyebrow: '19 tháng 11 · Ngày của người thương',
      title: `19/11 thật vui nhé ${recipientName}`,
      message: `Cảm ơn bờ vai vững chãi và sự ấm áp mà ${recipientName} luôn dành cho tụi mình. Hôm nay đến lượt bạn được nghỉ ngơi và nhận thật nhiều yêu chiều từ ${senderName} nhé!`,
      signature: `Luôn tự hào về bạn — ${senderName}.`,
      coverText: 'Món quà nhỏ gửi tặng chàng ngày 19/11',
    }),
  },
  {
    key: 'vietnam-culture-day',
    label: 'Ngày Văn hoá Việt Nam',
    dateBadge: '24 tháng 11',
    category: 'vietnam',
    prepRemindable: true,
    solar: [11, 24],
    icon: 'sparkle',
    pattern: 'petals',
    colors: ['#f4a261', '#e76f51', '#6d2e46'],
    defaultCopy: ({ recipientName, senderName }) => ({
      eyebrow: '24 tháng 11 · Ngày nghỉ Văn hoá Việt Nam',
      title: `Một ngày thảnh thơi bên ${recipientName}`,
      message: `Thêm một ngày nghỉ lễ đẹp trời cuối thu để hai đứa gác lại lo toan, dạo quanh góc phố quen, nhâm nhi ly trà ấm và lưu thêm kỷ niệm đẹp bên nhau.`,
      signature: `Đi chơi cùng nhau nhé — ${senderName}.`,
      coverText: 'Cào mở lời hẹn ngày Văn hoá Việt Nam 24/11',
    }),
  },
  {
    key: 'christmas',
    label: 'Đêm Giáng sinh (Noel)',
    dateBadge: '24 tháng 12',
    category: 'vietnam',
    prepRemindable: true,
    solar: [12, 24],
    icon: 'gift',
    pattern: 'snow',
    colors: ['#9be3d2', '#3aa58f', '#1d5e58'],
    defaultCopy: ({ recipientName, senderName }) => ({
      eyebrow: 'Merry Christmas · Đêm đông ấm áp',
      title: `Giáng sinh an lành nhé ${recipientName}`,
      message: `Giáng sinh này chẳng ước điều gì cầu kỳ, chỉ mong trời se lạnh luôn có bàn tay ấm của ${recipientName} đan chặt. Ở gần nhau thêm chút nữa nhé.`,
      signature: `Món quà Noel của bạn — ${senderName}.`,
      coverText: 'Cào lớp tuyết lạnh để nhận hơi ấm Giáng sinh',
    }),
  },
] as const;

const BUILTIN_BY_KEY = new Map<string, BuiltinOccasionMeta>(
  BUILTIN_OCCASIONS.map((item) => [item.key, item]),
);

export function getCalendarDate(value: Date | string, timeZone = VIETNAM_TIMEZONE): CalendarDate {
  if (typeof value === 'string') {
    const plain = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (plain) {
      return {
        year: Number(plain[1]),
        month: Number(plain[2]),
        day: Number(plain[3]),
      };
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
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value || 0);
  return { year: get('year'), month: get('month'), day: get('day') };
}

export function getLunarCalendarDate(date: Date, timeZone = VIETNAM_TIMEZONE): LunarCalendarDate | null {
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-chinese', {
      timeZone,
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(date);
    const monthRaw = parts.find((p) => p.type === 'month')?.value ?? '';
    const dayRaw = parts.find((p) => p.type === 'day')?.value ?? '';
    const month = Number.parseInt(monthRaw, 10);
    const day = Number.parseInt(dayRaw, 10);
    if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
    const isLeapMonth = /bis|leap/i.test(monthRaw);
    return { month, day, isLeapMonth };
  } catch {
    return null;
  }
}

export function toDateKey(date: CalendarDate): string {
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

export function dayDifference(start: CalendarDate, end: CalendarDate): number {
  const startUtc = Date.UTC(start.year, start.month - 1, start.day);
  const endUtc = Date.UTC(end.year, end.month - 1, end.day);
  return Math.floor((endUtc - startUtc) / 86_400_000);
}

export function calculateAgeOnDate(birthday: string | null | undefined, today: CalendarDate): number | undefined {
  if (!birthday) return undefined;
  const birth = getCalendarDate(birthday);
  if (!birth.year) return undefined;
  let age = today.year - birth.year;
  if (today.month < birth.month || (today.month === birth.month && today.day < birth.day)) {
    age -= 1;
  }
  return age >= 0 && age <= 130 ? age : undefined;
}

export function isSameMonthDay(left: CalendarDate, right: CalendarDate): boolean {
  return left.month > 0 && left.day > 0 && left.month === right.month && left.day === right.day;
}

function matchesCustomSchedule(row: OccasionCardRow, today: CalendarDate, todayKey: string): boolean {
  if (!row.enabled || !row.custom_date) return false;
  const raw = row.custom_date.trim();
  if (row.schedule_type === 'once') {
    return raw.slice(0, 10) === todayKey;
  }
  if (row.schedule_type === 'annual') {
    const mmdd = raw.length >= 10 ? raw.slice(5, 10) : raw;
    const expected = `${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`;
    return mmdd === expected;
  }
  return false;
}

function normalizeColors(rawJson: string | null, fallback: [string, string, string]): [string, string, string] {
  const parsed = parseJsonSafe<unknown>(rawJson, null);
  if (
    Array.isArray(parsed)
    && parsed.length === 3
    && parsed.every((item) => typeof item === 'string' && item.trim().length > 0)
  ) {
    return [parsed[0], parsed[1], parsed[2]];
  }
  return fallback;
}

function buildMergedCard(
  meta: BuiltinOccasionMeta | null,
  customRow: OccasionCardRow | undefined,
  ctx: {
    recipientName: string;
    senderName: string;
    recipientAge?: number;
    yearsTogether: number;
  },
): ResolvedOccasionCardDto {
  const fallbackColors: [string, string, string] = meta?.colors ?? ['#ff8fb1', '#ff4d88', '#8a2148'];
  const defaults = meta
    ? meta.defaultCopy(ctx)
    : {
        eyebrow: 'Món quà bất ngờ dành riêng bạn',
        title: customRow?.occasion_label || `Gửi ${ctx.recipientName} thương yêu`,
        message: `Một lời nhắn nhỏ bí mật từ ${ctx.senderName} gửi đến ${ctx.recipientName} hôm nay.`,
        signature: `Thương nhiều — ${ctx.senderName}.`,
        coverText: 'Cào nhẹ để mở bí mật người ấy gửi bạn',
      };

  const occasionKey = customRow?.occasion_key ?? meta?.key ?? 'custom';
  const occasionLabel = customRow?.occasion_label?.trim() || meta?.label || 'Ngày đặc biệt';
  const scratchCoverUrl = customRow?.scratch_cover_url ?? undefined;
  const backgroundImageUrl = customRow?.background_image_url ?? undefined;

  return {
    id: occasionKey,
    occasionKey,
    occasionLabel,
    eyebrow: customRow?.eyebrow?.trim() || defaults.eyebrow,
    title: customRow?.title?.trim() || defaults.title,
    message: customRow?.message?.trim() || defaults.message,
    signature: customRow?.signature?.trim() || defaults.signature,
    coverText: customRow?.cover_text?.trim() || defaults.coverText,
    icon: meta?.icon ?? 'gift',
    pattern: (customRow?.pattern as OccasionPattern | null) || meta?.pattern || 'hearts',
    colors: normalizeColors(customRow?.colors_json ?? null, fallbackColors),
    templateId: customRow?.template_id ?? undefined,
    coverImage: scratchCoverUrl || meta?.coverImage,
    scratchCoverUrl,
    backgroundImageUrl,
    senderName: ctx.senderName,
    isCustomized: Boolean(
      customRow && (
        customRow.title?.trim()
        || customRow.message?.trim()
        || customRow.signature?.trim()
        || customRow.cover_text?.trim()
        || customRow.scratch_cover_url
        || customRow.background_image_url
        || customRow.template_id
      ),
    ),
  };
}

export function resolveRecipientCardForDate(params: {
  recipient: Pick<UserRow, 'display_name' | 'partner_name' | 'birthday'>;
  sender?: Pick<UserRow, 'display_name' | 'partner_birthday'> | null;
  couple?: Pick<CoupleRow, 'love_start_date'> | null;
  senderCards: OccasionCardRow[];
  now?: Date;
}): ResolvedOccasionCardDto | null {
  const now = params.now ?? new Date();
  const today = getCalendarDate(now);
  const todayKey = toDateKey(today);
  const lunar = getLunarCalendarDate(now);

  const recipientName = params.recipient.display_name || 'bạn';
  const senderName = params.sender?.display_name || params.recipient.partner_name || 'người ấy';
  const recipientBirthday = params.recipient.birthday || params.sender?.partner_birthday || null;

  const start = params.couple?.love_start_date ? getCalendarDate(params.couple.love_start_date) : undefined;
  const daysTogether = start && start.year ? Math.max(0, dayDifference(start, today)) : 0;
  const yearsTogether =
    start && start.year && isSameMonthDay(start, today) ? Math.max(0, today.year - start.year) : 0;

  const copyCtx = {
    recipientName,
    senderName,
    recipientAge: calculateAgeOnDate(recipientBirthday, today),
    yearsTogether,
  };

  const byKey = new Map<string, OccasionCardRow>();
  for (const row of params.senderCards) {
    byKey.set(row.occasion_key, row);
  }

  // 1) Custom date cards authored by partner take top priority
  const matchingCustom = params.senderCards.find(
    (row) => row.kind === 'custom' && matchesCustomSchedule(row, today, todayKey),
  );
  if (matchingCustom) {
    return buildMergedCard(null, matchingCustom, copyCtx);
  }

  // Helper to resolve a builtin key honoring sender enable/disable & gender flag
  const resolveBuiltin = (key: string): ResolvedOccasionCardDto | null => {
    const meta = BUILTIN_BY_KEY.get(key);
    if (!meta) return null;
    const row = byKey.get(key);
    if (meta.genderSpecific) {
      if (!row || row.enabled !== 1) return null;
      return buildMergedCard(meta, row, copyCtx);
    }
    if (row && row.enabled === 0) return null;
    return buildMergedCard(meta, row, copyCtx);
  };

  // 2) Recipient's own Birthday (fixed from previous inverted partnerBirthday bug!)
  if (recipientBirthday && isSameMonthDay(getCalendarDate(recipientBirthday), today)) {
    const bdayCard = resolveBuiltin('birthday');
    if (bdayCard) return bdayCard;
  }

  // 3) Love Milestones
  if (daysTogether === 100) {
    const c = resolveBuiltin('day-100');
    if (c) return c;
  }
  if (daysTogether === 500) {
    const c = resolveBuiltin('day-500');
    if (c) return c;
  }
  if (daysTogether === 1000) {
    const c = resolveBuiltin('day-1000');
    if (c) return c;
  }
  if (yearsTogether >= 1) {
    const c = resolveBuiltin('anniversary');
    if (c) return c;
  }

  // 4) Lunar Vietnamese Holidays
  if (lunar && !lunar.isLeapMonth) {
    for (const meta of BUILTIN_OCCASIONS) {
      if (meta.lunar && meta.lunar[0] === lunar.month && meta.lunar[1] === lunar.day) {
        const c = resolveBuiltin(meta.key);
        if (c) return c;
      }
    }
  }

  // 5) Solar Vietnamese & Couple Holidays
  for (const meta of BUILTIN_OCCASIONS) {
    if (meta.solar && meta.solar[0] === today.month && meta.solar[1] === today.day) {
      const c = resolveBuiltin(meta.key);
      if (c) return c;
    }
  }

  return null;
}

export interface UpcomingOccasionDto {
  daysLeft: number;
  dateKey: string;
  label: string;
  isSecretSurprise: boolean;
}

export function computeUpcomingRecipientOccasion(params: {
  recipient: Pick<UserRow, 'display_name' | 'partner_name' | 'birthday'>;
  sender?: Pick<UserRow, 'display_name' | 'partner_birthday'> | null;
  couple?: Pick<CoupleRow, 'love_start_date'> | null;
  senderCards: OccasionCardRow[];
  now?: Date;
}): UpcomingOccasionDto | null {
  const base = params.now ?? new Date();
  for (let offset = 1; offset <= 366; offset += 1) {
    const probe = new Date(base.getTime() + offset * 86_400_000);
    const resolved = resolveRecipientCardForDate({
      ...params,
      now: probe,
    });
    if (resolved) {
      const isCustom = resolved.occasionKey.startsWith('custom-') || !BUILTIN_BY_KEY.has(resolved.occasionKey);
      return {
        daysLeft: offset,
        dateKey: toDateKey(getCalendarDate(probe)),
        // Never spoil custom title/date topic before unlock day!
        label: isCustom ? 'Một bí mật bất ngờ từ người ấy' : resolved.occasionLabel,
        isSecretSurprise: isCustom,
      };
    }
  }
  return null;
}
