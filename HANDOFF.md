# HANDOFF — Check IN Love (Redesign v2)
Updated: 2026-11-26 10:45 bởi Gemini (Antigravity)

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
- [x] P7 PWA: manifest shortcuts + icon any/maskable riêng, `offline.html`, SW cache v10, toast cập nhật + banner cài đặt (`src/ui/pwa-prompts.ts`), bộ icon app v2 (`scripts/build-app-icons.mjs`), xoá file/asset mồ côi, `storage-compat.test.ts` (commit `98f65c1`)
- [x] P8 Android native restyle + APK v0.0.48 (`versionCode 60`): adaptive icon + monochrome, icon thông báo vector, splash Android 12+, theme/dark khớp PWA, widget + dialog restyle (commit `ca15167`)
- [x] P9 Tối ưu cuối + báo cáo before/after: xoá `auth-interaction-vibe.css`, tách `dev-helper.css` & `love-journey.css`, gỡ Google Fonts cuối cùng ở `anniversary-cards.ts`, đưa `!important` ngoài reduced-motion về **0**, sửa 45 viền mực `--ink-stroke-color` & layout `login`/`memories`/`checkin`, bổ sung `manifest.screenshots`, thêm `p9-acceptance.test.ts` (**31 file / 155 test pass**), chụp 44 ảnh `after` WebP và xuất báo cáo [`docs/redesign-v2/REPORT.md`](docs/redesign-v2/REPORT.md).

## 2. Trạng thái hiện tại
- **Toàn bộ 10 giai đoạn (P0 → P9) của Redesign v2 đã hoàn thành và triển khai lên `main`.**
- Kiểm chứng cuối cùng:
  - `npm run lint`: sạch (0 lỗi, 0 cảnh báo).
  - `npm test`: **31 file / 155 test pass**.
  - `npm run build --workspace=apps/pwa`: `tsc && vite build` xanh (`index` JS **34,73 kB** gzip < baseline 46,40 kB; `index` CSS **139,27 kB** raw < baseline 141,43 kB).
  - `git diff --stat 65924d3 -- apps/api packages apps/admin`: **rỗng 100%**.

## 3. Bước kế tiếp (Bảo trì / Hậu kiểm thực tế)
1. Cài thử `app-release.apk` (`v0.0.48`, `versionCode 60`) trên điện thoại Android thật để kiểm tra trực quan icon Adaptive/Monochrome, Splash Android 12+, thông báo đẩy và 2 widget màn hình chính.
2. Xem báo cáo nghiệm thu đầy đủ và hướng dẫn rollback tại `docs/redesign-v2/REPORT.md` và bảng số liệu tại `design/redesign-v2/metrics.md`.

## 4. Ràng buộc bất khả xâm phạm (chi tiết: PROMPT.md mục 1)
- Không sửa `apps/api`, `packages/shared`, `apps/admin`, schema, env, `wrangler.toml`, `docker-compose.yml`, `nginx.conf`.
- Giữ nguyên tên + định dạng mọi khoá `localStorage` + `IndexedDB`. Khoá mới dùng `lovecheck_ui_v2_*`.
- Không đổi chữ ký hàm trong `apps/pwa/src/api`, `store`, `router`, `session`.
- Android: không đụng bridge `LoveCheckAndroid`, FCM, Google sign-in, share-target.
- Push `main` = auto deploy production thật.

## 5. Lệnh build / test / ship (PowerShell, không dùng &&)
```powershell
Set-Location d:\memory\check-in-love
npm run lint
npm test
npm run build --workspace=apps/pwa
git diff --stat -- apps/api packages apps/admin
git add .
git commit -m "feat(pwa): <mô tả>"
git push
```
- Sinh lại bộ icon PWA + Android: `node scripts\build-app-icons.mjs`
- Đo lại Web Vitals + chụp lại 44 ảnh `after`: `node scripts\capture-after-and-metrics.mjs`

## 6. Bẫy đã gặp
- Shell là PowerShell: mỗi lệnh một dòng, không dùng `&&`.
- Trong token v2: `--ink-border` là shorthand đầy đủ (`2.5px solid var(--ink-stroke-color)`), còn màu viền thuần là `--ink-stroke-color` (không viết `2px solid var(--ink-border)`).
- Trong CSS `@layer`: mọi `!important` đặt trong `@layer legacy` sẽ thắng ngược `@layer components`, vì vậy tuyệt đối không thêm `!important` ngoài khối reduced-motion ở `01-base.css` (đã khoá bằng `p9-acceptance.test.ts`).
- File secret ở gốc repo (`firebase-adminsdk` json, service account, `.env*`): KHÔNG commit thêm, KHÔNG ghi vào log.

## 7. Bản đồ file chính
- Design System & UI v2: `apps/pwa/src/ui/*`, `apps/pwa/src/styles/{00-fonts,00-tokens,01-base,02-utilities}.css`, `apps/pwa/src/styles/10-components/*`
- Styles theo trang: `apps/pwa/src/styles/20-pages/{preview-ui,chat-layout,chat-bubbles,chat-menus,home,checkin,camera,memories,journey,secondary,auth,profile}.css`
- PWA shell & offline: `apps/pwa/public/{manifest.webmanifest,offline.html,sw.js,icons/*,screenshots/*}`
- Tài liệu & đối chiếu: `docs/redesign-v2/{PROMPT,DECISIONS,PROGRESS,REPORT}.md`, `design/redesign-v2/{audit,metrics,icon-spec,decisions}.md`, `design/redesign-v2/{baseline,after}/`
