# HANDOFF — Check IN Love (Redesign v2)
Updated: 2026-11-26 10:10 bởi Claude Sonnet 5.5 (Antigravity)

## 0. Câu dán cho AI mới
"Đọc HANDOFF.md ở gốc repo + docs/redesign-v2/PROMPT.md + docs/redesign-v2/PROGRESS.md, chạy `git status` và `git log -5`, rồi làm tiếp từ mục 'Bước kế tiếp'. Build + test để xác nhận trạng thái thật trước khi sửa."

## 1. Mục tiêu (nguyên văn của user, dạng checklist)
Yêu cầu gốc: "dựa trên các logic/feature/color hiện tại, đập đi xây lại toàn bộ thiết kế, UX-UI, tối ưu hiển thị sâu hơn vào các button, các icon đẹp mắt (không đại trà), độ mượt sử dụng pwa, chat mess, ..., không làm ảnh hưởng đến dữ liệu hiện tại"
Yêu cầu phụ: "tôi cần thêm 1 cái log hay gì đó để nếu bạn hết token thì tôi đổi AI khác đọc và hoàn thiện được tiếp"

- [x] Hệ thống log bàn giao (`HANDOFF.md` + `docs/redesign-v2/` + `scripts/handoff-snapshot.ps1`)
- [x] P0 Khảo sát + 3 mock HTML + baseline (`design/redesign-v2/baseline/` 44 ảnh WebP, Web Vitals mobile trong `metrics.md`) -> chốt hướng **MIX**
- [x] P1 Nền tảng: tokens (+alias), CSS `@layer`, 18 file font tự host (`Be Vietnam Pro` + `Fraunces Variable`), theme/accent/motion engine (WCAG AA 6 preset), 78 icon SVG "Nét Yêu" + `icon-spec.md`, thư viện `src/ui/*` + trang `/preview/ui` + `ui.test.ts` (commit `81bf01e`)
- [x] P2 Shell: Bottom Nav v2, `haptics.ts`, `view-transitions.ts`, `swr-bar.ts`, đồng bộ `modal.ts`/`toast.ts`/`theme-toggle.ts`/`refresh-icon.ts`/`smile-plus-icon.ts`, tách lazy chunk (commit `ed112f6`)
- [x] P3 Chat (`messages`) làm lại hoàn chỉnh theo hướng MIX + hợp nhất module (`pages/messages/*` + `styles/20-pages/chat-*.css`) + 35 test chat pass (commit `2466caa`)
- [x] P4 Home + Check-in camera + Memories + Photo Viewer (commit `5d6495f`)
- [x] P5 Love Journey + Random + Replies + Card-preview + Test-mail (commit `f1aa6b9`)
- [x] P6 Auth + Onboarding + Install + Profile/Settings (commit `e5c41ab`)
- [x] P7 PWA: manifest shortcuts + icon any/maskable riêng, `offline.html`, SW cache v10, toast cập nhật + banner cài đặt (`src/ui/pwa-prompts.ts`), bộ icon app v2 (`scripts/build-app-icons.mjs`), xoá file/asset mồ côi, `storage-compat.test.ts`
- [ ] P8 Android native restyle + APK (CHỈ khi user đồng ý build APK)
- [ ] P9 Tối ưu cuối + báo cáo before/after

## 2. Trạng thái hiện tại
- Phase vừa xong: **P7 (PWA Upgrade & dọn nợ kỹ thuật)**. P6 đã push ở commit `e5c41ab`.
- Kiểm chứng: `npm run lint` sạch; `npm test` **30 file / 150 test pass**; `npm run build --workspace=apps/pwa` pass (`tsc` + vite; `index` JS **34,65 kB** gzip); `git diff -- apps/api packages apps/admin` rỗng.
- Cố ý CHƯA làm trong P7 (nợ cho P9):
  - `styles/auth-interaction-vibe.css` (1.314 dòng, 168 `!important`) VẪN được import: 39/87 class của nó còn dùng bởi `login.ts`, `dev-helper`, `google-native-signin-button`, `otp-box`... Xoá phải chuyển từng khối sang `20-pages/auth.css` rồi chụp ảnh đối chiếu, không xoá mù.
  - `manifest.screenshots` chưa có (cần ảnh chụp thật sau khi xong P9).

## 3. Bước kế tiếp
1. **P8 Android native restyle + APK** — CHỈ làm khi user đồng ý build APK (hỏi user trước). Phạm vi: PROMPT.md mục 8. Không đụng bridge `LoveCheckAndroid`/FCM/Google sign-in/share-target. Icon launcher mới sinh từ `scripts/build-app-icons.mjs` (SVG nguồn: `apps/pwa/public/icons/favicon.svg`).
2. **P9 Tối ưu cuối**: đo lại Web Vitals (so `design/redesign-v2/metrics.md`), a11y audit, chuyển nốt `auth-interaction-vibe.css` sang `20-pages`, ảnh chụp after, báo cáo before/after + hướng dẫn rollback.
3. Nếu user không muốn APK: nhảy thẳng P9.

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
Sinh lại icon app: `node scripts\build-app-icons.mjs` (cần Chrome hoặc Edge cài sẵn).

## 6. Bẫy đã gặp
- Shell là PowerShell: mỗi lệnh một dòng, không dùng `&&`.
- Không nhúng chuỗi tiếng Việt dài vào dòng lệnh PowerShell (lỗi parse ký tự) — dùng công cụ ghi file.
- `npm test` KHÔNG kiểm kiểu; `npm run build` chạy `tsc` nên mới bắt lỗi kiểu (vd `IconSize` chỉ nhận 16/20/24/28/32).
- File secret ở gốc repo (`firebase-adminsdk` json, service account, `.env*`): KHÔNG commit thêm, KHÔNG ghi vào log.

## 7. Bản đồ file
- `apps/pwa/src/styles/20-pages/`: `preview-ui.css`, `chat-layout.css`, `chat-bubbles.css`, `chat-menus.css`, `home.css`, `checkin.css`, `camera.css`, `memories.css`, `journey.css`, `secondary.css`, `auth.css`, `profile.css`
- PWA shell: `apps/pwa/public/{manifest.webmanifest,offline.html,sw.js (v10),icons/*}`, `src/ui/pwa-prompts.ts`, `styles/10-components/pwa-prompts.css`
