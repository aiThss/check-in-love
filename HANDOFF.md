# HANDOFF — Check IN Love (Redesign v2)
Updated: 2026-11-26 00:10 bởi Claude Sonnet 5.5 (Antigravity)

## 0. Câu dán cho AI mới
"Đọc HANDOFF.md ở gốc repo + docs/redesign-v2/PROMPT.md + docs/redesign-v2/PROGRESS.md, chạy `git status` và `git log -5`, rồi làm tiếp từ mục 'Bước kế tiếp'. Build + test để xác nhận trạng thái thật trước khi sửa."

## 1. Mục tiêu (nguyên văn của user, dạng checklist)
Yêu cầu gốc: "dựa trên các logic/feature/color hiện tại, đập đi xây lại toàn bộ thiết kế, UX-UI, tối ưu hiển thị sâu hơn vào các button, các icon đẹp mắt (không đại trà), độ mượt sử dụng pwa, chat mess, ..., không làm ảnh hưởng đến dữ liệu hiện tại"
Yêu cầu phụ: "tôi cần thêm 1 cái log hay gì đó để nếu bạn hết token thì tôi đổi AI khác đọc và hoàn thiện được tiếp"

- [x] Hệ thống log bàn giao (file này + docs/redesign-v2/ + scripts/handoff-snapshot.ps1)
- [x] P0 Khảo sát + 3 mock HTML + baseline (design/redesign-v2/: audit.md, metrics.md, DIRECTIONS.md, 3 mock + shots) -> CỔNG DỪNG ĐÃ QUA: user chốt hướng **MIX** (xem DECISIONS.md, mock-mix.html). Còn thiếu: screenshot baseline app thật + Lighthouse baseline (làm đầu P1)
- [ ] P1 Nền tảng: tokens, font tự host, theme/accent, icon system, component lib
- [ ] P2 Shell: bottom nav, modal/toast/sheet, view transitions, skeleton/SWR
- [ ] P3 Chat (messages) làm lại + cập nhật test
- [ ] P4 Home + Check-in camera + Memories + viewer
- [ ] P5 Love Journey + Random + Replies + Card-preview
- [ ] P6 Auth + Onboarding + Install + Profile/Settings
- [ ] P7 PWA: manifest shortcuts, offline.html, SW cache v10, update toast, badging, dọn file patch
- [ ] P8 Android native restyle + APK (CHỈ khi user đồng ý build APK)
- [ ] P9 Tối ưu cuối + báo cáo before/after

Quyết định đã chốt với user: phạm vi = PWA + lớp native Android (admin, backend ngoài phạm vi); giữ TypeScript thuần + Vite; tự vẽ ~70 icon SVG; làm đủ 8 nhóm độ mượt; push thẳng `main` sau mỗi phase.

## 2. Trạng thái hiện tại
- Phase: P0 xong; hướng thẩm mỹ đã chốt = MIX (A nền + kính B ở nav/sheet/composer + chat/nhãn vàng/micro-animation của C). Sẵn sàng bắt đầu P1.
- Baseline (xem design/redesign-v2/metrics.md): npm test 26 file / 128 test pass; lint sạch; build pwa pass; chunk index gzip 46,40 kB (trần P1+ ~51 kB).
- Chưa có mã ứng dụng nào bị sửa cho Redesign v2. Chỉ thêm file trong design/redesign-v2/.
- Mock sinh bằng: node design/redesign-v2/build-mocks.mjs (ảnh chụp: Chrome headless, xem PROGRESS.md).

## 3. Bước kế tiếp
1. (XONG) Hướng thẩm mỹ = MIX, đã ghi DECISIONS.md. Nguồn tham chiếu thị giác: design/redesign-v2/mock-mix.html (+ shots/mix-light.png, mix-dark.png).
2. Đầu P1: chụp screenshot baseline app thật (dùng lovecheck_dev_preview_data trong src/dev/mock-data.ts) + đo Lighthouse mobile, ghi vào metrics.md.
3. P1: tokens (+alias tương thích ngược), font tự host, theme/accent engine, icon system + icon-spec.md, component lib + trang /preview/ui (chỉ DEV). Trang cũ phải chạy nguyên.
4. Sau mỗi phase: lint + test + build, kiểm `git diff --stat -- apps/api packages` rỗng, cập nhật file này + PROGRESS.md, commit, push.

## 4. Ràng buộc bất khả xâm phạm (chi tiết: PROMPT.md mục 1)
- Không sửa apps/api, packages/shared, schema, env, wrangler.toml, docker-compose.yml, nginx.conf.
- Giữ nguyên tên + định dạng mọi khoá localStorage + IndexedDB (đặc biệt outbox `lovecheck-message-outbox`).
- Không đổi chữ ký hàm trong apps/pwa/src/api, store, router, session.
- Service worker: không cache /api, giữ share-target (POST /app/messages) và push.
- Android: không đụng bridge LoveCheckAndroid, FCM, Google sign-in, share-target.
- Push `main` = auto deploy production thật, nên mỗi phase phải shippable.

## 5. Lệnh build / test / ship (PowerShell, không dùng &&)
```powershell
cd d:\memory\check-in-love
npm run lint
npm test
npm run build --workspace=apps/pwa
git diff --stat -- apps/api packages
powershell -File scripts\handoff-snapshot.ps1
git add .
git commit -m "feat(pwa): <mô tả>"
git push
```
APK (chỉ P8): xem AGENTS.md mục 3 (tăng versionCode/versionName, `.\gradlew.bat assembleRelease`, copy app-release.apk ra gốc).

## 6. Bẫy đã gặp
- Shell là PowerShell: mỗi lệnh một dòng, không dùng `&&`.
- Android thực chất là WebView bọc PWA (StickerWebView/MainActivity.kt); Compose MainScreen gần như trống.
- `sw.js` tham chiếu `/offline.html` nhưng file chưa tồn tại trong apps/pwa/public.
- File secret có sẵn ở gốc repo (firebase-adminsdk json, service account, .env*): KHÔNG commit thêm, KHÔNG ghi nội dung vào log.
- Nhiều file "vá" tiêm DOM sau render (profile-ui-cleanup, anniversary-cards, message-thread-enhancements); test bám class như `.messages-menu-button`, `data-messages-action`.
- Backend đang chuyển Mongo -> Cloudflare D1; không liên quan Redesign nhưng đừng đụng.

## 7. Bản đồ file
- apps/pwa/src/pages/*: các màn hình; src/components/*: component dùng chung; src/styles/*: CSS (components.css ~5800 dòng)
- apps/pwa/src/api/*, store/, router.ts, session.ts: logic dữ liệu (KHÔNG đổi chữ ký)
- apps/pwa/public/sw.js, manifest.webmanifest: PWA
- apps/android/app/src/main: lớp native (widget, notification, WebView host)
- docs/redesign-v2/: PROMPT.md (gốc), PROGRESS.md (nhật ký), DECISIONS.md (quyết định)
