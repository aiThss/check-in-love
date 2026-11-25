# HANDOFF — Check IN Love (Redesign v2)
Updated: 2026-11-26 00:30 bởi Gemini (Antigravity)

## 0. Câu dán cho AI mới
"Đọc HANDOFF.md ở gốc repo + docs/redesign-v2/PROMPT.md + docs/redesign-v2/PROGRESS.md, chạy `git status` và `git log -5`, rồi làm tiếp từ mục 'Bước kế tiếp'. Build + test để xác nhận trạng thái thật trước khi sửa."

## 1. Mục tiêu (nguyên văn của user, dạng checklist)
Yêu cầu gốc: "dựa trên các logic/feature/color hiện tại, đập đi xây lại toàn bộ thiết kế, UX-UI, tối ưu hiển thị sâu hơn vào các button, các icon đẹp mắt (không đại trà), độ mượt sử dụng pwa, chat mess, ..., không làm ảnh hưởng đến dữ liệu hiện tại"
Yêu cầu phụ: "tôi cần thêm 1 cái log hay gì đó để nếu bạn hết token thì tôi đổi AI khác đọc và hoàn thiện được tiếp"

- [x] Hệ thống log bàn giao (file này + docs/redesign-v2/ + scripts/handoff-snapshot.ps1)
- [x] P0 Khảo sát + 3 mock HTML + baseline (design/redesign-v2/: audit.md, metrics.md, DIRECTIONS.md, 44 ảnh baseline WebP, Web Vitals mobile) -> chốt hướng **MIX**
- [x] P1 Nền tảng: tokens (+alias), base/utilities/components CSS chia lớp `@layer`, font tự host (`Be Vietnam Pro` + `Fraunces Variable`), theme/accent/motion engine (WCAG AA 6 preset), 78 icon SVG "Nét Yêu" + `icon-spec.md`, thư viện `src/ui/*` + trang `/preview/ui` + test (`ui.test.ts`)
- [ ] P2 Shell: bottom nav mới + check-in button, modal/toast/sheet/loader toàn cục, haptics, view transitions, skeleton/SWR plumbing
- [ ] P3 Chat (messages) làm lại + cập nhật test
- [ ] P4 Home + Check-in camera + Memories + viewer
- [ ] P5 Love Journey + Random + Replies + Card-preview
- [ ] P6 Auth + Onboarding + Install + Profile/Settings
- [ ] P7 PWA: manifest shortcuts, offline.html, SW cache v10, update toast, badging, dọn file patch
- [ ] P8 Android native restyle + APK (CHỈ khi user đồng ý build APK)
- [ ] P9 Tối ưu cuối + báo cáo before/after

## 2. Trạng thái hiện tại
- Phase: P1 hoàn tất, chuẩn bị bắt đầu P2 (Shell).
- Kiểm chứng P1: `npm run lint` sạch; `npm test` 27 file / 133 test pass; `npm run build --workspace=apps/pwa` pass, chunk `index` gzip = **46,18 kB** (nhỏ hơn cả baseline 46,40 kB, dưới trần 51 kB).
- Trang cũ vẫn chạy nguyên vẹn nhờ alias biến CSS tương thích ngược và lớp CSS `@layer`.

## 3. Bước kế tiếp
1. Làm P2 (Shell — PROMPT.md mục 5.1, 5.10, 7.1, 7.2, 7.3):
   - Viết `src/ui/haptics.ts` (vibrate an toàn, tôn trọng reduced-motion) + `src/ui/view-transitions.ts` (feature-detect `document.startViewTransition` với hướng tiến/lùi/tab ngang, không phá `router.ts` history boundary/layer).
   - Nâng cấp `components/nav.ts` sang Bottom Nav v2 (5 mục dùng icon SVG "Nét Yêu", nút trung tâm `checkin-lens` có vòng glow + shutter micro-animation, thanh trượt active indicator `transform`, huy hiệu tin chưa đọc, preload route khi `pointerdown`, ẩn khi bàn phím ảo mở). Giữ test `nav.test.ts` xanh + thêm test mới.
   - Đồng bộ `components/modal.ts`, `components/toast.ts`, `refresh-icon.ts`, `smile-plus-icon.ts`, `love-eq-loader.ts`, `love-spark-loader.ts` sang ngôn ngữ v2 (giữ nguyên toàn bộ hàm export và các ca kiểm trong `toast.test.ts`).
   - Thêm thanh mảnh trạng thái đồng bộ SWR trên đầu app shell (`revalidating` bar, không CLS).
2. Sau P2: chạy lint + test + build, kiểm `git diff --stat -- apps/api packages apps/admin` rỗng, cập nhật HANDOFF.md + PROGRESS.md, commit + push `main`.
3. Tiếp tục P3 (Chat — ưu tiên cao nhất).

## 4. Ràng buộc bất khả xâm phạm (chi tiết: PROMPT.md mục 1)
- Không sửa apps/api, packages/shared, apps/admin, schema, env, wrangler.toml, docker-compose.yml, nginx.conf.
- Giữ nguyên tên + định dạng mọi khoá localStorage + IndexedDB (đặc biệt outbox `lovecheck-message-outbox`). Khoá mới dùng prefix `lovecheck_ui_v2_*`.
- Không đổi chữ ký hàm trong apps/pwa/src/api, store, router, session.
- Service worker: không cache /api, giữ share-target (POST /app/messages) và push.
- Android: không đụng bridge LoveCheckAndroid, FCM, Google sign-in, share-target.
- Push `main` = auto deploy production thật, nên mỗi phase phải shippable.

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
- `toast.test.ts` kiểm tra cụ thể `.toast-success .toast-success-heart`, `.toast-success-checkmark`, `width="40"`, unique `linearGradient` ID, `.toast-error .toast-error-heart`, `.toast-loading .loveChat`, `.toast-loading-spark .loveSpark`, và timeout 3000ms -> khi nâng cấp `toast.ts` ở P2 phải giữ các class/attr này.
- `nav.test.ts` kiểm tra `.nav-checkin-btn`, class `active`, `aria-label` `'Đóng check-in'` / `'Tạo check-in mới'` -> giữ nguyên hợp đồng DOM này ở P2.
- File secret ở gốc repo (firebase-adminsdk json, service account, .env*): KHÔNG commit thêm, KHÔNG ghi vào log.

## 7. Bản đồ file
- `apps/pwa/src/styles/`: `index.css`, `00-fonts.css`, `00-tokens.css`, `01-base.css`, `02-utilities.css`, `10-components/*.css`, `20-pages/*.css` (+ CSS cũ chờ dọn ở P7)
- `apps/pwa/src/ui/`: `theme/index.ts`, `icons/icons.ts` (78 icons), `primitives.ts`, `forms.ts`, `feedback.ts`, `overlays.ts`, `ui.test.ts`
- `apps/pwa/public/fonts/`: 18 file `.woff2` (`Be Vietnam Pro` + `Fraunces Variable`) + `OFL.txt`
- `apps/pwa/src/pages/*`: các màn hình (có `ui-preview.ts` cho `/preview/ui`)
- `design/redesign-v2/`: `baseline/` (44 ảnh WebP), `metrics.md`, `icon-spec.md`, `decisions.md`, mocks
