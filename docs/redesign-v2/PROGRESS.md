# PROGRESS — Redesign v2 (chỉ THÊM cuối, không sửa dòng cũ)

Mẫu mỗi mục:
## <ngày giờ> — <phase> (<model/agent>)
- Làm: ...
- Commit: <hash> "<msg>"
- Kiểm: lint / test / build / `git diff --stat -- apps/api packages` rỗng
- Dở: <file + lý do>
- Bước tiếp: ...

---

## 2026-11-25 23:58 — Chuẩn bị (Claude Sonnet 5.5)
- Làm: khảo sát repo, chốt phạm vi và hướng làm với user, viết master prompt, tạo hệ thống log bàn giao.
- Kiểm: chưa chạy baseline test/build (việc đầu tiên của P0).
- Dở: chưa có.
- Bước tiếp: P0 theo HANDOFF.md mục 3.

### Snapshot tự động 2026-11-25 23:56
- Nhánh: main
- Commit cuối: 65924d3 fix(api,pwa): restore full NoSQL parity for messages, photo checkins, push/SSE, and optimize D1 queries
- File thay đổi chưa commit:
   M .agents/AGENTS.md
   M AGENTS.md
  ?? HANDOFF.md
  ?? docs/redesign-v2/
  ?? scripts/
- Diff apps/api + packages (phải rỗng): rỗng (OK)

## 2026-11-26 00:05 — P0 (Claude Sonnet 5.5)
- Làm: baseline test/lint/build; audit (audit.md); metrics (metrics.md); 3 mock HTML A/B/C + trang so sánh (DIRECTIONS.md, build-mocks.mjs, shots/ light+dark bằng Chrome headless). Đã sửa các lỗi layout phát hiện khi chụp (seg/dots xếp dọc, tile trống ở A, emoji trong UI thay bằng icon SVG).
- Kiểm: test 26 file/128 pass; build pass; git diff apps/api packages rỗng.
- Dở: chưa chụp screenshot baseline app thật, chưa chạy Lighthouse (làm đầu P1).
- Bước tiếp: CHỜ user chọn hướng thẩm mỹ rồi mới bắt đầu P1.

### Snapshot tự động 2026-11-26 00:03
- Nhánh: main
- Commit cuối: 8bf5388 docs: add AI handoff log system for Redesign v2
- File thay đổi chưa commit:
   M HANDOFF.md
   M docs/redesign-v2/PROGRESS.md
  ?? design/redesign-v2/
- Diff apps/api + packages (phải rỗng): rỗng (OK)

## 2026-11-26 00:10 — Chốt hướng (Claude Sonnet 5.5)
- Làm: user chọn MIX (A + kính B ở nav/sheet + nhãn vàng/micro-animation C + chat C). Thêm mock-mix.html + shots/mix-*.png vào build-mocks.mjs; bỏ animation vào khung tĩnh để ảnh chụp không bị mờ giữa chừng.
- Bước tiếp: P1 (tokens + alias, font tự host, theme/accent engine, icon system, component lib, /preview/ui).

## 2026-11-26 00:30 — P1 Nền tảng Design System v2 (Gemini)
- Làm:
  - Chụp 44 ảnh baseline WebP (`design/redesign-v2/baseline/`) + đo Web Vitals mobile (4x CPU, Fast 3G) ghi vào `metrics.md`.
  - Tự host 18 file `.woff2` (`Be Vietnam Pro` 400/500/600/700 + `Fraunces Variable` normal/italic, đủ tiếng Việt); bỏ Google Fonts & `unpkg lottie-player` trong `index.html`; thêm inline script chống nháy theme trước first paint.
  - Xây dựng kiến trúc CSS `@layer` (`00-fonts`, `00-tokens` + toàn bộ alias tương thích ngược, `01-base`, `02-utilities`, `10-components/*`, `20-pages/preview-ui`), mỗi file <= 350 dòng, 0 `!important` ngoài reduced-motion.
  - Xây dựng `src/ui/theme` (6 preset accent đạt WCAG AA >= 4.5:1 cả sáng/tối, đồng bộ `store` + `<meta name="theme-color">`), `src/ui/icons` (78 icon SVG "Nét Yêu" riêng + `icon-spec.md`), thư viện `src/ui/{primitives,forms,feedback,overlays}.ts`, trang `/preview/ui` và `ui.test.ts`.
- Kiểm: lint ✅ · test ✅ (27 file / 133 test) · build ✅ (`index` gzip 46,18 kB < baseline 46,40 kB) · `git diff apps/api packages apps/admin` rỗng ✅.
- Dở: không có.
- Bước tiếp: P2 (Shell: bottom nav v2, modal/toast/sheet/loader toàn cục, haptics, view transitions, thanh SWR).

### Snapshot tự động 2026-11-26 00:30
- Nhánh: main
- Commit cuối: 75f21eb docs(design): lock MIX direction and add mock-mix
- File thay đổi chưa commit:
   M HANDOFF.md
   M apps/pwa/index.html
   M apps/pwa/src/main.ts
   M apps/pwa/src/styles/tokens.css
   M design/redesign-v2/metrics.md
   M docs/redesign-v2/DECISIONS.md
   M docs/redesign-v2/PROGRESS.md
  ?? apps/pwa/public/fonts/
  ?? apps/pwa/src/pages/ui-preview.ts
  ?? apps/pwa/src/styles/00-fonts.css
  ?? apps/pwa/src/styles/00-tokens.css
  ?? apps/pwa/src/styles/01-base.css
  ?? apps/pwa/src/styles/02-utilities.css
  ?? apps/pwa/src/styles/10-components/
  ?? apps/pwa/src/styles/20-pages/
  ?? apps/pwa/src/styles/index.css
  ?? apps/pwa/src/ui/
  ?? design/redesign-v2/baseline/
  ?? design/redesign-v2/decisions.md
  ?? design/redesign-v2/icon-spec.md
- Diff apps/api + packages (phải rỗng): rỗng (OK)

## 2026-11-26 00:38 — P2 App Shell & Bottom Nav v2 (Gemini)
- Làm:
  - Bọc toàn bộ CSS cũ vào `@layer legacy` trong `styles/index.css` để `@layer components` v2 tự thắng độ ưu tiên mà không dùng `!important`.
  - Viết `src/ui/haptics.ts`, `src/ui/view-transitions.ts` (tích hợp vào `router.ts` với suy luận hướng `tab/forward/back` và fallback đồng bộ an toàn cho WebView cũ/JSDOM), `src/ui/swr-bar.ts` + hook sự kiện nền trong `api/query-cache.ts` (không đổi chữ ký hàm).
  - Thiết kế lại `components/nav.ts` + `10-components/shell.css`: 5 tab dùng icon SVG "Nét Yêu" (outline -> filled + pop), nút Check-in ống kính tim (`checkin-lens`) có vòng glow + shutter micro-animation + haptic, thanh trượt indicator `transform`, huy hiệu tin chưa đọc + đồng bộ `navigator.setAppBadge`, preload chunk khi `pointerdown`/`pointerenter`, tự ẩn khi bàn phím ảo mở.
  - Đồng bộ `components/modal.ts` (thêm focus trap bàn phím), `components/toast.ts`, `components/theme-toggle.ts` (icon SVG `sun`/`moon`), `refresh-icon.ts`, `smile-plus-icon.ts`.
  - Tách lazy `dev-helper` & `anniversary-cards` khỏi `main.ts` giúp chunk `index` giảm từ `46,40 kB` xuống **`34,46 kB` gzip (-25,7%)**.
  - Thêm unit test `src/ui/shell.test.ts` và mở rộng `components/nav.test.ts`.
- Kiểm: lint ✅ · test ✅ (28 file / 139 test) · build ✅ (`index` gzip 34,46 kB) · `git diff apps/api packages apps/admin` rỗng ✅.
- Dở: không có.
- Bước tiếp: P3 (Chat `messages` làm lại toàn diện theo hướng MIX).

### Snapshot tự động 2026-11-26 00:38
- Nhánh: main
- Commit cuối: 81bf01e feat(pwa): P1 design system v2 tokens, self-hosted fonts, 78 custom icons and UI library
- File thay đổi chưa commit:
   M HANDOFF.md
   M apps/pwa/src/api/query-cache.ts
   M apps/pwa/src/components/modal.ts
   M apps/pwa/src/components/nav.test.ts
   M apps/pwa/src/components/nav.ts
   M apps/pwa/src/components/refresh-icon.ts
   M apps/pwa/src/components/smile-plus-icon.ts
   M apps/pwa/src/components/theme-toggle.ts
   M apps/pwa/src/components/toast.ts
   M apps/pwa/src/main.ts
   M apps/pwa/src/router.ts
   M apps/pwa/src/styles/index.css
   M apps/pwa/src/ui/icons/icons.ts
   M apps/pwa/src/ui/index.ts
   M design/redesign-v2/decisions.md
   M docs/redesign-v2/DECISIONS.md
   M docs/redesign-v2/PROGRESS.md
  ?? apps/pwa/src/styles/10-components/shell.css
  ?? apps/pwa/src/ui/haptics.ts
  ?? apps/pwa/src/ui/shell.test.ts
  ?? apps/pwa/src/ui/swr-bar.ts
  ?? apps/pwa/src/ui/view-transitions.ts
- Diff apps/api + packages (phải rỗng): rỗng (OK)

## 2026-11-26 00:59 — P3 Chat MIX & Hợp nhất Module (Gemini)
- Làm:
  - Tách `pages/messages.ts` (79 KB) thành bộ module sạch `pages/messages/{index,bubble,format,typing,wallpaper}.ts` (vẫn re-export `renderMessagesPage`, `formatMessageTime` từ `pages/messages.ts`).
  - Thiết kế lại toàn diện giao diện Chat theo hướng **MIX** trong `styles/20-pages/{chat-layout,chat-bubbles,chat-menus}.css` (mỗi file <= 315 dòng, 0 `!important`): bong bóng viền mực `--ink-border` (`2.5px`) + bóng cứng `--sticker-shadow`, gộp chuỗi tin liên tiếp đầu/giữa/cuối nhóm, tin chỉ-emoji cỡ lớn không khung, sticker trong suốt, chip ngày nhãn vàng `--gold-bg` sticky, nút nổi "Tin mới ↓".
  - Nâng cấp trạng thái gửi bằng icon SVG (`clock` đang gửi, `check` đã gửi, `double-check` đã đọc ở tin cuối, `alert` lỗi + thử lại) gắn với IndexedDB outbox; typing indicator 3 chấm sóng lắng nghe SSE `message.typing`; thanh reaction nổi dùng icon SVG riêng + swipe-to-reply có rung haptic ở ngưỡng; `content-visibility: auto` cho hiệu năng cuộn dài, giữ nguyên scroll-anchoring và DOM identity khi reconcile SSE.
  - Mở rộng `pages/messages.test.ts` (32 test) + `message-thread-enhancements.test.ts` (3 test) = **35 test hành vi chat**.
- Kiểm: lint ✅ · test ✅ (28 file / 140 test) · build ✅ (`index` gzip 34,59 kB, `messages` CSS gzip 3,91 kB) · `git diff apps/api packages apps/admin` rỗng ✅.
- Dở: không có.
- Bước tiếp: P4 (Home + Check-in camera + Memories + Photo Viewer).

### Snapshot tự động 2026-11-26 00:59
- Nhánh: main
- Commit cuối: ed112f6 feat(pwa): P2 app shell, bottom nav v2, view transitions, haptics, SWR bar and bundle optimization
- File thay đổi chưa commit:
   M HANDOFF.md
   M apps/pwa/src/pages/messages.test.ts
   M apps/pwa/src/pages/messages.ts
   M docs/redesign-v2/PROGRESS.md
  ?? apps/pwa/src/pages/messages/
  ?? apps/pwa/src/styles/20-pages/chat-bubbles.css
  ?? apps/pwa/src/styles/20-pages/chat-layout.css
  ?? apps/pwa/src/styles/20-pages/chat-menus.css
- Diff apps/api + packages (phải rỗng): rỗng (OK)

## 2026-11-26 01:14 — P4 Home, Check-in Camera, Memories & Photo Viewer (Gemini)
- Làm:
  - Tạo `src/ui/reactions.ts` + nâng cấp `components/reaction-picker.ts` và `components/reply-toggle.ts`: thay toàn bộ emoji cảm xúc/reply bằng bộ icon SVG "Nét Yêu" riêng, giữ nguyên mã `ReactionType` gửi lên API.
  - Thiết kế lại `pages/home.ts` + `styles/20-pages/home.css`: Editorial Hero (số ngày yêu bằng `Fraunces` italic, chip streak vàng `--gold-bg` đồng bộ realtime với `store`, cặp avatar đôi + CTA nhanh), bỏ hoàn toàn delay `3000ms` khi cold load, hiển thị tức thì từ `getCachedLatestPartnerCheckin()`, thẻ Polaroid viền mực giữ nguyên DOM identity khi patch reaction/reply/refresh, tích hợp `attachPullToRefresh`, thẻ Bản đồ hẹn hò SVG `map` và danh sách kỷ niệm hôm nay.
  - Thiết kế lại `pages/checkin.ts` + `components/camera.ts` + `styles/20-pages/{checkin,camera}.css`: xoá `icons8-photo-gallery-96.apng.png` và emoji tab/particle, thay bằng SVG "Nét Yêu" + hiệu ứng Heart-Burst SVG tôn trọng `reduced-motion`; nâng cấp camera stream viewfinder (khung vuông 1:1 + lưới 3×3, lật cam trước/sau có soi gương, đèn flash/screen-flash, đếm ngược 3 giây, màn hình hướng dẫn khi thiếu quyền camera); mở rộng `checkin.test.ts`.
  - Thiết kế lại `pages/memories.ts` + `components/message-image-viewer.ts` + `styles/20-pages/memories.css`: xoá delay `2000ms` nhân tạo & `icons8-search-48.apng.png`, hiển thị SWR tức thì trên frame đầu, thêm thanh lọc `Tất cả / Người ấy / Của mình` + nhãn tháng vàng sticky, giữ tương thích `Love Foil` và `installAndroidLongPressDownload`, nâng cấp viewer nút đóng SVG 44×44 + vuốt ngang chuyển ảnh.
- Kiểm: lint ✅ · test ✅ (28 file / 141 test) · build ✅ (`index` gzip 34,73 kB; mọi file CSS `20-pages` <= 311 dòng, 0 `!important`) · `git diff apps/api packages apps/admin` rỗng ✅.
- Dở: không có.
- Bước tiếp: P5 (Love Journey + Random + Replies + Card-preview + Test-mail).

### Snapshot tự động 2026-11-26 01:19
- Nhánh: main
- Commit cuối: 2466caa feat(pwa): P3 modular chat redesign with MIX sticker bubbles, grouping, SVG reactions and typing
- File thay đổi chưa commit:
   M HANDOFF.md
   M apps/pwa/src/components/camera.ts
   M apps/pwa/src/components/message-image-viewer.ts
   M apps/pwa/src/components/reaction-picker.ts
   M apps/pwa/src/components/reply-toggle.ts
   M apps/pwa/src/pages/checkin.test.ts
   M apps/pwa/src/pages/checkin.ts
   M apps/pwa/src/pages/home.ts
   M apps/pwa/src/pages/memories.ts
   M apps/pwa/src/styles/message-image-viewer.css
   M docs/redesign-v2/PROGRESS.md
  ?? apps/pwa/src/styles/20-pages/camera.css
  ?? apps/pwa/src/styles/20-pages/checkin.css
  ?? apps/pwa/src/styles/20-pages/home.css
  ?? apps/pwa/src/styles/20-pages/memories.css
  ?? apps/pwa/src/ui/reactions.ts
- Diff apps/api + packages (phải rỗng): rỗng (OK)

## 2026-11-26 01:21 — P5 Love Journey & Secondary Screens (Gemini)
- Làm:
  - Nâng cấp `pages/love-journey.ts` + `styles/20-pages/journey.css`: thay toàn bộ emoji UI/marker/sparkle bằng bộ icon SVG "Nét Yêu", nâng cấp thẻ chi tiết địa điểm thành sheet kéo vuốt đóng trên bản đồ (`p-journey-sheet-handle`), giữ nguyên 100% engine MapLibre, cấu trúc ngoài `.journey-map-canvas-wrap`, CSS attribution và schema `lovecheck_journey_*` (23/23 test pass).
  - Thiết kế lại `pages/random.ts`, `pages/replies.ts`, `pages/card-preview.ts`, `pages/test-mail.ts` + `styles/20-pages/secondary.css`: đồng bộ ngôn ngữ MIX (thẻ rút bài kiểu sticker editorial, bong bóng phản hồi viền mực, bộ sưu tập thiệp cào icon SVG riêng, trang chẩn đoán SMTP hỗ trợ sáng/tối).
- Kiểm: lint ✅ · test ✅ (28 file / 141 test) · build ✅ (`index` gzip 34,82 kB; mọi file CSS `20-pages` <= 311 dòng, 0 `!important`) · `git diff apps/api packages apps/admin` rỗng ✅.
- Dở: không có.
- Bước tiếp: P6 (Auth + Onboarding + Install + Profile/Settings).

### Snapshot tự động 2026-11-26 01:21
- Nhánh: main
- Commit cuối: 5d6495f feat(pwa): P4 editorial MIX redesign for Home, Check-in viewfinder, Memories SWR and Photo Viewer
- File thay đổi chưa commit:
   M HANDOFF.md
   M apps/pwa/src/pages/card-preview.ts
   M apps/pwa/src/pages/love-journey.ts
   M apps/pwa/src/pages/random.ts
   M apps/pwa/src/pages/replies.ts
   M apps/pwa/src/pages/test-mail.ts
   M docs/redesign-v2/PROGRESS.md
  ?? apps/pwa/src/styles/20-pages/journey.css
  ?? apps/pwa/src/styles/20-pages/secondary.css
- Diff apps/api + packages (phải rỗng): rỗng (OK)
