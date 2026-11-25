# HANDOFF — Check IN Love (Redesign v2)
Updated: 2026-11-26 01:14 bởi Gemini (Antigravity)

## 0. Câu dán cho AI mới
"Đọc HANDOFF.md ở gốc repo + docs/redesign-v2/PROMPT.md + docs/redesign-v2/PROGRESS.md, chạy `git status` và `git log -5`, rồi làm tiếp từ mục 'Bước kế tiếp'. Build + test để xác nhận trạng thái thật trước khi sửa."

## 1. Mục tiêu (nguyên văn của user, dạng checklist)
Yêu cầu gốc: "dựa trên các logic/feature/color hiện tại, đập đi xây lại toàn bộ thiết kế, UX-UI, tối ưu hiển thị sâu hơn vào các button, các icon đẹp mắt (không đại trà), độ mượt sử dụng pwa, chat mess, ..., không làm ảnh hưởng đến dữ liệu hiện tại"
Yêu cầu phụ: "tôi cần thêm 1 cái log hay gì đó để nếu bạn hết token thì tôi đổi AI khác đọc và hoàn thiện được tiếp"

- [x] Hệ thống log bàn giao (`HANDOFF.md` + `docs/redesign-v2/` + `scripts/handoff-snapshot.ps1`)
- [x] P0 Khảo sát + 3 mock HTML + baseline (`design/redesign-v2/baseline/` 44 ảnh WebP, Web Vitals mobile trong `metrics.md`) -> chốt hướng **MIX**
- [x] P1 Nền tảng: tokens (+alias), CSS `@layer`, 18 file font tự host (`Be Vietnam Pro` + `Fraunces Variable`), theme/accent/motion engine (WCAG AA 6 preset), 78 icon SVG "Nét Yêu" + `icon-spec.md`, thư viện `src/ui/*` + trang `/preview/ui` + `ui.test.ts` (commit `81bf01e`)
- [x] P2 Shell: Bottom Nav v2, `haptics.ts`, `view-transitions.ts`, `swr-bar.ts`, đồng bộ `modal.ts`/`toast.ts`/`theme-toggle.ts`/`refresh-icon.ts`/`smile-plus-icon.ts`, tách lazy chunk giúp `index` JS giảm từ `46,40 kB` xuống **`34,46 kB` gzip** (commit `ed112f6`)
- [x] P3 Chat (`messages`) làm lại hoàn chỉnh theo hướng MIX + hợp nhất module (`pages/messages/*` + `styles/20-pages/chat-*.css`) + 35 test chat pass (commit `2466caa`)
- [x] P4 Home + Check-in camera + Memories + Photo Viewer (`styles/20-pages/{home,checkin,camera,memories}.css`, bỏ delay nhân tạo 3s/2s, SWR tức thì, bộ reaction SVG `ui/reactions.ts`, viewfinder camera có grid 3x3/flash/đếm ngược/lật cam/hướng dẫn quyền, viewer hỗ trợ vuốt ngang album)
- [ ] P5 Love Journey + Random + Replies + Card-preview
- [ ] P6 Auth + Onboarding + Install + Profile/Settings
- [ ] P7 PWA: manifest shortcuts, offline.html, SW cache v10, update toast, badging, dọn file patch
- [ ] P8 Android native restyle + APK (CHỈ khi user đồng ý build APK)
- [ ] P9 Tối ưu cuối + báo cáo before/after

## 2. Trạng thái hiện tại
- Phase vừa xong: **P4 (Home + Check-in + Memories + Viewer)** hoàn tất, cây mã sạch, chuẩn bị push `main`.
- Kiểm chứng: `npm run lint` sạch; `npm test` **28 file / 141 test pass**; `npm run build --workspace=apps/pwa` pass (`index` JS gzip = **`34,73 kB`**, mọi file CSS trong `20-pages/` <= 311 dòng, 0 `!important`).

## 3. Bước kế tiếp (P5 — Love Journey + Random + Replies + Card-preview + Test-mail)
1. Nâng cấp `apps/pwa/src/pages/love-journey.ts` + `src/styles/20-pages/journey.css`:
   - Thay toàn bộ emoji UI (`🗺️`, `✨`, `📍`, `🎯`, `💖`, `📋`, `⏳`, `🎉`, `🍷`, `✈️`, `🏡`, `🎨`, `💍`, `✏️`) bằng icon SVG "Nét Yêu" + hạt pháo tim SVG.
   - Nâng cấp thẻ chi tiết địa điểm thành sheet kéo mượt được trên bản đồ, giữ nguyên toàn bộ 23 test trong `love-journey.test.ts` (không phá cấu trúc `.journey-map-canvas-wrap` vs `#journey-map-empty-slot`, giữ nguyên CSS attribution MapLibre).
2. Đồng bộ `pages/random.ts`, `pages/replies.ts`, `pages/card-preview.ts`, `pages/test-mail.ts` + `styles/20-pages/secondary.css` theo Design System v2 (thay toàn bộ emoji-làm-icon bằng SVG "Nét Yêu", typography `Fraunces` + `Be Vietnam Pro`, viền/nút MIX).
3. Chạy `lint + test + build`, cập nhật `HANDOFF.md` + `PROGRESS.md`, commit + push `main`.

## 4. Ràng buộc bất khả xâm phạm (chi tiết: PROMPT.md mục 1)
- Không sửa `apps/api`, `packages/shared`, `apps/admin`, schema, env, `wrangler.toml`, `docker-compose.yml`, `nginx.conf`.
- Giữ nguyên tên + định dạng mọi khoá `localStorage` + `IndexedDB` (đặc biệt `lovecheck-message-outbox`, `lovecheck_journey_places`, `lovecheck_journey_bucket`, `lovecheck_journey_seed_cleanup_v1`). Khoá mới dùng `lovecheck_ui_v2_*`.
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
- `love-journey.test.ts` kiểm tra trực tiếp nội dung `styles/love-journey.css` cho quy tắc `.maplibregl-ctrl-attrib` và cấm chuỗi `cartocdn.com` — giữ nguyên các quy tắc attribution đó!
- File secret ở gốc repo (`firebase-adminsdk` json, service account, `.env*`): KHÔNG commit thêm, KHÔNG ghi vào log.

## 7. Bản đồ file
- `apps/pwa/src/styles/`: `index.css`, `00-fonts.css`, `00-tokens.css`, `01-base.css`, `02-utilities.css`, `10-components/*`, `20-pages/{preview-ui,chat-layout,chat-bubbles,chat-menus,home,checkin,camera,memories}.css`
- `apps/pwa/src/ui/`: `theme/index.ts`, `icons/icons.ts`, `reactions.ts`, `primitives.ts`, `forms.ts`, `feedback.ts`, `overlays.ts`, `haptics.ts`, `view-transitions.ts`, `swr-bar.ts`
