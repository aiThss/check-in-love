# HANDOFF — Check IN Love (Redesign v2)
Updated: 2026-11-26 00:59 bởi Gemini (Antigravity)

## 0. Câu dán cho AI mới
"Đọc HANDOFF.md ở gốc repo + docs/redesign-v2/PROMPT.md + docs/redesign-v2/PROGRESS.md, chạy `git status` và `git log -5`, rồi làm tiếp từ mục 'Bước kế tiếp'. Build + test để xác nhận trạng thái thật trước khi sửa."

## 1. Mục tiêu (nguyên văn của user, dạng checklist)
Yêu cầu gốc: "dựa trên các logic/feature/color hiện tại, đập đi xây lại toàn bộ thiết kế, UX-UI, tối ưu hiển thị sâu hơn vào các button, các icon đẹp mắt (không đại trà), độ mượt sử dụng pwa, chat mess, ..., không làm ảnh hưởng đến dữ liệu hiện tại"
Yêu cầu phụ: "tôi cần thêm 1 cái log hay gì đó để nếu bạn hết token thì tôi đổi AI khác đọc và hoàn thiện được tiếp"

- [x] Hệ thống log bàn giao (`HANDOFF.md` + `docs/redesign-v2/` + `scripts/handoff-snapshot.ps1`)
- [x] P0 Khảo sát + 3 mock HTML + baseline (`design/redesign-v2/baseline/` 44 ảnh WebP, Web Vitals mobile trong `metrics.md`) -> chốt hướng **MIX**
- [x] P1 Nền tảng: tokens (+alias), CSS `@layer`, 18 file font tự host (`Be Vietnam Pro` + `Fraunces Variable`), theme/accent/motion engine (WCAG AA 6 preset), 78 icon SVG "Nét Yêu" + `icon-spec.md`, thư viện `src/ui/*` + trang `/preview/ui` + `ui.test.ts` (commit `81bf01e`)
- [x] P2 Shell: Bottom Nav v2 (5 icon SVG "Nét Yêu", nút Check-in ống kính tim + glow + shutter, sliding indicator `transform`, unread badge + Badging API, preload route khi `pointerdown`, ẩn khi mở bàn phím), `haptics.ts`, `view-transitions.ts` gắn vào `router.ts`, thanh mảnh đồng bộ SWR (`swr-bar.ts` + `query-cache.ts`), đồng bộ `modal.ts` (focus trap), `toast.ts`, `theme-toggle.ts`, `refresh-icon.ts`, `smile-plus-icon.ts`, tách lazy `dev-helper` & `anniversary-cards` giúp `index` JS giảm từ `46,40 kB` xuống **`34,46 kB` gzip (-25,7%)** + `shell.test.ts` (commit `ed112f6`)
- [x] P3 Chat (`messages`) làm lại hoàn chỉnh theo hướng MIX + hợp nhất module (`pages/messages/{index,bubble,format,typing,wallpaper}.ts` + `styles/20-pages/chat-{layout,bubbles,menus}.css`) + cập nhật test (35 test chat pass)
- [ ] P4 Home + Check-in camera + Memories + viewer
- [ ] P5 Love Journey + Random + Replies + Card-preview
- [ ] P6 Auth + Onboarding + Install + Profile/Settings
- [ ] P7 PWA: manifest shortcuts, offline.html, SW cache v10, update toast, badging, dọn file patch
- [ ] P8 Android native restyle + APK (CHỈ khi user đồng ý build APK)
- [ ] P9 Tối ưu cuối + báo cáo before/after

## 2. Trạng thái hiện tại
- Phase vừa xong: **P3 (Chat MIX)** hoàn tất, cây mã sạch, chuẩn bị push `main`.
- Kiểm chứng: `npm run lint` sạch; `npm test` **28 file / 140 test pass** (32 test trong `messages.test.ts` + 3 test trong `message-thread-enhancements.test.ts`); `npm run build --workspace=apps/pwa` pass (`index` JS gzip = **`34,59 kB`**, `messages` CSS gzip = `3,91 kB`, mỗi file CSS <= 315 dòng, 0 `!important`).

## 3. Bước kế tiếp (P4 — Home + Check-in + Memories + Viewer)
1. Thiết kế lại `apps/pwa/src/pages/home.ts` + `src/styles/20-pages/home.css`:
   - Editorial Hero (số ngày yêu bằng `Fraunces` italic, chip streak vàng `--gold-bg`, avatar trạng thái check-in hai người, nút CTA Check-in khi chưa gửi).
   - Bỏ delay `setTimeout(..., 3000)` nhân tạo khi cold load; hiển thị tức thì từ `getCachedLatestPartnerCheckin()` và SWR ngầm.
   - Thẻ Polaroid check-in với thanh reaction SVG "Nét Yêu", giữ nguyên DOM identity khi patch (`home.test.ts`).
   - Custom pull-to-refresh lò xo tim (`attachPullToRefresh`), thẻ dẫn sang Bản đồ hẹn hò dùng SVG `map`, danh sách kỷ niệm hôm nay.
2. Thiết kế lại `apps/pwa/src/pages/checkin.ts` + `src/components/camera.ts` + `src/styles/20-pages/checkin.css`:
   - Thay `icons8-photo-gallery-96.apng.png` và emoji tab/particle bằng SVG "Nét Yêu" (`camera`, `gallery`, `checkin-lens`, `edit`, `dice`, `sparkle`, heart-burst SVG).
   - Nâng cấp camera stream overlay (khung lưới 3x3, lật cam trước/sau, đếm ngược, nút chụp lớn, màn hình hướng dẫn quyền camera).
   - Giữ nguyên logic nén ảnh (`maxSize: 2048, quality: 0.90` + fallback `1080/0.75`) và `FormData`; cập nhật `checkin.test.ts` cho nút đóng SVG.
3. Thiết kế lại `apps/pwa/src/pages/memories.ts` + `src/components/message-image-viewer.ts` + `src/styles/20-pages/memories.css`:
   - Bỏ `minWaitPromise` 2000ms nhân tạo; render cache ngay + SWR; thêm bộ lọc segmented (Tất cả / Của mình / Của người ấy) cạnh thanh tìm kiếm SVG (thay `icons8-search-48.apng.png`).
   - Lưới Polaroid editorial 2 cột, giữ `installAndroidLongPressDownload` & `openPolaroidCoverModal`; nâng cấp `message-image-viewer.ts` dùng nút đóng SVG tinh gọn.
4. Chạy `lint + test + build`, cập nhật `HANDOFF.md` + `PROGRESS.md`, commit + push `main`.

## 4. Ràng buộc bất khả xâm phạm (chi tiết: PROMPT.md mục 1)
- Không sửa `apps/api`, `packages/shared`, `apps/admin`, schema, env, `wrangler.toml`, `docker-compose.yml`, `nginx.conf`.
- Giữ nguyên tên + định dạng mọi khoá `localStorage` + `IndexedDB` (đặc biệt `lovecheck-message-outbox`, `lovecheck_chat_background_v1`, `lovecheck_chat_wallpaper`, `lovecheck_message_draft_after_sticker`). Khoá mới dùng `lovecheck_ui_v2_*`.
- Không đổi chữ ký hàm trong `apps/pwa/src/api`, `store`, `router`, `session`.
- Android: không đụng bridge `LoveCheckAndroid`, FCM, Google sign-in, share-target.
- Push `main` = auto deploy production thật, mỗi phase phải shippable.

## 5. Lệnh build / test / ship (PowerShell, không dùng &&)
```powershell
Set-Location d:\memory\check-in-love
npm run lint
npm test
npm run build --workspace=apps/pwa
git diff --stat -- apps/api packages apps/admin
powershell -File scripts\handoff-snapshot.ps1
git add .
git commit -m "feat(pwa): <mô tả>"
git push
```

## 6. Bẫy đã gặp
- Shell là PowerShell: mỗi lệnh một dòng, không dùng `&&`.
- File CSS cũ được nạp qua `@import './components.css' layer(legacy);` trong `src/styles/index.css`; phần tử mới ưu tiên dùng class mới `.c-*` / `.p-*`.
- File secret ở gốc repo (`firebase-adminsdk` json, service account, `.env*`): KHÔNG commit thêm, KHÔNG ghi vào log.

## 7. Bản đồ file
- `apps/pwa/src/styles/`: `index.css` (`@layer legacy, tokens, base, components, utilities`), `00-fonts.css`, `00-tokens.css`, `01-base.css`, `02-utilities.css`, `10-components/{icons,button,card-avatar-badge,forms,list-skeleton-empty,overlays,shell}.css`, `20-pages/{preview-ui,chat-layout,chat-bubbles,chat-menus}.css`
- `apps/pwa/src/ui/`: `theme/index.ts`, `icons/icons.ts` (78 icons), `primitives.ts`, `forms.ts`, `feedback.ts`, `overlays.ts`, `haptics.ts`, `view-transitions.ts`, `swr-bar.ts`, `ui.test.ts`, `shell.test.ts`
- `apps/pwa/src/pages/messages/`: `index.ts`, `bubble.ts`, `format.ts`, `typing.ts`, `wallpaper.ts` (re-export qua `pages/messages.ts`)
