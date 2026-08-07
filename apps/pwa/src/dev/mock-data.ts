import type {
  ChatMessage,
  CheckIn,
  Couple,
  RandomCategory,
  RandomHistoryItem,
  User,
} from '../api/types';

export const MOCK_PREVIEW_TOKEN = 'mock_preview_token';
const MOCK_DATA_KEY = 'lovecheck_dev_preview_data';
const MOCK_DATA_VERSION = 2;

export interface MockPreviewData {
  version: number;
  user: User;
  partnerUser: User;
  couple: Couple;
  checkins: CheckIn[];
  messages: ChatMessage[];
  categories: RandomCategory[];
  randomHistory: RandomHistoryItem[];
}

export interface MockPreviewOverrides {
  displayName?: string;
  partnerName?: string;
  coupleCode?: string;
  loveStartDate?: string;
  email?: string;
}

function svgData(label: string, start: string, end: string): string {
  const safeLabel = label.replace(/[<&>]/g, (character) => ({
    '<': '&lt;',
    '&': '&amp;',
    '>': '&gt;',
  })[character] ?? character);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${start}"/><stop offset="1" stop-color="${end}"/>
      </linearGradient></defs>
      <rect width="640" height="640" rx="80" fill="url(#g)"/>
      <circle cx="110" cy="120" r="72" fill="#fff" opacity=".2"/>
      <circle cx="540" cy="520" r="120" fill="#fff" opacity=".12"/>
      <text x="320" y="350" text-anchor="middle" font-family="Arial,sans-serif" font-size="92" font-weight="700" fill="#fff">${safeLabel}</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function minutesAgo(now: number, minutes: number): string {
  return new Date(now - minutes * 60_000).toISOString();
}

function buildMockData(overrides: MockPreviewOverrides = {}): MockPreviewData {
  const now = Date.now();
  const userId = 'mock_user_1';
  const partnerId = 'mock_user_2';
  const coupleId = 'mock_couple_1';
  const displayName = overrides.displayName?.trim() || 'Danh Thái';
  const partnerName = overrides.partnerName?.trim() || 'Phương Trang';
  const code = (overrides.coupleCode?.trim() || 'LOVE2026').toUpperCase();
  const avatarUrl = svgData('DT', '#ff6b9d', '#9c5bda');
  const partnerAvatarUrl = svgData('PT', '#ffb36b', '#ee5b8f');
  const firstPhoto = svgData('💕', '#ff8fb7', '#8b5cf6');
  const secondPhoto = svgData('☕', '#f6b76f', '#d55d8b');
  const thirdPhoto = svgData('🌸', '#f7a8c4', '#7a68c7');

  const user: User = {
    id: userId,
    displayName,
    partnerName,
    email: overrides.email?.trim() || 'danhthai4560@gmail.com',
    avatarUrl,
    partnerAvatarUrl,
    deviceId: 'mock-device-local',
    coupleId,
    createdAt: new Date(now - 45 * 86_400_000).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };

  const partnerUser: User = {
    id: partnerId,
    displayName: partnerName,
    partnerName: displayName,
    email: 'phuongtrang@example.local',
    avatarUrl: partnerAvatarUrl,
    partnerAvatarUrl: avatarUrl,
    deviceId: 'mock-device-partner',
    coupleId,
    createdAt: new Date(now - 45 * 86_400_000).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };

  const checkins: CheckIn[] = [
    {
      id: 'mock_checkin_1',
      userId: partnerId,
      coupleId,
      type: 'photo',
      photoUrl: firstPhoto,
      caption: 'Hôm nay vẫn nhớ bạn thật nhiều 💕',
      mood: 'love',
      reactions: [
        { type: '❤️', count: 3, reactedByMe: true },
        { type: '🥰', count: 1, reactedByMe: false },
      ],
      replies: [
        {
          userId,
          userName: displayName,
          message: 'Mình cũng nhớ bạn lắm 🥰',
          isOwn: true,
          createdAt: minutesAgo(now, 26),
        },
      ],
      ownerName: partnerName,
      ownerAvatarUrl: partnerAvatarUrl,
      isOwn: false,
      createdAt: minutesAgo(now, 42),
      updatedAt: minutesAgo(now, 26),
    },
    {
      id: 'mock_checkin_2',
      userId,
      coupleId,
      type: 'text',
      caption: 'Đã hoàn thành một ngày thật chăm chỉ ✨',
      mood: 'happy',
      reactions: [{ type: '🔥', count: 2, reactedByMe: false }],
      replies: [],
      ownerName: displayName,
      ownerAvatarUrl: avatarUrl,
      isOwn: true,
      createdAt: minutesAgo(now, 180),
      updatedAt: minutesAgo(now, 180),
    },
    {
      id: 'mock_checkin_3',
      replies: [
        {
          userId,
          userName: displayName,
          message: 'Mình muốn cùng bạn ngồi uống ly cà phê này ☕',
          isOwn: true,
          createdAt: minutesAgo(now, 1_418),
        },
      ],
      userId: partnerId,
      coupleId,
      type: 'photo',
      photoUrl: secondPhoto,
      caption: 'Một ly cà phê cho buổi chiều dịu dàng ☕',
      mood: 'calm',
      reactions: [{ type: '😘', count: 1, reactedByMe: true }],
      ownerName: partnerName,
      ownerAvatarUrl: partnerAvatarUrl,
      isOwn: false,
      createdAt: minutesAgo(now, 1_440),
      updatedAt: minutesAgo(now, 1_440),
    },
    {
      id: 'mock_checkin_4',
      userId,
      coupleId,
      type: 'photo',
      photoUrl: thirdPhoto,
      caption: 'Lưu lại một ngày bình thường nhưng thật đáng yêu 🌸',
      mood: 'happy',
      reactions: [],
      replies: [],
      ownerName: displayName,
      ownerAvatarUrl: avatarUrl,
      isOwn: true,
      createdAt: minutesAgo(now, 2_880),
      updatedAt: minutesAgo(now, 2_880),
    },
  ];

  const messages: ChatMessage[] = [
    {
      id: 'mock_message_1',
      coupleId,
      senderId: partnerId,
      senderName: partnerName,
      type: 'text',
      text: 'Tối nay mình cùng xem phim nhé?',
      isOwn: false,
      createdAt: minutesAgo(now, 34),
      updatedAt: minutesAgo(now, 34),
    },
    {
      id: 'mock_message_2',
      coupleId,
      senderId: userId,
      senderName: displayName,
      type: 'text',
      text: 'Được đó, bạn chọn phim đi 💕',
      isOwn: true,
      createdAt: minutesAgo(now, 31),
      updatedAt: minutesAgo(now, 31),
      replyTo: {
        messageId: 'mock_message_1',
        senderId: partnerId,
        senderName: partnerName,
        type: 'text',
        textSnippet: 'Tối nay mình cùng xem phim nhé?',
      },
    },
    {
      id: 'mock_message_3',
      coupleId,
      senderId: partnerId,
      senderName: partnerName,
      type: 'text',
      text: 'Nhớ ăn tối đúng giờ nha 🍲',
      isOwn: false,
      createdAt: minutesAgo(now, 12),
      updatedAt: minutesAgo(now, 12),
    },
    {
      id: 'mock_message_4',
      coupleId,
      senderId: userId,
      senderName: displayName,
      type: 'text',
      text: 'Mình cũng nhớ tấm ảnh này 💕',
      isOwn: true,
      referencedCheckin: {
        checkinId: 'mock_checkin_1',
        ownerId: partnerId,
        ownerName: partnerName,
        type: 'photo',
        caption: 'Hôm nay vẫn nhớ bạn thật nhiều 💕',
        mood: 'love',
        imageUrl: firstPhoto,
        createdAt: minutesAgo(now, 42),
      },
      createdAt: minutesAgo(now, 8),
      updatedAt: minutesAgo(now, 8),
    },
  ];

  const categories: RandomCategory[] = [
    { category: 'questions', icon: '❓', label: 'Câu hỏi', description: 'Hỏi đáp thấu hiểu', usageCount: 4 },
    { category: 'snap', icon: '📸', label: 'Chụp hình', description: 'Thử thách chụp ảnh', usageCount: 2 },
    { category: 'today', icon: '📅', label: 'Hôm nay', description: 'Hoạt động trong ngày', usageCount: 3 },
    { category: 'food', icon: '🍲', label: 'Món ăn', description: 'Hôm nay ăn gì', usageCount: 1 },
    { category: 'universe', icon: '🌌', label: 'Vũ trụ', description: 'Lời nhắn ngẫu nhiên', usageCount: 5 },
  ];

  const randomHistory: RandomHistoryItem[] = [
    {
      _id: 'mock_random_1',
      coupleId,
      userId: partnerId,
      category: 'questions',
      prompt: 'Điều nhỏ bé nào hôm nay làm bạn vui?',
      detail: 'Cùng kể cho nhau nghe một khoảnh khắc đáng yêu nhé.',
      createdAt: minutesAgo(now, 75),
    },
    {
      _id: 'mock_random_2',
      coupleId,
      userId,
      category: 'food',
      prompt: 'Tối nay thử món gì mới?',
      detail: 'Chọn một món cả hai chưa từng gọi cùng nhau.',
      createdAt: minutesAgo(now, 1_980),
    },
  ];

  return {
    version: MOCK_DATA_VERSION,
    user,
    partnerUser,
    couple: {
      id: coupleId,
      code,
      loveStartDate: overrides.loveStartDate || '2024-01-01',
      streak: 12,
      totalDays: 582,
      createdAt: new Date(now - 45 * 86_400_000).toISOString(),
    },
    checkins,
    messages,
    categories,
    randomHistory,
  };
}

export function isMockPreviewMode(): boolean {
  return localStorage.getItem('lovecheck_token') === MOCK_PREVIEW_TOKEN;
}

export function loadMockPreviewData(): MockPreviewData {
  try {
    const raw = localStorage.getItem(MOCK_DATA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MockPreviewData;
      if (parsed.version === MOCK_DATA_VERSION && parsed.user && parsed.couple && Array.isArray(parsed.checkins)) {
        return parsed;
      }
    }
  } catch {
    // Recreate malformed local preview data below.
  }

  const data = buildMockData();
  saveMockPreviewData(data);
  return data;
}

export function seedMockPreviewData(overrides: MockPreviewOverrides = {}): MockPreviewData {
  const data = buildMockData(overrides);
  saveMockPreviewData(data);
  return data;
}

export function saveMockPreviewData(data: MockPreviewData): void {
  try {
    localStorage.setItem(MOCK_DATA_KEY, JSON.stringify(data));
  } catch {
    // Keep the current in-memory request usable if storage is unavailable.
  }
}

export function clearMockPreviewData(): void {
  localStorage.removeItem(MOCK_DATA_KEY);
}
