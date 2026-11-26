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

## 2026-11-26 01:30 — P6 Auth, Onboarding, Install & Profile/Settings (Gemini)
- Làm:
  - Thiết kế lại `pages/login.ts`, `pages/onboarding.ts`, `pages/google-onboarding.ts`, `pages/install.ts` + `styles/20-pages/auth.css`: bố cục cảm xúc MIX với biểu tượng SVG "Nét Yêu", thanh tiến trình stepper mượt (`transform: scaleX`), ô nhập Couple Code & OTP từng ký tự hỗ trợ dán/xoá lùi/mở rộng 6–8 ký tự, giữ nguyên luật gọi trực tiếp `window.LoveCheckAndroid.signInWithGoogle()`, trang `/install` hướng dẫn từng bước trên Safari + tự động phát hiện trình duyệt trong ứng dụng (Zalo, Messenger, Instagram, TikTok).
  - Thiết kế lại `pages/profile.ts` + `styles/20-pages/profile.css`: Couple Editorial Card (avatar đôi mở `openSheet`, số ngày yêu `Fraunces`, streak vàng, sao chép Couple Code), nhóm cài đặt phân mục rõ ràng gồm **Bộ chọn 6 màu nhấn Accent Picker (WCAG AA)** + công tắc **Giảm hiệu ứng chuyển động**, thẻ Sinh nhật native render ngay từ frame đầu, nhắc giờ & thử thông báo đẩy đa tầng, kiểm tra phiên bản APK, bảo mật và đăng xuất.
- Kiểm: lint ✅ · test ✅ (28 file / 141 test) · build ✅ · `git diff apps/api packages apps/admin` rỗng ✅.
- Dở: không có.
- Bước tiếp: P7 (PWA manifest/shortcuts, `offline.html`, SW cache v10, update toast, icon app v2, dọn file patch & test tương thích ngược storage).


## 2026-11-26 10:10 — P7 PWA Upgrade & dọn nợ kỹ thuật (Claude Sonnet 5.5)
- Làm:
  - Build/test lại xác nhận trạng thái thật rồi commit + push P6 còn dở (`e5c41ab`).
  - `manifest.webmanifest`: thêm `shortcuts` (Check-in, Tin nhắn, Kỷ niệm), `categories`, tách icon `any` và `maskable` (`icon-maskable-512.png`), `background_color` khớp nền sáng; GIỮ `id/scope/start_url/share_target`.
  - `offline.html` tự chứa (sáng/tối theo `lovecheck_ui_v2_theme`, nút Thử lại, tự reload khi online); SW `lovecheck-v10` precache `offline.html` + icon + 2 font; `/api/*` vẫn networkOnly, `captureShareTarget`/push/waiting worker không đổi.
  - `src/ui/pwa-prompts.ts` + `pwa-prompts.css`: toast cập nhật không chặn màn hình (thay modal, giữ luồng `SKIP_WAITING` + `controllerchange`) và banner `beforeinstallprompt` (chỉ khi đã đăng nhập, trễ 15s, nhớ `lovecheck_ui_v2_install_dismissed`).
  - `main.ts`: bỏ `initProfileUiCleanup`; trang bị khoá dùng SVG `lock`.
  - `scripts/build-app-icons.mjs` sinh lại icon tim + ống kính (192/512/maskable/apple 120-152-180/favicon.svg/badge.svg); mỗi PNG giảm từ ~290 KB xuống 4–88 KB.
  - Xoá (đã grep xác nhận không còn tham chiếu): `profile-ui-cleanup.ts`, `messages-layout-fix.css`, `message-thread-enhancements.css`, 9 file `icons8-*`, `user.png`, `profile.png`. `love-eq-loader` bỏ `!important`.
  - Test mới: `pwa-prompts.test.ts` (4), `storage-compat.test.ts` (5: snapshot localStorage cũ -> store/theme v2/wallpaper/journey đọc đúng, khoá cũ giữ nguyên byte-for-byte, khoá mới chỉ `lovecheck_ui_v2_*`).
- Kiểm: lint ✅ · test ✅ (30 file / 150 test) · build ✅ (`index` gzip 34,65 kB) · `git diff apps/api packages apps/admin` rỗng ✅.
- Dở: `auth-interaction-vibe.css` giữ lại vì 39 class còn dùng (xem HANDOFF mục 2); manifest `screenshots` chưa có.
- Bước tiếp: hỏi user có build APK không (P8); nếu không thì P9.

## 2026-11-26 10:20 — P8 Android native restyle + APK 0.0.48 (Claude Sonnet 5.5)
- Làm (chỉ tài nguyên + vài hằng hiển thị, không đụng logic Kotlin/bridge/FCM):
  - Launcher icon: `mipmap-anydpi-v26/ic_launcher{,_round}.xml` adaptive (nền gradient hồng + tim trong safe-zone 66dp + lớp `monochrome` cho themed icon Android 13+); PNG legacy API 24–25 và `drawable-nodpi/ic_launcher_bitmap.png` sinh bằng `scripts/build-app-icons.mjs`.
  - Icon thông báo: `drawable/ic_notification.xml` vector trắng (thay PNG cũ), giữ kênh `realtime_interactions`, màu nhấn `#FF3B7F`.
  - Splash Android 12+: `values-v31` + `values-night-v31` (nền `#F8E2E7` / `#261824`, `avd_splash_heart` nhịp tim 600ms, dùng thuộc tính theme gốc nên không thêm dependency).
  - Theme: `windowBackground` dark `#14001F` -> `#261824` (khớp PWA) ở `values-night`, WebView nền dark, `Color.kt`, gradient `PhotoViewerActivity`.
  - Widget: `widget_background`/`widget_add_button` kiểu sticker (kem + viền mực), scrim ảnh tông plum, 🔥 -> vector `ic_widget_flame`; giữ nguyên mọi id (`widget_root`, `widget_streak_value`, `widget_subtitle`, `widget_add_button`, `quick_widget_*`). `dialog_update` + `bg_*` đồng bộ (layout này hiện không có Kotlin tham chiếu).
  - Kotlin: 3 tham chiếu bitmap fallback + 1 hằng màu (chi tiết ở HANDOFF mục 2).
  - Phiên bản: `versionCode 59 -> 60`, `versionName 0.0.47 -> 0.0.48`. APK 11,76 MB, ký release, đã copy ra `app-release.apk`.
- Kiểm: `gradlew assembleRelease` ✅ · `aapt2 dump badging` đúng 60/0.0.48, minSdk 24, targetSdk 36 · `apksigner verify` ✅ · lint ✅ · test ✅ · build PWA ✅ · `git diff apps/api packages apps/admin` rỗng ✅.
- Dở: chưa chạy thử trên thiết bị/emulator (xem HANDOFF mục 2). Chưa chạy `testDebugUnitTest` Android.
- Bước tiếp: P9.

## 2026-11-26 10:45 — P9 Tối ưu cuối, A11y Audit, Ảnh chụp After & Báo cáo nghiệm thu (Gemini)
- Làm:
  - Xoá `apps/pwa/src/styles/auth-interaction-vibe.css` (1.314 dòng, 168 `!important`), tách riêng style công cụ dev sang `styles/10-components/dev-helper.css` (chỉ nạp động khi ở dev/local) và thay toàn bộ emoji trong `dev-helper.ts`, `chat-wallpaper.ts`, `anniversary-cards.ts` bằng icon SVG "Nét Yêu".
  - Chuyển `styles/love-journey.css` khỏi `styles/index.css` về nạp riêng trong `pages/love-journey.ts`; xoá 3 lớp `blur(64px)` toàn cục và gỡ toàn bộ `!important` trong `components.css`, `love-journey.css`, `polaroid-cover.css`, `animations.css` -> **0 `!important`** ngoài khối reduced-motion hợp lệ ở `01-base.css`.
  - Gỡ `@import` Google Fonts cuối cùng trong `anniversary-cards.ts` (chuyển sang `var(--font-display)` / `var(--font-sans)` tự host); trì hoãn khởi tạo không thiết yếu qua `requestIdleCallback` trong `main.ts`.
  - Phát hiện qua kiểm tra ảnh chụp thật và sửa triệt để 4 lỗi hiển thị: (1) 45 chỗ dùng nhầm `solid var(--ink-border)` thay vì `solid var(--ink-stroke-color)` ở 7 file `20-pages/*.css` làm mất viền mực sticker, (2) inline `style="display:flex"` trên `#otp-verify-form` ở `login.ts` đè `.hidden-step`, (3) `.memory-mini-composer` bị kéo cao 220px ở `memories.css` do kế thừa `flex-basis` cột, (4) chip gợi ý ở `checkin.css` bị gãy dòng.
  - Viết `src/ui/p9-acceptance.test.ts` (kiểm tự động 0 non-a11y `!important`, <= 400 dòng/file CSS v2, 0 CDN ngoài, hợp đồng PWA v10, tương phản WCAG AA trên cả nền giấy và nền trang cho 6 màu nhấn, và 100% `<button>` có nhãn tiếp cận + `<img>` có `alt` trên 14 màn hình).
  - Viết `scripts/capture-after-and-metrics.mjs` đo Web Vitals mobile (`4× CPU`, `Fast 3G`, nén gzip: LCP `/app/home` **200 ms**, `/app/messages` **536 ms**, `/login` cold **1.896 ms**, CLS **0,000**), chụp đủ **44 ảnh `after` WebP** vào `design/redesign-v2/after/` và bổ sung `screenshots` vào `manifest.webmanifest`.
  - Cập nhật `design/redesign-v2/metrics.md`, `docs/redesign-v2/DECISIONS.md`, `design/redesign-v2/decisions.md`, `docs/redesign-v2/REPORT.md`, `README.md` và `HANDOFF.md`.
- Kiểm: lint ✅ · test ✅ (**31 file / 155 test pass**) · build ✅ (`index` JS **34,73 kB** gzip, `index` CSS **139,27 kB** raw) · `git diff 65924d3 -- apps/api packages apps/admin` rỗng ✅.
- Dở: không có (toàn bộ P0 → P9 đã hoàn tất).
- Bước tiếp: bàn giao báo cáo nghiệm thu cuối cho user; cài thử `app-release.apk` trên thiết bị thật khi thuận tiện.

### Snapshot tự động 2026-11-26 10:47
- Nhánh: main
- Commit cuối: ca15167 feat(android): P8 adaptive launcher icon, vector notification icon, Android 12 splash, PWA-matched dark theme, widget restyle, release v0.0.48
- File thay đổi chưa commit:
   M HANDOFF.md
   M README.md
   M apps/pwa/public/manifest.webmanifest
   M apps/pwa/src/components/dev-helper.ts
   M apps/pwa/src/main.ts
   M apps/pwa/src/pages/login.ts
   M apps/pwa/src/pages/love-journey.ts
   M apps/pwa/src/styles/01-base.css
   M apps/pwa/src/styles/02-utilities.css
   M apps/pwa/src/styles/20-pages/auth.css
   M apps/pwa/src/styles/20-pages/checkin.css
   M apps/pwa/src/styles/20-pages/home.css
   M apps/pwa/src/styles/20-pages/journey.css
   M apps/pwa/src/styles/20-pages/memories.css
   M apps/pwa/src/styles/20-pages/profile.css
   M apps/pwa/src/styles/20-pages/secondary.css
   M apps/pwa/src/styles/animations.css
  D  apps/pwa/src/styles/auth-interaction-vibe.css
   M apps/pwa/src/styles/components.css
   M apps/pwa/src/styles/index.css
   M apps/pwa/src/styles/love-journey.css
   M apps/pwa/src/styles/polaroid-cover.css
   M apps/pwa/src/utils/anniversary-cards.ts
   M apps/pwa/src/utils/chat-wallpaper.ts
   M design/redesign-v2/decisions.md
   M design/redesign-v2/metrics.md
   M docs/redesign-v2/DECISIONS.md
   M docs/redesign-v2/PROGRESS.md
  ?? apps/pwa/public/screenshots/
  ?? apps/pwa/src/styles/10-components/dev-helper.css
  ?? apps/pwa/src/ui/p9-acceptance.test.ts
  ?? design/redesign-v2/after/
  ?? docs/redesign-v2/REPORT.md
  ?? scripts/capture-after-and-metrics.mjs
- Diff apps/api + packages (phải rỗng): rỗng (OK)

## 2026-11-26 11:03 — Khôi phục Logo gốc & Deploy Cloudflare Workers + Pages (Gemini)
- Làm:
  - Theo yêu cầu user giữ lại bộ logo trái tim pixel gốc: khôi phục nguyên bản `apps/pwa/public/icons/{icon-192,icon-512,apple-touch-icon-120/152/180}.png` + `badge.svg` và `apps/android/app/src/main/res/mipmap-*dpi/ic_launcher{,_round}.png` + `drawable/ic_notification.png` từ commit `e5c41ab`; xoá `favicon.svg`, `icon-maskable-512.png`, `scripts/build-app-icons.mjs` và adaptive XML mới.
  - Cập nhật `index.html`, `offline.html`, `sw.js`, `manifest.webmanifest`, `values{,-night}-v31/themes.xml`, `dialog_update.xml`; nâng Android lên `versionCode 61` / `versionName "0.0.49"` và đóng gói lại `app-release.apk`.
  - Build production PWA kèm `VITE_GOOGLE_CLIENT_ID` và deploy trực tiếp bằng Wrangler lên Cloudflare Worker (`check-in-love-api` -> `api.couple.io.vn`) + Cloudflare Pages (`check-in-love` -> `couple.io.vn`).
- Kiểm: lint ✅ · test ✅ (31 file / 155 test pass) · build PWA ✅ · `gradlew assembleRelease` ✅ · Wrangler deploy Worker & Pages ✅.

## 2026-11-26 11:25 — Khôi phục vòng quay chọn ngày có hoạt ảnh & bắt buộc Email OTP / Google OAuth ở Bước 3 (Gemini)
- Làm:
  - Tách module dùng chung `apps/pwa/src/ui/google-signin.ts` cho cả `/login` và `/onboarding` Bước 3 (giữ nguyên luật gọi trực tiếp `window.LoveCheckAndroid.signInWithGoogle()`).
  - Cập nhật `apps/pwa/src/pages/onboarding.ts` + `apps/pwa/src/styles/20-pages/onboarding-date.css`:
    - Bước 3 bắt buộc xác thực tài khoản qua **Email + Mật khẩu** (tiếp nối sang Bước 4 xác thực OTP bắt buộc, bỏ nút bỏ qua OTP) **hoặc** đăng nhập trực tiếp qua **Google OAuth (`ggauth`)** ngay tại Bước 3; chặn rơi nhầm vào dữ liệu mock trên domain thật `couple.io.vn`.
    - Bước chọn Ngày bắt đầu yêu nhau: khôi phục vòng quay 3 cột **Ngày / Tháng / Năm** có hoạt ảnh cuộn mượt, bấm chọn trực tiếp ngày/tháng/năm bất kỳ, kéo chuột trên desktop, nút **"Mở lịch tháng"** gọi native date picker, huy hiệu lịch mini nảy động và thẻ đếm ngày tương phản rõ trên cả nền Sáng & Tối.
  - Bổ sung bộ test `apps/pwa/src/pages/onboarding.test.ts` kiểm chứng luồng Bước 3 Email/Google, Bước 4 OTP không có nút bỏ qua, và vòng quay chọn ngày bất kỳ.
- Kiểm: lint ✅ · test ✅ (32 file / 158 test pass) · build PWA ✅ · Wrangler deploy Pages (`couple.io.vn`) ✅.

## 2026-11-26 12:30 — Sửa 4 lỗi UI/Scroll thực tế trên `couple.io.vn` (Gemini)
- Làm:
  - **Love Foil Dark Mode**: bổ sung biến `--accent-50` và `--accent-200` cho `[data-theme='dark']` trong `00-tokens.css` và chuẩn hoá `.p-checkin-scratch` / `.p-checkin-scratch__pill` trong `checkin.css` (không còn chữ trắng trên nền hồng sáng khi bật Love Foil ở chế độ tối).
  - **Đồng nhất 3 mục đầu Hồ sơ (`profile.ts`)**: bỏ class legacy `.card-solid` gắn nhầm trên dòng `Chỉnh sửa thông tin` (và mở rộng selector dự phòng trong `anniversary-cards.ts`) để 3 hàng đầu trong nhóm cài đặt đồng nhất 100%.
  - **Khôi phục nút thêm ảnh kiểu cũ & hiệu ứng cũ (`nav.ts`, `shell.css`)**: khôi phục nút tròn nổi dấu `+` màu hồng bóng viền trắng, vòng phát sáng nhịp thở `cil-nav-glow-pulse`, hiệu ứng phóng to khi hover / nhún khi bấm và xoay `135deg` thành `×` khi mở check-in.
  - **Sửa lỗi Trang chủ không vuốt được (`home.css`, `01-base.css`, `feedback.ts`, `home.ts`)**: đổi `overflow-x: hidden` sang `overflow-x: clip` và bỏ `overscroll-behavior-y: contain` trên `.p-home` để không tạo bẫy cuộn lồng nhau chặn vuốt trên mobile/WebView; sửa `attachPullToRefresh` kiểm tra đúng `window.scrollY` với touch passive; huỷ long-press trên thẻ ảnh khi ngón tay bắt đầu vuốt (> 8px).
- Kiểm: lint ✅ · test ✅ (32 file / 158 test pass) · build PWA ✅ · Wrangler deploy Pages (`couple.io.vn`) ✅.
