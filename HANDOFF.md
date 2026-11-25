# HANDOFF — Check IN Love (Redesign v2)
Updated: 2026-11-26 01:21 bởi Gemini (Antigravity)

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
- [x] P5 Love Journey + Random + Replies + Card-preview + Test-mail (`styles/20-pages/{journey,secondary}.css`, marker & pháo tim SVG, sheet địa điểm kéo đóng, 23/23 test Love Journey pass)
- [ ] P6 Auth + Onboarding + Install + Profile/Settings
- [ ] P7 PWA: manifest shortcuts, offline.html, SW cache v10, update toast, badging, dọn file patch
- [ ] P8 Android native restyle + APK (CHỈ khi user đồng ý build APK)
- [ ] P9 Tối ưu cuối + báo cáo before/after

## 2. Trạng thái hiện tại
- Phase vừa xong: **P5 (Love Journey + Secondary Screens)** hoàn tất, cây mã sạch, chuẩn bị push `main`.
- Kiểm chứng: `npm run lint` sạch; `npm test` **28 file / 141 test pass**; `npm run build --workspace=apps/pwa` pass (`index` JS gzip = **`34,82 kB`**, mọi file CSS trong `20-pages/` <= 311 dòng, 0 `!important`).

## 3. Bước kế tiếp (P6 — Auth + Onboarding + Install + Profile/Settings)
1. Thiết kế lại `pages/login.ts`, `pages/onboarding.ts`, `pages/google-onboarding.ts`, `pages/install.ts` + `styles/20-pages/auth.css`:
   - Bố cục cảm xúc MIX với minh hoạ SVG "Nét Yêu", form dễ dùng một tay, validate inline, nút Google đúng brand guideline.
   - Stepper onboarding có thanh tiến trình mượt, nhập Couple Code kiểu từng ô OTP 6–8 ký tự (vẫn giữ tương thích 4–8 ký tự chữ/số), giữ toàn bộ khoá `dev_onboarding_*` và `lovecheck_device_id`.
   - Trang `/install` iOS có minh hoạ SVG từng bước (Safari Share -> Thêm vào Màn hình chính) + phát hiện in-app browser (Zalo, Messenger, Facebook, Instagram, TikTok).
2. Thiết kế lại `pages/profile.ts` + `styles/20-pages/profile.css`:
   - Couple Editorial Card (avatar đôi bấm đổi qua `openSheet`, số ngày yêu `Fraunces`, chip tuổi/sinh nhật, streak vàng, sao chép Couple Code).
   - Nhóm cài đặt dạng `ListRow` / Card sạch: Giao diện (Sáng/Tối/Hệ thống + **Bộ chọn 6 màu nhấn Accent Picker** + Giảm chuyển động), Thông báo & Nhắc check-in (trạng thái push + nút thử), Bản đồ hẹn hò, Cài đặt PWA / Kiểm tra APK, Bảo mật & Thiết bị, Đăng xuất; render sạch ngay từ đầu không cần `profile-ui-cleanup.ts`.
   - Giữ tương thích với `.profile-page` cho `profile-copyright.ts` và `anniversary-cards.ts`.
3. Chạy `lint + test + build`, cập nhật `HANDOFF.md` + `PROGRESS.md`, commit + push `main`.

## 4. Ràng buộc bất khả xâm phạm (chi tiết: PROMPT.md mục 1)
- Không sửa `apps/api`, `packages/shared`, `apps/admin`, schema, env, `wrangler.toml`, `docker-compose.yml`, `nginx.conf`.
- Giữ nguyên tên + định dạng mọi khoá `localStorage` + `IndexedDB` + `sessionStorage` (`lovecheck_token`, `lovecheck_state`, `lovecheck_reminder`, `lovecheck_device_id`, `dev_onboarding_*`, `lovecheck_ui_v2_*`).
- Không đổi chữ ký hàm trong `apps/pwa/src/api`, `store`, `router`, `session`.
- Android: không đụng bridge `LoveCheckAndroid`, FCM, Google sign-in (`window.LoveCheckAndroid.signInWithGoogle()` gọi trực tiếp không `?.`), share-target.
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
- Trong `login.ts`, `window.LoveCheckAndroid.signInWithGoogle()` PHẢI gọi trực tiếp sau kiểm tra `typeof === 'function'`, tuyệt đối không dùng optional chaining `?.()` vì Chromium Android WebView lỗi receiver.
- File secret ở gốc repo (`firebase-adminsdk` json, service account, `.env*`): KHÔNG commit thêm, KHÔNG ghi vào log.

## 7. Bản đồ file
- `apps/pwa/src/styles/20-pages/`: `preview-ui.css`, `chat-layout.css`, `chat-bubbles.css`, `chat-menus.css`, `home.css`, `checkin.css`, `camera.css`, `memories.css`, `journey.css`, `secondary.css`
