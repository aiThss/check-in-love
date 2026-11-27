# HANDOFF — Check IN Love (Redesign v2)
Updated: 2026-11-28 00:48 bởi Gemini (Antigravity)

## 0. Câu dán cho AI mới
"Đọc HANDOFF.md ở gốc repo + docs/redesign-v2/REPORT.md + docs/redesign-v2/PROGRESS.md, chạy `git status` và `git log -5` để nắm toàn bộ trạng thái dự án."

## 1. Mục tiêu (nguyên văn của user, dạng checklist — ĐÃ HOÀN TẤT 100%)
Yêu cầu gốc: "dựa trên các logic/feature/color hiện tại, đập đi xây lại toàn bộ thiết kế, UX-UI, tối ưu hiển thị sâu hơn vào các button, các icon đẹp mắt (không đại trà), độ mượt sử dụng pwa, chat mess, ..., không làm ảnh hưởng đến dữ liệu hiện tại"
Yêu cầu phụ: "tôi cần thêm 1 cái log hay gì đó để nếu bạn hết token thì tôi đổi AI khác đọc và hoàn thiện được tiếp"

- [x] Hệ thống log bàn giao (`HANDOFF.md` + `docs/redesign-v2/` + `scripts/handoff-snapshot.ps1`)
- [x] P0 Khảo sát + 3 mock HTML + baseline (`design/redesign-v2/baseline/` 44 ảnh WebP, Web Vitals mobile trong `metrics.md`) -> chốt hướng **MIX** (commit `464e0d7`, `75f21eb`)
- [x] P1 Nền tảng: tokens (+alias), CSS `@layer`, 18 file font tự host (`Be Vietnam Pro` + `Fraunces Variable`), theme/accent/motion engine (WCAG AA 6 preset), 78 icon SVG "Nét Yêu" + `icon-spec.md`, thư viện `src/ui/*` + trang `/preview/ui` + `ui.test.ts` (commit `81bf01e`)
- [x] P2 Shell: Bottom Nav v2, `haptics.ts`, `view-transitions.ts`, `swr-bar.ts`, đồng bộ `modal.ts`/`toast.ts`/`theme-toggle.ts`/`refresh-icon.ts`/`smile-plus-icon.ts`, tách lazy chunk (commit `ed112f6`)
- [x] P3 Chat (`messages`) làm lại hoàn chỉnh theo hướng MIX + hợp nhất module (`pages/messages/*` + `styles/20-pages/chat-*.css`) + 35 test chat pass (commit `2466caa`)
- [x] P4 Home + Check-in camera + Memories + Photo Viewer (commit `5d6495f`)
- [x] P5 Love Journey + Random + Replies + Card-preview + Test-mail (commit `f1aa6b9`)
- [x] P6 Auth + Onboarding + Install + Profile/Settings (commit `e5c41ab`)
- [x] P7 PWA: manifest shortcuts + screenshots, `offline.html`, SW cache v10, toast cập nhật + banner cài đặt (`src/ui/pwa-prompts.ts`), giữ nguyên bộ logo trái tim pixel gốc, xoá file/asset mồ côi, `storage-compat.test.ts` (commit `98f65c1`)
- [x] P8 Android native restyle + APK v0.0.49 (`versionCode 61`): giữ logo launcher & icon thông báo gốc theo yêu cầu user, splash Android 12+, theme/dark `#261824` khớp PWA, widget + dialog restyle
- [x] P9 Tối ưu cuối + báo cáo before/after: xoá `auth-interaction-vibe.css`, tách `dev-helper.css` & `love-journey.css`, gỡ Google Fonts cuối cùng ở `anniversary-cards.ts`, đưa `!important` ngoài reduced-motion về **0**, sửa 45 viền mực `--ink-stroke-color` & layout `login`/`memories`/`checkin`, bổ sung `manifest.screenshots`, thêm `p9-acceptance.test.ts`, chụp 44 ảnh `after` WebP và xuất báo cáo [`docs/redesign-v2/REPORT.md`](docs/redesign-v2/REPORT.md).
- [x] Hậu kiểm Onboarding trên `couple.io.vn`: khôi phục vòng quay chọn ngày 3 cột có hoạt ảnh mượt + chọn ngày bất kỳ + tương phản Dark Mode rõ nét (`onboarding-date.css`), và bắt buộc xác thực Email OTP hoặc Google OAuth (`ggauth`) ngay ở Bước 3 (`src/ui/google-signin.ts`, `onboarding.ts`, `onboarding.test.ts`).
- [x] Hậu kiểm trải nghiệm thực tế trên điện thoại & phát hành APK `v0.0.50` (`versionCode 62`):
  - Cố định tỷ lệ 1:1 cho mọi vị trí avatar (`card-avatar-badge.css`, `profile.css`, `love-journey.css`) và hiển thị đúng `partnerAvatarUrl` trên Home Hero.
  - Chuyển sang bộ emoji cảm xúc phổ thông không kèm nhãn chữ (`reactions.ts`, `reaction-picker.ts`, `home.ts`, `memories.ts`, `messages/bubble.ts`), bỏ nút "Trả lời" dư thừa và bổ sung khay ẩn `.c-reaction-tray` dưới thanh nhắn tin chỉ hiện khi có emoji/sticker/icon được thả.
  - Tối ưu lọc 3 chế độ `Tất cả - Người ấy - Của mình` trên `memories.ts` với bộ nhớ đệm DOM (`tileCache`) + phân trang 20 ảnh/lần + `IntersectionObserver`, loại bỏ giật lag khi bấm liên tục trên 700+ ảnh; gỡ bỏ độ trễ `startViewTransition` ở `router.ts`, tắt lớp lọc hạt nhiễu GPU và giới hạn `MutationObserver` chỉ chạy khi mở trang Chat.
  - Khôi phục hiệu ứng lò xo mượt mà cho nút `+` thêm ảnh (`nav.ts`, `shell.css`), khôi phục khung Preview Library cổ điển ở `checkin.ts` + trang `/preview/cards` (`card-preview.ts`), rút gọn placeholder Love Foil thành `"Lời nhắn hiển thị trước khi cào"`, và khoá cuộn/chạm nền bản đồ khi mở modal Thêm toạ độ hẹn hò (`love-journey.ts`).
  - Nâng cấp workflow GitHub Actions (`android-patch-release.yml` hỗ trợ SDK 37) và đóng gói phát hành `app-release.apk` `v0.0.50` (`versionCode 62`) lên GitHub Releases + triển khai PWA lên Cloudflare Pages (`couple.io.vn`).

- [x] Chuẩn hoá tiêu đề toàn app, nút `"Thả"`, hiệu ứng tráng ảnh Polaroid & Bộ Icon Mới:
  - Chuẩn hoá toàn bộ tiêu đề các màn hình về 1 dòng (`Kỷ niệm hai đứa`, `Hồ sơ hai đứa`, `Gửi khoảnh khắc`, `Thử chút điều mới`, v.v.) và 2 dòng cân đối `text-wrap: balance` cho tiêu đề dài, đồng thời ép thanh lọc `Tất cả - Người ấy - Của mình` nằm gọn 1 dòng trên mobile (`memories.css`, `home.css`, `profile.css`, `checkin.css`, `journey.css`, `secondary.css`, `auth.css`, `chat-layout.css`, `overlays.css`).
  - Sửa lỗi chữ `"Thả"` lệch phải trong modal thả cảm xúc bằng `width: auto; min-width: 60px; display: inline-flex; justify-content: center` (`card-avatar-badge.css`).
  - Khôi phục hiệu ứng tráng ảnh Polaroid từ commit gốc với thời lượng `2s` ở Trang chủ (`home.ts`) và `1,5s` ở Kỷ niệm (`memories.ts`, `animations.css`), kích hoạt khi mở lần đầu trong phiên và khi bấm nút Làm mới, giữ nguyên chuyển tab tức thì `0ms`.
  - Nâng cấp hệ thống icon (`icons.ts`, `icons.css`, `smile-plus-icon.ts`): giữ nguyên Chuỗi ngày (`streak`, `react-fire`), áp dụng Liquid Glass Đa Lớp (Demo 1) cho `memories`/`gallery`/`image` & `send`, vẽ lại `chat` theo bố cục 2 bong bóng chồng lớp Ảnh 3 kết hợp tráng men hồng-vàng viền mực (Demo 3), đổi `settings` thành bánh răng 8 cạnh tráng men, và đồng bộ các icon còn lại sang Enamel Pin Sticker (Demo 3).

- [x] Xưởng thiệp bí mật hai chiều & Album (`/app/cards`), vá lỗi modal/viewer APK + PWA, dán ảnh chụp màn hình Chat & phát hành APK `v0.0.51` (`versionCode 63`):
  - Đổi nhanh giao diện ở đầu Trang chủ (`home.ts`) chỉ giữ 2 trạng thái `Sáng <-> Tối` (`sun`/`moon`), vẫn giữ đủ `Sáng | Tối | Hệ thống` trong `Hồ sơ -> Giao diện`; xoá dòng mô tả dưới *Ngày sinh nhật hai đứa* ở `profile.ts`, gỡ `mountBirthdaySettings` + `MutationObserver` toàn cục ở `anniversary-cards.ts`, và tự động đồng bộ chéo ngày sinh nhật hai chiều trong `PATCH /api/me` (`apps/api/src/routes/me.ts`).
  - Loại bỏ chế độ xem trước thiệp làm lộ bất ngờ (`/preview/cards` chuyển hướng sang `/app/cards` với user thật) và xây dựng hệ thống **Hộp thiệp bí mật hai chiều** (`0002_occasion_cards.sql`, `occasion-schedule.ts`, `routes/occasion-cards.ts`, `pages/cards-studio.ts`): đối phương tuyệt đối không đọc được thiệp tương lai trước 00:00 ngày lễ; sửa lỗi ngược ngày sinh nhật (mở theo `me.user.birthday`); hỗ trợ **20 dịp lễ Việt Nam Dương lịch + Âm lịch + Cột mốc** (gồm `24/11` Ngày Văn hoá Việt Nam, Tết Nguyên Đán, Thất Tịch, Trung Thu...) + ngày tự chọn không giới hạn; bật/tắt riêng cho ngày giới tính (`8/3`, `20/10`, `19/11`); tải ảnh riêng lên R2 cho cả **Lớp phủ cào (Foil)** và **Ảnh nền trong thiệp**; bộ chọn **3 lá bài xòe quạt (Fan Deck)** chạm rút bài + nút xác nhận; nhắc trước 3 ngày lúc `09:00` VN (`cron.ts`), thông báo tức thì khi người ấy cào mở thiệp và tải ảnh PNG kỷ niệm nét cao.
  - Khôi phục dán ảnh chụp màn hình (`Ctrl+V` / clipboard) trong Chat đính vào khung xem trước `.messages-photo-preview` thay vì gửi nhầm làm sticker, đồng thời căn sát phải/trái chuẩn cho ảnh & sticker trong luồng chat (`chat-bubbles.css`, `message-sticker-input.ts`, `messages/bubble.ts`, `messages/index.ts`).
  - Sửa triệt để 4 lỗi hiển thị từ ảnh thực tế trên điện thoại: (1) lỗi sập chiều cao modal trên Android WebView do đơn vị `dvh` (`love-journey.css`, `journey.css`, `overlays.css`, `keyboard.ts`, `StickerWebView.kt`) + ép nút `+ Thêm điểm đến` / `+ Thêm điều ước` nằm gọn 1 dòng; (2) modal chi tiết ảnh `polaroid-cover.css` tự động đổi nền theo Light/Dark mode; (3) trình xem ảnh Chat PWA (`message-image-viewer.css`, `message-image-viewer.ts`) chuyển sang `@layer components`, nền theo theme, đầy đủ nút Đóng/Tải về + bo góc `18px`; (4) trình xem ảnh native Android (`PhotoViewerActivity.kt`) bo góc `RoundedCornerShape(18.dp)` ôm sát tỷ lệ ảnh thật + đồng bộ Light/Dark mode.

## 2. Trạng thái hiện tại
- **Toàn bộ 10 giai đoạn (P0 → P9), hệ thống Hộp thiệp bí mật hai chiều và các bản vá thực tế đã hoàn thành, triển khai lên `main`, Cloudflare D1 + Worker API (`api.couple.io.vn`), Cloudflare Pages (`couple.io.vn`) và GitHub Releases (`v0.0.51`).**
- Kiểm chứng cuối cùng:
  - `npm run lint`: sạch (0 lỗi, 0 cảnh báo).
  - `npm test`: **34 file / 165 test pass**.
  - `npm run build --workspace=apps/api` & `npm run build --workspace=apps/pwa`: xanh 100%.
  - Android Release APK: `v0.0.51` (`versionCode = 63`), đã ký release và xuất ra `app-release.apk`.

## 3. Bước kế tiếp (Bảo trì / Hậu kiểm thực tế)
1. Mở app trên điện thoại để nhận cập nhật lên `v0.0.51` (`versionCode 63`) từ GitHub Releases hoặc cài trực tiếp `app-release.apk`.
2. Xem báo cáo nghiệm thu đầy đủ và hướng dẫn rollback tại `docs/redesign-v2/REPORT.md` và bảng số liệu tại `design/redesign-v2/metrics.md`.

## 4. Ràng buộc bất khả xâm phạm (chi tiết: PROMPT.md mục 1)
- Không sửa `apps/api`, `packages/shared`, `apps/admin`, schema, env, `wrangler.toml`, `docker-compose.yml`, `nginx.conf`.
- Giữ nguyên tên + định dạng mọi khoá `localStorage` + `IndexedDB`. Khoá mới dùng `lovecheck_ui_v2_*`.
- Không đổi chữ ký hàm trong `apps/pwa/src/api`, `store`, `router`, `session`.
- Android: không đụng bridge `LoveCheckAndroid`, FCM, Google sign-in, share-target.
- Push `main` = auto deploy production thật.

## 5. Lệnh build / test / deploy Cloudflare (PowerShell, không dùng &&)
```powershell
Set-Location d:\memory\check-in-love
npm run lint
npm test
$env:VITE_GOOGLE_CLIENT_ID = "894898478385-g6e1nfj90upono5559an4r443f13ds9s.apps.googleusercontent.com"
npm run build --workspace=apps/pwa
$env:CLOUDFLARE_ACCOUNT_ID = "8ccdd0f39d9060b1de9fdb6132acbcb7"
npm run deploy:api
npx wrangler pages deploy apps/pwa/dist --project-name check-in-love --branch main
```
- Đo lại Web Vitals + chụp lại 44 ảnh `after`: `node scripts\capture-after-and-metrics.mjs`

## 6. Bẫy đã gặp
- Shell là PowerShell: mỗi lệnh một dòng, không dùng `&&`.
- Trong token v2: `--ink-border` là shorthand đầy đủ (`2.5px solid var(--ink-stroke-color)`), còn màu viền thuần là `--ink-stroke-color` (không viết `2px solid var(--ink-border)`).
- Trong CSS `@layer`: mọi `!important` đặt trong `@layer legacy` sẽ thắng ngược `@layer components`, vì vậy tuyệt đối không thêm `!important` ngoài khối reduced-motion ở `01-base.css` (đã khoá bằng `p9-acceptance.test.ts`).
- File secret ở gốc repo (`firebase-adminsdk` json, service account, `.env*`): KHÔNG commit thêm, KHÔNG ghi vào log.

## 7. Bản đồ file chính
- Design System & UI v2: `apps/pwa/src/ui/*`, `apps/pwa/src/styles/{00-fonts,00-tokens,01-base,02-utilities}.css`, `apps/pwa/src/styles/10-components/*`
- Styles theo trang: `apps/pwa/src/styles/20-pages/{preview-ui,chat-layout,chat-bubbles,chat-menus,home,checkin,camera,memories,journey,secondary,auth,profile,cards-fan-deck,cards-studio}.css`
- PWA shell & offline: `apps/pwa/public/{manifest.webmanifest,offline.html,sw.js,icons/*,screenshots/*}`
- Tài liệu & đối chiếu: `docs/redesign-v2/{PROMPT,DECISIONS,PROGRESS,REPORT}.md`, `design/redesign-v2/{audit,metrics,icon-spec,decisions}.md`, `design/redesign-v2/{baseline,after}/`
