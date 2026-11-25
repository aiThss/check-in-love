# AUDIT UI hiện tại — Check IN Love PWA (P0)

Số liệu đo bằng đọc mã ngày 2026-11-26 (script đếm trên `apps/pwa/src`). Con số "ước lượng" nghĩa là heuristic, cần xác nhận khi làm P1.

## 1. Nợ kỹ thuật (đo được)

| Hạng mục | Số liệu | Hệ quả |
|---|---|---|
| `!important` trong CSS | **287** (auth-interaction-vibe 168, components 75, love-journey 31, polaroid 5, layout-fix 4, animations 3, thread-enh 1) | Không thể override sạch; thứ tự file quyết định giao diện |
| `backdrop-filter` | **83** chỗ (components 32, love-journey 14, polaroid 12, auth 11, layout-fix 8, thread-enh 4, viewer 2) | Rất nặng trên WebView Android tầm trung, dễ tụt khung hình |
| `transition: all` | 18 | Animate cả layout/paint, tốn pin, dễ giật |
| `font-size` < 12px | 61 khai báo | Khó đọc, vi phạm cỡ chữ tối thiểu |
| Khai báo width/height 20–43px trong `components.css` | 93 (ước lượng) | Nhiều khả năng tap target < 44px |
| Màu hex cứng trong TS (`main.ts`, pages, components, utils) | 124 | Theme/accent picker không thể hoạt động |
| `style="..."` inline trong pages/components | 202 | Không theme được, khó bảo trì |
| File tiêm/vá DOM sau render (có `MutationObserver`) | 8 (`anniversary-cards`, `auth-focus-scroll`, `message-reply-gesture` ×2, `message-sticker-input`, `message-thread-enhancements`, `profile-copyright`, `profile-ui-cleanup`) | Render hai lần, dễ vỡ khi đổi markup |
| CSS `@media (prefers-reduced-motion)` | `love-journey.css` 0, `message-thread-enhancements.css` 0, `auth` 1, `components` 5 | Chưa tôn trọng giảm chuyển động nhất quán |
| `components.css` | 5.785 dòng, một file | Cần chia lớp |

## 2. Hiệu năng / hạ tầng

- `love-journey` chunk **1.086 MB** (gzip 297 KB) do MapLibre; chunk `index` 150 KB (gzip 46 KB). Chỉ tải khi vào Love Journey (đã code-split).
- `index.html` tải **Google Fonts (Inter)** và **`unpkg.com/@lottiefiles/lottie-player@latest`** đồng bộ: chặn render, không pin version, phụ thuộc CDN ngoài.
- `sw.js` tham chiếu `/offline.html` nhưng file **không tồn tại** trong `apps/pwa/public` → nhánh offline fallback không hoạt động.
- `<meta name="theme-color">` cố định `#FF3B7F`, không đổi theo theme sáng/tối.
- Manifest chưa có `shortcuts`, `screenshots`, icon `maskable` riêng (đang `any maskable` chung 1 file 512).

## 3. UX/UI

| Vấn đề | Chỗ | Ghi chú |
|---|---|---|
| Nav dùng emoji 🏠📸💬 + ảnh `user.png` | `components/nav.ts` | Không đồng nhất nét, không tô được theo accent, render khác nhau giữa iOS/Android |
| Icon trộn nhiều nguồn: emoji, icons8 png/gif/json, SVG rời | pages, components | Không có ngôn ngữ hình ảnh thống nhất |
| Nút check-in trung tâm là dấu `+` chung chung | `nav.ts` | Không nói lên hành động "chụp khoảnh khắc đôi" |
| Glass phủ khắp nơi | 83 chỗ | Mất phân cấp (cái gì nổi, cái gì chìm), nặng máy |
| Spacing/typography rời rạc | rải trong các file CSS vá | Không có scale |
| Mã màu accent `#ff3b7f` trên nền trắng | `--accent` | **≈3,4:1** → không đạt AA cho chữ nhỏ/nút chữ trắng (cần ≥4,5:1) |
| Chữ phụ `--text-tertiary` `#987783` trên `#f8e2e7` | tokens.css | **≈3,3:1** (tính tay, cần xác nhận bằng test) |
| Chat: logic dồn ở `messages.ts` (79 KB) + 2 file vá layout | pages/messages | Khó thêm nhóm tin, trạng thái gửi, virtualize |

Mock đã sửa hai điểm tương phản bằng `--accent-strong #d9205f/#dd2468/#e0246a` (≥4,5:1 với chữ trắng) cho nút/chữ, giữ `#ff3b7f` cho trang trí và vùng lớn.

## 4. Đã có sẵn, nên giữ

- Router có history boundary/layer cho nút Back Android; `route-invalidation`; `query-cache` (SWR); outbox IndexedDB cho tin offline; SSE + FCM + WebPush; share-target; test hành vi (128 test pass).
- Be Vietnam Pro đã có trong Android res (dùng cho font body tiếng Việt).

## 5. Việc chưa làm trong P0 (ghi rõ để không bị hiểu nhầm)

- **Chưa chụp screenshot baseline của app thật** (cần đăng nhập/dữ liệu mock + trình duyệt tự động). Làm ở đầu P1 bằng `lovecheck_dev_preview_data` (xem `src/dev/mock-data.ts`).
- **Chưa đo Lighthouse mobile baseline.** Chỉ có baseline test/build/bundle (xem `metrics.md`).
