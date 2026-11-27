import type { IconName } from '../ui/icons/icons';

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

export type BuiltinOccasionKey =
  | 'birthday'
  | 'anniversary'
  | 'day-100'
  | 'day-500'
  | 'day-1000'
  | 'new-year'
  | 'lunar-new-year'
  | 'valentine'
  | 'womens-day'
  | 'white-day'
  | 'reunification-holiday'
  | 'childrens-day'
  | 'vietnam-family-day'
  | 'that-tich'
  | 'national-day'
  | 'mid-autumn'
  | 'vietnamese-womens-day'
  | 'mens-day'
  | 'vietnam-culture-day'
  | 'christmas';

export type OccasionCardId = BuiltinOccasionKey | string;

export interface CardTemplatePreset {
  id: string;
  deckIndex: number;
  deckTitle: string;
  name: string;
  subtitle: string;
  badge: string;
  icon: IconName;
  pattern: OccasionPattern;
  colors: [string, string, string];
}

export const CARD_TEMPLATE_DECKS: readonly CardTemplatePreset[] = [
  // Deck 0: Bộ Lãng Mạn Kinh Điển
  {
    id: 'rose-letter',
    deckIndex: 0,
    deckTitle: 'Lãng Mạn Kinh Điển',
    name: 'Thư Hồng Cổ Điển',
    subtitle: 'Giấy kem ấm & trái tim rơi',
    badge: 'Ngọt ngào',
    icon: 'heart-burst',
    pattern: 'hearts',
    colors: ['#ff8fb1', '#ff5f8f', '#9f3564'],
  },
  {
    id: 'velvet-valentine',
    deckIndex: 0,
    deckTitle: 'Lãng Mạn Kinh Điển',
    name: 'Nhung Đỏ Tình Nhân',
    subtitle: 'Sắc hồng nhung & cánh hoa',
    badge: 'Nồng nàn',
    icon: 'mail',
    pattern: 'petals',
    colors: ['#ff839d', '#e43d68', '#8a2148'],
  },
  {
    id: 'honey-anniversary',
    deckIndex: 0,
    deckTitle: 'Lãng Mạn Kinh Điển',
    name: 'Mật Ong Kỷ Niệm',
    subtitle: 'Ánh vàng cổ điển sang trọng',
    badge: 'Kỷ vật',
    icon: 'anniversary',
    pattern: 'petals',
    colors: ['#f6c86f', '#e9965b', '#9b5a42'],
  },
  // Deck 1: Bộ Lễ Hội & Sắc Việt
  {
    id: 'tet-crimson',
    deckIndex: 1,
    deckTitle: 'Lễ Hội & Sắc Việt',
    name: 'Lụa Đỏ Phố Hội',
    subtitle: 'Đỏ son ánh kim & lồng đèn',
    badge: 'Sắc Việt',
    icon: 'sparkle',
    pattern: 'lanterns',
    colors: ['#ffd166', '#e63946', '#780000'],
  },
  {
    id: 'moonlight-autumn',
    deckIndex: 1,
    deckTitle: 'Lễ Hội & Sắc Việt',
    name: 'Ánh Trăng Đêm Thu',
    subtitle: 'Vàng trăng rằm ấm áp',
    badge: 'Đoàn viên',
    icon: 'moon',
    pattern: 'lanterns',
    colors: ['#ffe66d', '#ff9f1c', '#6f1d1b'],
  },
  {
    id: 'sunshine-party',
    deckIndex: 1,
    deckTitle: 'Lễ Hội & Sắc Việt',
    name: 'Pháo Hoa Rực Rỡ',
    subtitle: 'Cam đào & pháo giấy mừng tuổi',
    badge: 'Rộn ràng',
    icon: 'gift',
    pattern: 'confetti',
    colors: ['#ffd66e', '#ff9c64', '#d94b78'],
  },
  // Deck 2: Bộ Tinh Vân & Sương Mai
  {
    id: 'starlight-night',
    deckIndex: 2,
    deckTitle: 'Tinh Vân & Sương Mai',
    name: 'Tinh Vân Ngàn Sao',
    subtitle: 'Xanh đêm đầy sao lấp lánh',
    badge: 'Huyền ảo',
    icon: 'star',
    pattern: 'stars',
    colors: ['#72d7ff', '#5d7df3', '#35408d'],
  },
  {
    id: 'lavender-ribbon',
    deckIndex: 2,
    deckTitle: 'Tinh Vân & Sương Mai',
    name: 'Lụa Tím Chiều Tà',
    subtitle: 'Dải ruy băng tím mộng mơ',
    badge: 'Dịu êm',
    icon: 'sparkle',
    pattern: 'ribbons',
    colors: ['#d7a8ff', '#9c66db', '#5b338d'],
  },
  {
    id: 'winter-emerald',
    deckIndex: 2,
    deckTitle: 'Tinh Vân & Sương Mai',
    name: 'Tuyết Ngọc Đêm Đông',
    subtitle: 'Xanh ngọc bích & bông tuyết',
    badge: 'Trong trẻo',
    icon: 'gift',
    pattern: 'snow',
    colors: ['#9be3d2', '#3aa58f', '#1d5e58'],
  },
] as const;

export interface OccasionCatalogEntry {
  key: BuiltinOccasionKey;
  label: string;
  dateBadge: string;
  category: 'milestone' | 'lunar' | 'vietnam';
  genderSpecific?: boolean;
  icon: IconName;
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

export const OCCASION_CATALOG: readonly OccasionCatalogEntry[] = [
  {
    key: 'birthday',
    label: 'Sinh nhật người ấy',
    dateBadge: 'Theo ngày sinh đã lưu',
    category: 'milestone',
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
    key: 'lunar-new-year',
    label: 'Tết Nguyên Đán',
    dateBadge: 'Mùng 1 Tết Âm lịch',
    category: 'lunar',
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
    key: 'that-tich',
    label: 'Lễ Thất Tịch',
    dateBadge: '07/07 Âm lịch',
    category: 'lunar',
    lunar: [7, 7],
    icon: 'sparkle',
    pattern: 'stars',
    colors: ['#cdb4db', '#9d4edd', '#3c096c'],
    defaultCopy: ({ recipientName, senderName }) => ({
      eyebrow: 'Mùng 7 tháng 7 Âm lịch · Thất Tịch',
      title: 'Mưa Ngâu có nhau chẳng sợ xa',
      message: `Người ta ăn chè đậu đỏ để cầu duyên, còn ${senderName} ăn cùng ${recipientName} để giữ duyên mình bền chặt thêm nhiều mùa Thất Tịch nữa.`,
      signature: `Duyên lành của ${senderName}.`,
      coverText: 'Cào mở điều ước đêm mưa Thất Tịch',
    }),
  },
  {
    key: 'mid-autumn',
    label: 'Tết Trung Thu',
    dateBadge: 'Rằm tháng 8 Âm lịch',
    category: 'lunar',
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
    key: 'new-year',
    label: 'Tết Dương lịch',
    dateBadge: '01 tháng 01',
    category: 'vietnam',
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
    key: 'valentine',
    label: 'Lễ Tình nhân (Valentine)',
    dateBadge: '14 tháng 02',
    category: 'vietnam',
    solar: [2, 14],
    icon: 'mail',
    pattern: 'hearts',
    colors: ['#ff839d', '#e43d68', '#8a2148'],
    defaultCopy: ({ recipientName, senderName }) => ({
      eyebrow: '14 tháng 2 · Mùa yêu',
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
    key: 'national-day',
    label: 'Kỳ nghỉ Quốc khánh 2/9',
    dateBadge: '02 tháng 09',
    category: 'vietnam',
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
    key: 'vietnamese-womens-day',
    label: 'Phụ nữ Việt Nam 20/10',
    dateBadge: '20 tháng 10',
    category: 'vietnam',
    genderSpecific: true,
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

export function getLunarMonthDay(date: Date, timeZone = VIETNAM_TIMEZONE): { month: number; day: number; isLeapMonth: boolean } | null {
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
    return { month, day, isLeapMonth: /bis|leap/i.test(monthRaw) };
  } catch {
    return null;
  }
}
