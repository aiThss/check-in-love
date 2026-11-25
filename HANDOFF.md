# HANDOFF — Check IN Love (Redesign v2)
Updated: 2026-11-26 00:38 bởi Gemini (Antigravity)

## 0. Câu dán cho AI mới
"Đọc HANDOFF.md ở gốc repo + docs/redesign-v2/PROMPT.md + docs/redesign-v2/PROGRESS.md, chạy `git status` và `git log -5`, rồi làm tiếp từ mục 'Bước kế tiếp'. Build + test để xác nhận trạng thái thật trước khi sửa."

## 1. Mục tiêu (nguyên văn của user, dạng checklist)
Yêu cầu gốc: "dựa trên các logic/feature/color hiện tại, đập đi xây lại toàn bộ thiết kế, UX-UI, tối ưu hiển thị sâu hơn vào các button, các icon đẹp mắt (không đại trà), độ mượt sử dụng pwa, chat mess, ..., không làm ảnh hưởng đến dữ liệu hiện tại"
Yêu cầu phụ: "tôi cần thêm 1 cái log hay gì đó để nếu bạn hết token thì tôi đổi AI khác đọc và hoàn thiện được tiếp"

- [x] Hệ thống log bàn giao (`HANDOFF.md` + `docs/redesign-v2/` + `scripts/handoff-snapshot.ps1`)
- [x] P0 Khảo sát + 3 mock HTML + baseline (`design/redesign-v2/baseline/` 44 ảnh WebP, Web Vitals mobile trong `metrics.md`) -> chốt hướng **MIX**
- [x] P1 Nền tảng: tokens (+alias), CSS `@layer`, 18 file font tự host (`Be Vietnam Pro` + `Fraunces Variable`), theme/accent/motion engine (WCAG AA 6 preset), 78 icon SVG "Nét Yêu" + `icon-spec.md`, thư viện `src/ui/*` + trang `/preview/ui` + `ui.test.ts` (commit `81bf01e`)
- [x] P2 Shell: Bottom Nav v2 (5 icon SVG "Nét Yêu", nút Check-in ống kính tim + glow + shutter, sliding indicator `transform`, unread badge + Badging API, preload route khi `pointerdown`, ẩn khi mở bàn phím), `haptics.ts`, `view-transitions.ts` gắn vào `router.ts`, thanh mảnh đồng bộ SWR (`swr-bar.ts` + `query-cache.ts`), đồng bộ `modal.ts` (focus trap), `toast.ts`, `theme-toggle.ts`, `refresh-icon.ts`, `smile-plus-icon.ts`, tách lazy `dev-helper` & `anniversary-cards` giúp `index` JS giảm từ `46,40 kB` xuống **`34,46 kB` gzip (-25,7%)** + `shell.test.ts`
- [ ] P3 Chat (`messages`) làm lại hoàn chỉnh theo hướng MIX + hợp nhất module + cập nhật test
- [ ] P4 Home + Check-in camera + Memories + viewer
- [ ] P5 Love Journey + Random + Replies + Card-preview
- [ ] P6 Auth + Onboarding + Install + Profile/Settings
- [ ] P7 PWA: manifest shortcuts, offline.html, SW cache v10, update toast, badging, dọn file patch
- [ ] P8 Android native restyle + APK (CHỈ khi user đồng ý build APK)
- [ ] P9 Tối ưu cuối + báo cáo before/after

## 2. Trạng thái hiện tại
- Phase vừa xong: **P2 (Shell)** hoàn tất, cây mã sạch 100%, đã push `main`.
- Kiểm chứng: `npm run lint` sạch; `npm test` **28 file / 139 test pass**; `npm run build --workspace=apps/pwa` pass (`index` JS gzip = **`34,46 kB`** so với baseline `46,40 kB`, trần `51,04 kB`).
- CSS cũ đã được bọc vào `@layer legacy` trong `src/styles/index.css` nên `@layer components` v2 tự thắng độ ưu tiên mà không cần `!important`.

## 3. Bước kế tiếp (P3 — Chat, ưu tiên cao nhất, PROMPT.md mục 6)
1. Đọc kỹ `apps/pwa/src/pages/messages.ts`, `src/utils/message-thread-enhancements.ts`, `src/styles/messages-layout-fix.css`, `src/styles/message-thread-enhancements.css`, `src/utils/message-reply-gesture.ts`, `src/utils/message-sticker-input.ts`.
2. Tách `pages/messages.ts` (79 KB) thành module sạch `src/pages/messages/{index,thread,composer,bubble,menu,wallpaper}.ts` (vẫn re-export `renderMessagesPage` và `formatMessageTime` từ `src/pages/messages.ts` để giữ hợp đồng import!).
3. Viết `src/styles/20-pages/chat.css` theo hướng **MIX**:
   - Bong bóng viền mực `--ink-border` (`2.5px`) + bóng cứng `--sticker-shadow`, nhóm tin liên tiếp (bo góc đầu/giữa/cuối nhóm), tin chỉ-emoji cỡ lớn, sticker không nền.
   - Chip ngày dạng nhãn vàng `--gold-bg` sticky; nút nổi "tin mới ↓" khi đang cuộn lên.
   - Trạng thái gửi bằng icon SVG (`clock` đang gửi, `check` đã gửi, `double-check` đã đọc, `alert` lỗi + gửi lại) gắn với outbox IndexedDB; typing indicator 3 chấm sóng (UI sẵn sàng cho SSE `message.typing` đã có trong `RealtimeEventData`!).
   - `content-visibility: auto` + `contain-intrinsic-size` cho danh sách dài, giữ scroll-anchoring khi tải tin cũ, giữ DOM identity khi reconcile SSE.
   - Thanh reaction nổi dùng bộ icon reaction tự vẽ (`heart`, `react-love`, `react-haha`, `react-wow`, `react-ouch`, `react-fire`) + swipe-to-reply có haptic ở ngưỡng.
   - Composer dính đáy (`100dvh` + `visualViewport`), textarea tự giãn tối đa 5 dòng, giữ nháp `lovecheck_message_draft_after_sticker`.
4. Cập nhật/giữ đủ **>= 34 ca kiểm hành vi** trong `messages.test.ts` + `message-thread-enhancements.test.ts` (chú ý giữ các hành vi: wallpaper 6 preset + custom + fallback quota, SSE refresh + visibilitychange, `message-system-event`, không mutate DOM không đổi, dedupe submit, giữ focus composer khi bấm send, scroll anchor, chỉ hiện `Đã đọc` ở tin cuối, swipe-to-reply ngưỡng ngang, edit/recall & lịch sử sửa, quote ảnh & kỷ niệm, gửi ảnh qua `createCheckin`).
5. Chạy `lint + test + build`, kiểm `git diff --stat -- apps/api packages apps/admin` rỗng, cập nhật `HANDOFF.md` + `PROGRESS.md`, commit + push `main`.

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
- File CSS cũ được nạp qua `@import './components.css' layer(legacy);` trong `src/styles/index.css`; lưu ý trong CSS `@layer`, quy tắc `!important` ở layer thấp (`legacy`) vẫn thắng quy tắc thường ở layer cao, nên phần tử mới ưu tiên dùng class mới `.c-*` / `.p-*`.
- File secret ở gốc repo (`firebase-adminsdk` json, service account, `.env*`): KHÔNG commit thêm, KHÔNG ghi vào log.

## 7. Bản đồ file
- `apps/pwa/src/styles/`: `index.css` (`@layer legacy, tokens, base, components, utilities`), `00-fonts.css`, `00-tokens.css`, `01-base.css`, `02-utilities.css`, `10-components/{icons,button,card-avatar-badge,forms,list-skeleton-empty,overlays,shell}.css`, `20-pages/preview-ui.css`
- `apps/pwa/src/ui/`: `theme/index.ts`, `icons/icons.ts` (78 icons), `primitives.ts`, `forms.ts`, `feedback.ts`, `overlays.ts`, `haptics.ts`, `view-transitions.ts`, `swr-bar.ts`, `ui.test.ts`, `shell.test.ts`
- `apps/pwa/src/components/`: `nav.ts` + `nav.test.ts` (v2), `modal.ts` (v2 focus trap), `toast.ts`, `theme-toggle.ts` (v2 SVG), `refresh-icon.ts`, `smile-plus-icon.ts`
