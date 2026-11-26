# HANDOFF — Check IN Love (Redesign v2)
Updated: 2026-11-26 01:30 bởi Gemini (Antigravity)

## 0. Câu dán cho AI mới
"Đọc HANDOFF.md ở gốc repo + docs/redesign-v2/PROMPT.md + docs/redesign-v2/PROGRESS.md, chạy `git status` và `git log -5`, rồi làm tiếp từ mục 'Bước kế tiếp'. Build + test để xác nhận trạng thái thật trước khi sửa."

## 1. Mục tiêu (nguyên văn của user, dạng checklist)
Yêu cầu gốc: "dựa trên các logic/feature/color hiện tại, đập đi xây lại toàn bộ thiết kế, UX-UI, tối ưu hiển thị sâu hơn vào các button, các icon đẹp mắt (không đại trà), độ mượt sử dụng pwa, chat mess, ..., không làm ảnh hưởng đến dữ liệu hiện tại"
Yêu cầu phụ: "tôi cần thêm 1 cái log hay gì đó để nếu bạn hết token thì tôi đổi AI khác đọc và hoàn thiện được tiếp"

- [x] Hệ thống log bàn giao (`HANDOFF.md` + `docs/redesign-v2/` + `scripts/handoff-snapshot.ps1`)
- [x] P0 Khảo sát + 3 mock HTML + baseline (`design/redesign-v2/baseline/` 44 ảnh WebP, Web Vitals mobile trong `metrics.md`) -> chốt hướng **MIX**
- [x] P1 Nền tảng: tokens (+alias), CSS `@layer`, 18 file font tự host (`Be Vietnam Pro` + `Fraunces Variable`), theme/accent/motion engine (WCAG AA 6 preset), 78 icon SVG "Nét Yêu" + `icon-spec.md`, thư viện `src/ui/*` + trang `/preview/ui` + `ui.test.ts` (commit `81bf01e`)
- [x] P2 Shell: Bottom Nav v2, `haptics.ts`, `view-transitions.ts`, `swr-bar.ts`, đồng bộ `modal.ts`/`toast.ts`/`theme-toggle.ts`/`refresh-icon.ts`/`smile-plus-icon.ts`, tách lazy chunk giúp `index` JS giảm xuống **`34,46 kB` gzip** (commit `ed112f6`)
- [x] P3 Chat (`messages`) làm lại hoàn chỉnh theo hướng MIX + hợp nhất module (`pages/messages/*` + `styles/20-pages/chat-*.css`) + 35 test chat pass (commit `2466caa`)
- [x] P4 Home + Check-in camera + Memories + Photo Viewer (`styles/20-pages/{home,checkin,camera,memories}.css`, SWR tức thì, reaction SVG, camera viewfinder nâng cao, viewer vuốt ngang) (commit `5d6495f`)
- [x] P5 Love Journey + Random + Replies + Card-preview + Test-mail (`styles/20-pages/{journey,secondary}.css`, marker & pháo tim SVG, sheet địa điểm kéo đóng, 23/23 test Love Journey pass) (commit `f1aa6b9`)
- [x] P6 Auth + Onboarding + Install + Profile/Settings (`styles/20-pages/{auth,profile}.css`, ô nhập Couple Code/OTP riêng biệt, phát hiện in-app browser ở `/install`, bộ chọn 6 màu nhấn Accent Picker + Reduced Motion, thẻ Sinh nhật native không cần patch DOM)
- [ ] P7 PWA: manifest shortcuts, offline.html, SW cache v10, update toast, badging, dọn file patch
- [ ] P8 Android native restyle + APK (CHỈ khi user đồng ý build APK)
- [ ] P9 Tối ưu cuối + báo cáo before/after

## 2. Trạng thái hiện tại
- Phase vừa xong: **P6 (Auth + Onboarding + Install + Profile/Settings)** hoàn tất, chuẩn bị push `main`.
- Kiểm chứng: `npm run lint` sạch; `npm test` **28 file / 141 test pass**; `npm run build --workspace=apps/pwa` pass; mọi file CSS `20-pages/` <= 336 dòng, 0 `!important`.

## 3. Bước kế tiếp (P7 — PWA Upgrade & Dọn Nợ Kỹ Thuật)
1. Nâng cấp `apps/pwa/public/manifest.webmanifest`: thêm `shortcuts` (Check-in, Tin nhắn, Kỷ niệm), `categories`, icon `any` + `maskable` riêng (`icon-maskable-512.png`), giữ nguyên `share_target`, `id`, `scope`, `start_url`.
2. Tạo `apps/pwa/public/offline.html` (tự chứa, hỗ trợ sáng/tối ngôn ngữ MIX + nút thử lại) và nâng `CACHE_NAME` lên `'lovecheck-v10'` trong `apps/pwa/public/sw.js` (giữ nguyên `/api/*` networkOnly, `captureShareTarget`, push, waiting worker).
3. Nâng cấp `main.ts`: toast cập nhật phiên bản mới không chặn màn hình + banner cài đặt `beforeinstallprompt` thông minh (nhớ lựa chọn `lovecheck_ui_v2_install_dismissed`), bỏ `initProfileUiCleanup`, cập nhật `renderBlockedPage` dùng SVG `lock`.
4. Tạo bộ icon ứng dụng v2 đồng bộ (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon-120/152/180.png`, `badge.svg`, `favicon.svg`).
5. Xoá các file vá & asset mồ côi không còn tham chiếu (`profile-ui-cleanup.ts`, `messages-layout-fix.css`, `message-thread-enhancements.css`, `auth-interaction-vibe.css`, `icons8-*`, `user.png`, `profile.png` sau khi grep xác nhận an toàn); nâng cấp `love-eq-loader.ts` & `love-spark-loader.ts` bỏ `!important`.
6. Viết unit test tương thích ngược `src/ui/storage-compat.test.ts` (nạp snapshot `localStorage` cũ -> v2 UI/store/journey/wallpaper đọc đúng 100%).
7. Chạy `lint + test + build`, cập nhật `HANDOFF.md` + `PROGRESS.md`, commit + push `main`.

## 4. Ràng buộc bất khả xâm phạm (chi tiết: PROMPT.md mục 1)
- Không sửa `apps/api`, `packages/shared`, `apps/admin`, schema, env, `wrangler.toml`, `docker-compose.yml`, `nginx.conf`.
- Giữ nguyên tên + định dạng mọi khoá `localStorage` + `IndexedDB`. Khoá mới dùng `lovecheck_ui_v2_*`.
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
- File secret ở gốc repo (`firebase-adminsdk` json, service account, `.env*`): KHÔNG commit thêm, KHÔNG ghi vào log.

## 7. Bản đồ file
- `apps/pwa/src/styles/20-pages/`: `preview-ui.css`, `chat-layout.css`, `chat-bubbles.css`, `chat-menus.css`, `home.css`, `checkin.css`, `camera.css`, `memories.css`, `journey.css`, `secondary.css`, `auth.css`, `profile.css`
