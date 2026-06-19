import type { MoodType, RandomCategory, ReactionType } from './types';

// ─── Mood Labels ─────────────────────────────────────────────────────────────

export const MOOD_LABELS: Record<MoodType, { emoji: string; label: string }> = {
  happy:    { emoji: '😊', label: 'Đang vui' },
  miss:     { emoji: '🥺', label: 'Đang nhớ' },
  tired:    { emoji: '😴', label: 'Mệt rồi' },
  studying: { emoji: '📚', label: 'Đang học' },
  out:      { emoji: '🚶', label: 'Đang đi chơi' },
  eating:   { emoji: '🍜', label: 'Đang ăn' },
  needhug:  { emoji: '🤗', label: 'Cần ôm' },
};

// ─── Quick Messages ───────────────────────────────────────────────────────────

export const QUICK_MESSAGES = [
  'Nhớ em/anh quá 🥺',
  'Ôm cái nào 🤗',
  'Đang làm gì đó? 🤔',
  'Gửi tim nè ❤️',
  'Đang nghĩ đến em/anh đây 💭',
  'Chúc ngủ ngon nha 🌙',
  'Ăn chưa bé? 🍱',
  'Yêu em/anh nhiều lắm 💕',
] as const;

// ─── Reactions ────────────────────────────────────────────────────────────────

export const REACTION_LABELS: Record<ReactionType, { emoji: string; label: string }> = {
  heart: { emoji: '❤️', label: 'Tim' },
  hug:   { emoji: '🤗', label: 'Ôm' },
  kiss:  { emoji: '💋', label: 'Hôn' },
  laugh: { emoji: '😂', label: 'Cười' },
  miss:  { emoji: '🥺', label: 'Nhớ' },
};

// ─── Random Categories ────────────────────────────────────────────────────────

export const RANDOM_CATEGORIES: Record<RandomCategory, { icon: string; label: string; description: string }> = {
  questions: { icon: '💬', label: 'Câu hỏi đôi mình', description: 'Khám phá nhau hơn mỗi ngày' },
  snap:      { icon: '📸', label: 'Thử thách snap',   description: 'Chụp một khoảnh khắc ngay bây giờ' },
  today:     { icon: '☀️', label: 'Hôm nay làm gì',   description: 'Kế hoạch nhỏ cho ngày của hai đứa' },
  food:      { icon: '🍜', label: 'Ăn gì bây giờ',    description: 'Không biết ăn gì để tụi mình quyết cho' },
  universe:  { icon: '✨', label: 'Tín hiệu vũ trụ',  description: 'Vũ trụ muốn nhắn gì với hai đứa hôm nay' },
};

// ─── Random Prompts (tiếng Việt) ─────────────────────────────────────────────

export const RANDOM_PROMPTS: Record<RandomCategory, Array<{ prompt: string; detail?: string }>> = {
  questions: [
    { prompt: 'Hôm nay có điều gì nhỏ xíu làm em/anh vui không?', detail: 'Kể cho nhau nghe nhé, dù là chi tiết nhỏ nhất.' },
    { prompt: 'Nếu hôm nay được làm một điều ước, em/anh ước gì?', detail: 'Không giới hạn, cứ ước thôi.' },
    { prompt: 'Điều gì em/anh thích nhất ở người ấy trong 1 tuần qua?', detail: 'Nói ra đi, người ấy cần nghe đấy.' },
    { prompt: 'Mô tả ngày hôm nay bằng một màu sắc. Tại sao?', detail: 'Không cần lý do logic, cứ cảm nhận.' },
    { prompt: 'Nếu mình được đi chơi cùng nhau ngay lúc này, em/anh muốn đến đâu?', detail: 'Đặt kế hoạch nhỏ đi nào.' },
    { prompt: 'Kỷ niệm nào của hai đứa em/anh hay nhớ nhất?', detail: 'Kể lại đi, nghe thấy ấm lòng lắm.' },
    { prompt: 'Nếu cuộc sống của mình là một bộ phim, đoạn này sẽ là cảnh gì?', detail: 'Lãng mạn, hành động hay hài hước?' },
    { prompt: '3 điều em/anh biết ơn hôm nay là gì?', detail: 'Chia sẻ với người ấy nhé.' },
    { prompt: 'Hôm nay em/anh cảm thấy thế nào trong một câu?', detail: 'Thành thật nhất có thể.' },
    { prompt: 'Điều gì đang làm em/anh lo lắng? Người ấy có thể giúp không?', detail: 'Đừng một mình gánh mọi thứ.' },
  ],
  snap: [
    { prompt: 'Chụp một thứ đang ở ngay bên trái bạn.', detail: 'Trong 10 giây, chụp ngay đi!' },
    { prompt: 'Gửi một snap với biểu cảm đáng yêu nhất trong 3 giây.', detail: 'Không được giả vờ, phải tự nhiên nha.' },
    { prompt: 'Chụp bầu trời ngay lúc này.', detail: 'Người ấy muốn thấy bầu trời phía em/anh đấy.' },
    { prompt: 'Chụp đôi bàn tay của bạn.', detail: 'Bàn tay đang cầm gì, đang làm gì?' },
    { prompt: 'Selfie ngay lúc này, không được chỉnh sửa gì.', detail: 'Tự nhiên thôi, người ấy yêu em/anh mà.' },
    { prompt: 'Chụp một góc yêu thích trong phòng của bạn.', detail: 'Nơi em/anh hay ngồi nhất là đâu?' },
    { prompt: 'Chụp thứ gì đó có màu hồng quanh bạn.', detail: 'Tìm nhanh lên nào!' },
    { prompt: 'Chụp màn hình điện thoại đang mở app gì (trừ app này).', detail: 'Đang lướt gì thế? 👀' },
  ],
  today: [
    { prompt: 'Hôm nay hãy nói một câu nhẹ nhàng với người ấy trước khi ngủ.', detail: 'Đừng để một ngày trôi qua mà không nói yêu.' },
    { prompt: 'Gửi cho nhau một bài hát đang nghe.', detail: 'Nhạc nói thay cảm xúc đôi khi.' },
    { prompt: 'Ăn cùng nhau qua video call một bữa hôm nay.', detail: 'Dù xa cũng có thể ăn cùng nhau.' },
    { prompt: 'Viết cho nhau 3 điều biết ơn trong ngày.', detail: 'Bắt đầu từ những điều nhỏ nhất.' },
    { prompt: 'Hẹn giờ gọi video 15 phút ngay hôm nay.', detail: 'Không cần nói gì nhiều, nhìn nhau thôi cũng được.' },
    { prompt: 'Cùng xem một tập phim hoặc video YouTube cùng lúc.', detail: 'Sync cùng giờ và react cho nhau nghe.' },
    { prompt: 'Đặt một mục tiêu nhỏ cho hai đứa trong tuần này.', detail: 'Nhỏ thôi, làm được là vui rồi.' },
  ],
  food: [
    { prompt: 'Mì tôm hay cơm chiều nay?', detail: 'Bỏ phiếu đi, hai đứa cùng ăn một thứ nhé.' },
    { prompt: 'Nếu hôm nay được ăn bất cứ thứ gì, em/anh chọn gì?', detail: 'Không giới hạn ngân sách, cứ mơ thôi.' },
    { prompt: 'Gợi ý cho nhau một món ăn mà mình hay ăn lúc stress.', detail: 'Food therapy thật sự hiệu quả đấy.' },
    { prompt: 'Nếu nấu ăn cho người ấy, em/anh sẽ nấu gì?', detail: 'Kể công thức đi, có khi làm thật luôn.' },
    { prompt: 'Tối nay ăn gì? Bốc thăm: bún bò, phở, cơm tấm, bánh mì.', detail: 'Thứ đầu tiên nghĩ đến là ăn thứ đó.' },
    { prompt: 'Món ăn nào nhắc em/anh nhớ đến người ấy?', detail: 'Mọi ký ức đều gắn với một mùi vị.' },
  ],
  universe: [
    { prompt: 'Vũ trụ nói: Hôm nay hãy gửi cho người ấy một tin nhắn bất ngờ.', detail: 'Đừng hỏi gì, cứ nhắn đi thôi.' },
    { prompt: 'Năng lượng hôm nay của bạn là 7/10. Làm gì để lên 10?', detail: 'Người ấy có thể giúp không?' },
    { prompt: 'Vũ trụ sắp xếp: tuần này hai đứa sẽ có một điều tốt lành.', detail: 'Tin vào điều đó đi nào.' },
    { prompt: 'Hôm nay là ngày tốt để nói ra điều em/anh chưa dám nói.', detail: 'Dù nhỏ hay lớn, cứ thật lòng.' },
    { prompt: 'Vũ trụ hỏi: Em/anh có đang chăm sóc bản thân đủ không?', detail: 'Người ấy cũng muốn em/anh ổn đấy.' },
    { prompt: 'Điềm lành hôm nay: Bạn sẽ nhận được một nụ cười từ người ấy.', detail: 'Hãy tạo ra nó đi.' },
    { prompt: 'Vũ trụ thì thầm: Bạn đang được yêu nhiều hơn bạn nghĩ.', detail: 'Nhớ điều đó nhé.' },
  ],
};

// ─── Error Codes ─────────────────────────────────────────────────────────────

export const ERROR_CODES = {
  // Auth
  UNAUTHORIZED:       'UNAUTHORIZED',
  FORBIDDEN:          'FORBIDDEN',
  INVALID_CREDENTIALS:'INVALID_CREDENTIALS',
  USER_BLOCKED:       'USER_BLOCKED',
  COUPLE_NOT_FOUND:   'COUPLE_NOT_FOUND',
  USER_NOT_FOUND:     'USER_NOT_FOUND',
  COUPLE_FULL:        'COUPLE_FULL',
  // Validation
  VALIDATION_ERROR:   'VALIDATION_ERROR',
  INVALID_FILE_TYPE:  'INVALID_FILE_TYPE',
  FILE_TOO_LARGE:     'FILE_TOO_LARGE',
  // Checkin
  CHECKIN_NOT_FOUND:  'CHECKIN_NOT_FOUND',
  // Server
  INTERNAL_ERROR:     'INTERNAL_ERROR',
  RATE_LIMITED:       'RATE_LIMITED',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
