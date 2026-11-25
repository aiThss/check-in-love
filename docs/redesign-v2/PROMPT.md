# MASTER PROMPT — Check IN Love Redesign v2

> Hợp đồng gốc đã được user duyệt. Mọi AI đều đọc bản này. Thay đổi phải ghi vào DECISIONS.md.

```text
VAI TRÒ
Bạn là Senior Product Designer + Staff Frontend Engineer (PWA, mobile-first, WebView Android). Nhiệm vụ: ĐẬP ĐI XÂY LẠI toàn bộ thiết kế, UX-UI của app "Check IN Love" (app check-in riêng tư cho 2 người yêu nhau), giữ nguyên logic nghiệp vụ, bảng màu gốc và 100% dữ liệu hiện có. Làm tiếng Việt cho mọi copy/UI text; mọi báo cáo gửi tôi viết tiếng Việt, ngắn gọn, kèm bảng tổng hợp.

════════════════════════════════════════
0. QUY TRÌNH BẮT BUỘC TRƯỚC KHI CODE
════════════════════════════════════════
0.1 Đọc theo thứ tự: HANDOFF.md (nếu chưa có thì TẠO ở gốc repo), AGENTS.md (gốc và .agents/), `git status`, `git log -5`. Áp dụng skill `karpathy-guidelines` và `ai-handoff-continuity`.
0.2 Ghi vào HANDOFF.md: toàn bộ yêu cầu này nguyên văn dạng checklist, trạng thái hiện tại, bước tiếp theo, lệnh build/test, gotchas. Cập nhật sau MỖI phase để AI khác tiếp tục được nếu bạn hết token.
0.3 Chụp BASELINE trước khi sửa: `npm test`, `npm run lint`, `npm run build --workspace=apps/pwa` đều phải ghi lại kết quả; chụp screenshot mọi màn hình (light + dark, 360×800 và 390×844) lưu `design/redesign-v2/baseline/`. Đo baseline Lighthouse mobile (LCP, INP, CLS, TBT, bundle size) ghi vào `design/redesign-v2/metrics.md`.
0.4 Kiểm kê (inventory) và ghi vào HANDOFF.md: mọi route, mọi page export, mọi class/data-attribute mà test đang bám, mọi endpoint API mà PWA gọi, mọi khoá storage. Không được đoán — đọc code.

════════════════════════════════════════
1. HỢP ĐỒNG DỮ LIỆU — BẤT KHẢ XÂM PHẠM
════════════════════════════════════════
Mục tiêu "không ảnh hưởng dữ liệu hiện tại". Các điều sau TUYỆT ĐỐI không đổi:
1.1 KHÔNG sửa `apps/api/**`, schema D1/Mongo, migration, `packages/shared` types (chỉ được THÊM field optional nếu thật sự bắt buộc và phải hỏi tôi trước), biến môi trường, `wrangler.toml`, `docker-compose.yml`, `nginx.conf`.
1.2 KHÔNG đổi chữ ký/đường dẫn/payload của bất kỳ hàm trong `apps/pwa/src/api/**` (client.ts, auth.ts, messages.ts, checkins.ts, push.ts, events.ts, journey.ts, profile.ts, random.ts, message-outbox.ts, query-cache.ts, chat-background.ts) và `store/`, `session.ts`, `router.ts` (logic history/boundary/layer), `route-invalidation.ts`. Chỉ được thêm hook/tiện ích mới BÊN CẠNH.
1.3 Khoá storage phải giữ NGUYÊN TÊN + ĐỊNH DẠNG + ĐỌC ĐƯỢC dữ liệu cũ (không migrate phá hủy, không xoá):
  - localStorage: `lovecheck_token`, `lovecheck_state`, `lovecheck_chat_wallpaper`, `lovecheck_chat_background_v1`, `lovecheck_message_draft_after_sticker`, `lovecheck_journey_bucket`, `lovecheck_journey_places`, `lovecheck_journey_seed_cleanup_v1`, `lovecheck:occasion-card:seen:v1:*`, `lovecheck:birthday-setup-notice:v1:*`, `lovecheck:daily-surprise:first-partner-photo:v2:*`, `lovecheck:daily-surprise:love-foil:v1:*`, `lovecheck_dev_*`, `dev_*`.
  - IndexedDB: `lovecheck-message-outbox` (tin chưa gửi — mất = mất tin!), `lovecheck-share-v1` (share target).
  - Khoá MỚI (theme/accent/ui prefs) phải dùng prefix `lovecheck_ui_v2_*` và có giá trị mặc định khi vắng.
1.4 Service worker: được nâng `CACHE_NAME` (lovecheck-v9 → v10…) và thêm precache, nhưng KHÔNG được cache `/api/*` (đang là networkOnly vì bảo mật), KHÔNG phá `captureShareTarget` (POST /app/messages), KHÔNG phá push/notificationclick, vẫn giữ cơ chế "waiting worker chờ app chấp nhận update".
1.5 Android: KHÔNG đụng JS bridge `LoveCheckAndroid` (chữ ký các hàm: updateWidget, updatePartnerCheckin, downloadFile, openPhotoViewer, signInWithGoogle, getFcmToken, setAuthToken, getFcmDebugInfo, getPendingShareData, showLocalNotification*), FCM service, Google sign-in, share-target, deep-link/back handler, permission flow. Chỉ restyle phần HIỂN THỊ.
1.6 Route URL giữ nguyên: /login, /onboarding, /install, /preview/cards, /test-mail, /app/home, /app/memories, /app/checkin, /app/messages, /app/profile, /app/onboarding, /app/google-onboarding, và các route khác trong router (random, replies, love-journey — đọc router.ts/main.ts để lấy đủ). Deep link, share-target, notification targetUrl phải còn hoạt động.
1.7 Mọi tính năng hiện có phải còn nguyên: đăng nhập (email + Google), onboarding ghép đôi bằng couple code, check-in ảnh (camera), reaction/reply, chat (text, ảnh, sticker, reply-gesture, wallpaper/background, outbox offline, SSE realtime), kỷ niệm, love-journey (bản đồ MapLibre, bucket list, places), thẻ kỷ niệm/anniversary scratch-card, daily surprise polaroid, random, replies, profile (reminder, theme, copyright), push đa tầng (FCM + SSE + WebPush).
1.8 Tuyệt đối không log/hiển thị token, không đưa file secret (firebase-adminsdk json, service account, .env*) vào commit hay mock.
Nếu một thay đổi UI buộc phải vi phạm bất kỳ điều nào ở trên → DỪNG, hỏi tôi.

════════════════════════════════════════
2. PHASE 0 — KHẢO SÁT & 3 HƯỚNG MOCK (CỔNG DỪNG #1)
════════════════════════════════════════
Tạo thư mục `design/redesign-v2/` (KHÔNG nằm trong apps/pwa nên không bị deploy). Trong đó:
2.1 `audit.md`: đánh giá UI hiện tại theo từng màn (điểm yếu hierarchy, tap target <44px, độ tương phản <4.5:1, emoji dùng làm icon, spacing lộn xộn, animation non-compositor, nợ kỹ thuật). Nợ đã biết cần xử lý: `components.css` ~5.800 dòng; file vá `messages-layout-fix.css`, `message-thread-enhancements.css/.ts`, `profile-ui-cleanup.ts`, `anniversary-cards.ts` (79KB, tiêm DOM sau render), khối CSS `!important` chèn trong `main.ts`, nav dùng emoji 🏠📸💬 + `user.png`, `index.html` tải Google Fonts + `unpkg lottie-player@latest` (không pin version, chặn render), SW tham chiếu `/offline.html` nhưng file này KHÔNG tồn tại trong public/.
2.2 BA hướng thẩm mỹ, mỗi hướng là 1 file HTML tĩnh tự chứa (light + dark, 390×844) gồm tối thiểu 5 màn: Home, Chat thread, Check-in camera, Memories grid, Profile; kèm bottom nav + 1 bottom sheet + 1 bộ 12 icon mẫu. Giữ bảng màu gốc: accent #ff3b7f, nền hồng phấn #f8e2e7, dark plum #261824→#632d4d, text #1f0f15. Ba hướng khác biệt thật sự về ngôn ngữ thị giác, ví dụ:
  A. "Soft Editorial Romance": nền kem/hồng phấn + grain nhẹ, tiêu đề serif/rounded, card bo lớn kiểu polaroid/scrapbook, glass CHỈ ở nav + sheet.
  B. "Liquid Glass 2.0": glass có chiều sâu, specular, ánh sáng theo con trỏ/gyro, motion tinh chỉnh.
  C. "Playful Sticker": màu đậm hơn, viền dày, icon dạng sticker bóng, bounce mạnh.
2.3 Mỗi hướng ghi: typographic scale, elevation, radius, motion language, 3 ưu/nhược, ước lượng chi phí hiệu năng trên Android WebView tầm trung.
2.4 Mỗi mock phải pass: tương phản WCAG AA, tap target ≥44×44, tiếng Việt có dấu hiển thị đúng font.
>>> DỪNG. Báo cáo tôi và CHỜ tôi chọn 1 hướng (hoặc trộn). KHÔNG code vào apps/pwa trước khi tôi trả lời. <<<

════════════════════════════════════════
3. HỆ THỐNG THIẾT KẾ (sau khi tôi chọn hướng)
════════════════════════════════════════
3.1 Kiến trúc CSS mới, thay cho các file hiện tại, import theo lớp bằng `@layer`:
  `styles/00-tokens.css` → `01-base.css` (reset, typography, focus ring, safe-area) → `02-utilities.css` → `10-components/*.css` (button, icon-button, card, sheet, modal, toast, input, avatar, badge, list-row, nav, skeleton, chip…) → `20-pages/*.css` (home, chat, checkin, memories, journey, profile, auth, onboarding, install…).
  Quy tắc: không `!important` (trừ override a11y/reduced-motion), không selector sâu >3 cấp, mỗi component 1 file ≤400 dòng, BEM-lite `.c-btn`, `.c-card`… Tên class mới có prefix `c-`/`p-` để không đụng class cũ trong lúc chuyển tiếp.
3.2 Tokens (CSS custom properties, có alias tương thích ngược `--bg --surface --text-primary --accent --border --shadow …` trỏ tới token mới để các trang chưa chuyển vẫn chạy):
  - Màu: neutral scale 12 bậc (light/dark), accent scale 10 bậc từ #ff3b7f, semantic (success/warn/danger/info), màu "bong bóng chat" của mình/đối phương, màu overlay. Tính sẵn cặp text/nền đạt AA.
  - Accent picker: biến `--accent-h/--accent-s/--accent-l` (hoặc OKLCH) để toàn bộ scale suy ra từ 1 màu nhấn; ≥6 preset (mặc định = #ff3b7f); lưu `lovecheck_ui_v2_accent`.
  - Theme: light / dark / system, lưu cách hiện tại + `lovecheck_ui_v2_theme`; đồng bộ `<meta name="theme-color">` động theo theme và accent; không flash sai theme khi tải (inline script nhỏ trong index.html đọc storage trước paint).
  - Typography: tự host font variable (subset latin + latin-ext + vietnamese, `font-display: swap`, preload 1–2 file). Gợi ý: Be Vietnam Pro (đã có trong Android res) cho body; display font tuỳ hướng được chọn. Scale 12/13/15/17/20/24/30/38, line-height + tracking cụ thể, `font-variant-numeric: tabular-nums` cho số/đồng hồ.
  - Spacing 4px grid; radius scale (xs 8, sm 12, md 16, lg 24, xl 32, pill); elevation 5 mức + dark variant; z-index scale có tên.
  - Motion: duration (instant 90, fast 160, base 240, slow 420), easing (standard, emphasized, spring qua `linear()` hoặc cubic-bezier), quy tắc: CHỈ animate `transform` và `opacity` (compositor), `will-change` có kiểm soát, không animate layout/`filter` lớn. `@media (prefers-reduced-motion: reduce)` → thay bằng fade ngắn, tắt parallax/bounce/lottie.
3.3 Component library TS nhỏ gọn trong `src/ui/` (hàm trả về HTMLElement, không framework): Button (primary/secondary/ghost/danger/icon, loading, disabled, pressed), IconButton, Card, Avatar (ảnh + fallback chữ cái + presence), Badge/Dot, Chip, Input/Textarea (label nổi, lỗi, helper), Switch, Segmented control, ListRow, Sheet (bottom sheet kéo-đóng, snap points), Modal/Dialog, Toast (thay components/toast.ts nhưng giữ API đang dùng), Skeleton, EmptyState (minh hoạ SVG riêng), PullToRefresh, Tooltip/Popover menu, Tabs. Mỗi component có trạng thái: default/hover(pointer fine)/active/focus-visible/disabled/loading/error. Xuất ra trang `/preview/ui` (chỉ khi `import.meta.env.DEV`) để duyệt toàn bộ component + icon.

════════════════════════════════════════
4. BỘ ICON TỰ VẼ — "ĐẸP MẮT, KHÔNG ĐẠI TRÀ"
════════════════════════════════════════
4.1 Tạo `src/ui/icons/` : 1 module TS (`icons.ts`) + sprite `<symbol>` (inline 1 lần vào DOM) + helper `icon(name, {size, variant, class})`. Không thêm dependency icon.
4.2 Ngôn ngữ hình ảnh thống nhất (viết thành spec trong `design/redesign-v2/icon-spec.md`): lưới 24×24, nét 1.75px, đầu nét/góc bo tròn, "nét yêu" đặc trưng của riêng app (ví dụ: mọi icon có một điểm cong mềm/đuôi trái tim tinh tế hoặc góc bo bất đối xứng — chọn theo hướng thẩm mỹ đã duyệt). Hai biến thể: `outline` (mặc định) và `filled/duotone` (trạng thái active, dùng `currentColor` + lớp mờ 18% accent).
4.3 Danh sách tối thiểu (~70): nav (home, memories, plus/check-in, chat, profile), camera, flash, flip-camera, shutter, gallery, send, attach, image, sticker, emoji, mic(nếu cần), reply, forward, copy, delete, more, back, close, check, double-check (đã xem), clock (đang gửi), alert, heart, heart-broken, heart-burst, reaction set (≥6 reaction thiết kế riêng, KHÔNG dùng emoji hệ thống), streak/flame, calendar, anniversary/cake, gift, location-pin, map, route, bucket-list, scratch-card, polaroid, search, filter, settings, bell, bell-off, moon, sun, palette, lock, shield, key, mail, google, eye, eye-off, edit, share, download, upload, refresh, link, user, users/couple, logout, install, wifi-off, info, help, star, sparkle. Mỗi icon phải nhận diện được ở 16px và 24px.
4.4 Hoạt hình icon (CSS/SMIL nhẹ, không Lottie nặng): nav active (nảy + đổ màu, ≤240ms), tim "đập" khi thả reaction, shutter nén-nhả, send bay lên, check → double-check đổi màu, refresh xoay, bell lắc. Dùng `stroke-dashoffset` cho hiệu ứng vẽ nét. Tắt khi reduced-motion.
4.5 Thay TOÀN BỘ emoji-làm-icon, `user.png`, icons8 png/gif/json, `refresh-icon.ts`, `smile-plus-icon.ts`, `love-eq-loader.ts`, `love-spark-loader.ts` bằng icon/loader mới (giữ API xuất của file cũ hoặc cập nhật mọi nơi gọi). Emoji CHỈ còn trong nội dung người dùng gõ. Xoá asset không còn dùng (kiểm bằng grep trước khi xoá; không xoá file đang được Android/widget tham chiếu).
4.6 Icon app (launcher) mới: `icon-192/512`, maskable có safe-zone 80%, Apple touch 120/152/180, `badge.svg` monochrome cho push, favicon SVG, splash. Cùng ngôn ngữ với bộ icon.

════════════════════════════════════════
5. THIẾT KẾ LẠI TỪNG MÀN HÌNH
════════════════════════════════════════
Quy tắc chung mỗi màn: thumb-zone (hành động chính nằm nửa dưới), 1 CTA chính/màn, hierarchy rõ (≤3 cấp chữ), trạng thái đủ bộ: loading(skeleton)/empty/error/offline/partial, tôn trọng safe-area + bàn phím ảo (đã có utils/keyboard.ts), hoạt động ở 320px→430px và tablet/desktop (căn giữa, max-width 480–520). Mỗi màn: viết lại markup, KHÔNG đổi logic gọi API.
5.1 Shell + Bottom nav: nav 5 mục, nút check-in trung tâm là điểm nhấn (không phải dấu + chung chung: thiết kế dạng nút "ống kính/trái tim" riêng, glow/ring theo accent, nhấn → shutter micro-animation), indicator trượt giữa các tab (transform), badge tin chưa đọc (số/chấm), ẩn nav khi bàn phím mở/ở màn full-screen, haptic nhẹ. Back/predictive-back vẫn theo `router.ts`.
5.2 Auth (login/onboarding/google-onboarding/install): bố cục cảm xúc, minh hoạ SVG riêng, form dễ dùng một tay, validate inline, nút Google đúng brand guideline, stepper onboarding có tiến trình + chuyển bước mượt, nhập couple code kiểu OTP từng ô, trang cài đặt iOS có minh hoạ từng bước (Share → Add to Home Screen) + phát hiện in-app browser.
5.3 Home: hero hôm nay (streak, số ngày yêu, trạng thái check-in 2 người), ảnh/ polaroid cover nổi bật (giữ logic polaroid-cover + daily-first-photo scratch), CTA check-in, feed gần đây dạng card tối ưu ảnh (blur-up, aspect ratio cố định, không giật layout), pull-to-refresh tuỳ biến, widget "thẻ kỷ niệm/anniversary" thiết kế lại (thay patch DOM của anniversary-cards.ts bằng component thật nếu an toàn, giữ nguyên key `seen`).
5.4 Check-in (camera): viewfinder full-bleed, lưới/tỉ lệ vuông, chuyển camera, flash, đếm ngược, shutter lớn có phản hồi, preview + caption + chọn cảm xúc/ghi chú, upload có progress vòng, huỷ/chụp lại rõ ràng, xử lý quyền camera bị từ chối bằng màn hướng dẫn đẹp. Giữ nguyên format ảnh/kích thước nén đang gửi lên API.
5.5 Memories: lưới/masonry hoặc timeline theo tháng với sticky header, shared-element transition từ thumbnail → viewer, viewer ảnh có pinch-zoom, vuốt xuống đóng, vuốt ngang chuyển ảnh, thông tin + reaction + reply; skeleton; empty state có minh hoạ.
5.6 Love Journey: bản đồ MapLibre giữ nguyên engine/worker config (xem vite.config.ts `optimizeDeps.exclude`), restyle control, marker thiết kế riêng, sheet chi tiết địa điểm kéo được, bucket list dạng card có checkbox animate, timeline; giữ nguyên định dạng `lovecheck_journey_*` và hàm migrate/validate hiện có (có test).
5.7 Random / Replies / Card-preview / Test-mail: đồng bộ design system.
5.8 Profile & Settings: header cá nhân + couple card, nhóm setting dạng list-row (Giao diện: theme + accent picker + giảm chuyển động; Thông báo: trạng thái push từng tầng + nút thử; Reminder; Cài đặt app/PWA; Bảo mật/thiết bị tin cậy; Đăng xuất), xoá `profile-ui-cleanup.ts` bằng cách render đúng ngay từ đầu.
5.9 Chat (ưu tiên cao nhất — xem mục 6).
5.10 Modal/Toast/Sheet/Loader toàn cục: đồng bộ, có focus trap, ESC/back đóng, aria-live cho toast.

════════════════════════════════════════
6. CHAT — TRẢI NGHIỆM NHƯ APP NHẮN TIN NATIVE
════════════════════════════════════════
Giữ nguyên: API messages, outbox IndexedDB, SSE, reply-gesture logic, sticker input, wallpaper/background, image viewer, share-target. Làm lại phần hiển thị + tương tác:
6.1 Layout: header (avatar + trạng thái đối phương + menu), danh sách tin nhắn, composer dính đáy; dùng `100dvh` + visualViewport để composer KHÔNG nhảy khi bàn phím mở/đóng; safe-area; wallpaper có overlay đảm bảo tương phản (giữ image-contrast util).
6.2 Bong bóng: nhóm tin liên tiếp (bo góc khác nhau đầu/giữa/cuối nhóm), đuôi bong bóng tinh tế, màu theo token (mình = accent, đối phương = surface), tin chỉ-emoji hiển thị lớn, link preview đơn giản, ảnh có aspect-ratio giữ chỗ + blur-up + bo góc, nhiều ảnh dạng lưới, sticker không nền bong bóng; ngăn cách ngày dạng chip sticky; "tin mới ↓" nổi khi đang cuộn lên.
6.3 Trạng thái gửi (thay chữ/emoji): đang gửi (clock), đã gửi (1 check), đã đến, đã xem (double-check màu accent), lỗi (alert + nhấn để gửi lại/huỷ) — gắn với outbox hiện có; optimistic send: tin hiện NGAY, animation vào ≤200ms, không nháy khi server trả id thật (reconcile theo clientId hiện có).
6.4 Typing indicator (3 chấm sóng, chỉ dùng event/field hiện có; nếu backend chưa phát typing thì CHỈ dựng UI + ghi chú, không tự thêm endpoint).
6.5 Hiệu năng danh sách: windowing/virtualization hoặc `content-visibility:auto` + `contain-intrinsic-size` cho thread dài (>500 tin); tải tin cũ khi cuộn lên với scroll-anchoring giữ vị trí (không giật), dùng IntersectionObserver; không re-render toàn bộ khi nhận 1 tin SSE (append/patch từng node); ảnh lazy + decoding async.
6.6 Tương tác: swipe-to-reply (spring, icon reply lộ ra, haptic ở ngưỡng), long-press mở menu ngữ cảnh + thanh reaction nổi (blur nền, bong bóng phóng nhẹ, các reaction là icon tự vẽ), double-tap để thả tim, kéo thả/ dán/ chia sẻ ảnh, sticker picker dạng sheet có tab + tìm, voice note (CHỈ nếu đã có trong code, không thêm tính năng mới), chọn nhiều tin.
6.7 Composer: textarea tự giãn (tối đa 5 dòng), nút gửi chuyển đổi (attach/camera ↔ send) có animation, preview ảnh trước khi gửi, trích dẫn reply dạng thanh đóng được, nháp được giữ (khoá `lovecheck_message_draft_after_sticker` hiện có vẫn hoạt động), enter-to-send chỉ trên desktop.
6.8 Hợp nhất `messages.ts` (79KB) + `message-thread-enhancements` + `messages-layout-fix.css` thành module rõ ràng (vd `pages/messages/{index,thread,composer,bubble,menu,wallpaper}.ts`), cập nhật `messages.test.ts` + `message-thread-enhancements.test.ts` theo DOM mới nhưng GIỮ mọi hành vi đang được kiểm (menu, wallpaper, outbox, reply, viewer…). Không giảm số lượng ca kiểm hành vi.

════════════════════════════════════════
7. ĐỘ MƯỢT, PWA, HIỆU NĂNG
════════════════════════════════════════
7.1 Chuyển trang: View Transitions API (`document.startViewTransition`) với fallback an toàn (feature-detect, WebView cũ vẫn chạy bằng animation CSS đơn giản); phân biệt tiến/lùi (slide + fade), tab ngang (cross-fade), mở viewer (shared element `view-transition-name`); giữ scroll position từng route khi quay lại; tương thích cơ chế history boundary/layer trong router.ts (không phá nút back Android).
7.2 Dữ liệu tức thì: dùng `query-cache.ts` hiện có để render từ cache NGAY rồi revalidate nền (stale-while-revalidate); skeleton đúng hình dạng nội dung (không spinner toàn trang); trạng thái "đang cập nhật" mảnh (thanh mỏng trên cùng); không CLS.
7.3 Gesture & haptic: tiện ích `haptics.ts` (navigator.vibrate pattern ngắn, tắt khi không hỗ trợ/reduced-motion), spring physics cho kéo (pull-to-refresh, bottom-sheet kéo đóng, swipe-back, swipe-reply) dùng pointer events + rAF, `touch-action` đúng, không chặn scroll dọc.
7.4 Hiệu năng: code-split theo route (đã có dynamic import → giữ), preload route kế tiếp khi idle/`pointerdown` trên nav, tách chunk MapLibre chỉ tải ở love-journey, `content-visibility:auto` cho danh sách dài, ảnh AVIF/WebP + `srcset`/`sizes` nếu API/CDN hỗ trợ (không đổi API; nếu không thì chỉ dùng loading=lazy + decoding=async + blur-up bằng màu trung bình/thumb sẵn có), bỏ Google Fonts + `unpkg lottie-player@latest` (tự host font; bỏ lottie nếu thay bằng SVG animation, hoặc tự host bản pin version, tải lazy), tránh `backdrop-filter` chồng lớp (tối đa 1–2 lớp glass trên màn hình, có fallback màu đặc khi `@supports not` hoặc máy yếu), tránh box-shadow lớn animate, dùng `contain: layout paint` cho cột/ô lặp.
7.5 Ngân sách hiệu năng (đo trên throttle 4× CPU, Fast 3G, Moto G Power-class): LCP ≤2.0s, INP ≤150ms, CLS ≤0.05, JS khởi tạo (gzip) không lớn hơn baseline +10%, 60fps khi cuộn thread chat 1000 tin, mở chat ≤300ms từ cache.
7.6 PWA: manifest (thêm `shortcuts`: Check-in, Tin nhắn, Kỷ niệm; `screenshots` mobile; icon any + maskable riêng; `categories`; `theme_color`/`background_color` khớp theme; GIỮ `share_target`, `id`, `scope`, `start_url`); `offline.html` đẹp (self-contained, cùng design system, nút thử lại, có dark) + thêm vào precache (hiện đang thiếu file); update toast "Có phiên bản mới — Cập nhật" (giữ luồng waiting worker + `controllerchange`); install prompt (`beforeinstallprompt` tuỳ biến, đúng thời điểm, nhớ lựa chọn "để sau"); `Badging API` (`navigator.setAppBadge`) theo số tin chưa đọc; safe-area + `viewport-fit=cover` + `interactive-widget=resizes-content` (nếu hỗ trợ) chuẩn; `color-scheme` meta; tránh overscroll bounce kéo reload ngoài ý muốn (`overscroll-behavior`).
7.7 Âm thanh/micro-animation: gửi tin (swoosh rất nhẹ, tắt mặc định hoặc theo cài đặt + tôn trọng silent), check-in thành công (burst tim SVG), thả tim reaction, mở thẻ kỷ niệm. Animation tự thiết kế bằng SVG/CSS/WAAPI, mỗi cái ≤2KB, không thêm thư viện.
7.8 A11y: mọi icon-button có `aria-label` tiếng Việt, focus-visible rõ, thứ tự tab đúng, role/aria cho nav/dialog/sheet/toast, hỗ trợ cỡ chữ hệ thống tới 130% không vỡ layout, tương phản AA cả light/dark/accent bất kỳ (kiểm bằng hàm tính luminance trong test).

════════════════════════════════════════
8. LỚP NATIVE ANDROID (apps/android)
════════════════════════════════════════
Thực chất app là WebView bọc PWA (StickerWebView/MainActivity) → UI chính tự đổi theo PWA. Chỉ chạm các điểm native sau, KHÔNG đụng logic Kotlin/bridge/FCM:
8.1 `res/values{,-night}/themes.xml`, `theme/Color.kt`, `theme/Theme.kt`: đồng bộ windowBackground, status/navigation bar, màu nền splash với tokens mới (light/dark) → không flash trắng trước khi WebView lên; nhưng KHÔNG sửa luồng onPageFinished/inject token.
8.2 Splash: Android 12+ SplashScreen API với icon animated nhẹ + màu nền theo theme.
8.3 Launcher icon: adaptive (foreground + background + monochrome cho themed icon Android 13+), thay toàn bộ mipmap.
8.4 Widget (`love_check_widget.xml`, `love_check_quick_widget.xml`, drawable widget_*): restyle theo ngôn ngữ mới, bo góc/typography/scrim ảnh; giữ nguyên id view mà `LoveCheckWidgetProvider`/`LoveCheckQuickWidgetProvider` đang tham chiếu (đổi id = vỡ widget).
8.5 `PhotoViewerActivity`, `dialog_update.xml`, `bg_dialog/bg_button_*`: restyle đồng bộ, giữ hành vi.
8.6 Thông báo: giữ kênh `realtime_interactions`, IMPORTANCE_HIGH, avatar tròn, BigPicture; chỉ cập nhật `ic_notification` (icon trắng nền trong suốt theo bộ icon mới) và màu accent (`setColor`).
8.7 Nếu sửa native: tăng `versionCode` +1, `versionName` theo quy tắc AGENTS.md, build `assembleRelease`, copy `app-release.apk` ra gốc. Android có thể gói ở phase riêng cuối cùng.
8.8 Kiểm tương thích WebView: View Transitions/`@property`/`color-mix`/`dvh` cần feature-detect + fallback cho WebView ≥ Chrome 90; test trên emulator API 26/29/34.

════════════════════════════════════════
9. KẾ HOẠCH GIAO HÀNG THEO PHASE (mỗi phase push main nên PHẢI shippable)
════════════════════════════════════════
Vì push `main` = auto deploy production và người dùng thật thấy ngay, mỗi phase kết thúc phải: build xanh, test xanh, không UI vỡ, không mất dữ liệu. Dùng alias token tương thích ngược + prefix class mới để UI cũ/mới sống chung trong giai đoạn chuyển.
- P0  Khảo sát + 3 mock + baseline → DỪNG chờ tôi chọn. (không đụng apps/pwa)
- P1  Nền tảng: tokens (+alias), base CSS, font tự host, theme/accent engine, icon system + spec, component library + trang /preview/ui. Trang cũ vẫn chạy nguyên.
- P2  Shell: bottom nav mới + check-in button, modal/toast/sheet/loader toàn cục, haptics, view transitions, skeleton/SWR plumbing.
- P3  Chat (messages) làm lại hoàn chỉnh + cập nhật test.
- P4  Home + Check-in camera + Memories + viewer.
- P5  Love Journey + Random + Replies + Card-preview.
- P6  Auth + Onboarding + Install + Profile/Settings.
- P7  PWA: manifest/shortcuts, offline.html, SW cache v10, update toast, install prompt, badging, icon app, bỏ unpkg/Google Fonts; dọn CSS/TS cũ & asset mồ côi; cleanup patch files.
- P8  Android native restyle + build APK (nếu tôi đồng ý phát hành).
- P9  Tối ưu cuối: đo lại metrics, a11y audit, dọn dead code, cập nhật README/HANDOFF, báo cáo before/after.

Sau MỖI phase, chạy và báo cáo (gộp 1 script PowerShell):
  npm run lint ; npm test ; npm run build --workspace=apps/pwa ; kiểm tra `git diff --stat -- apps/api packages` PHẢI rỗng (bằng chứng không đụng backend/shared).
Rồi: cập nhật HANDOFF.md → `git add .` → `git commit -m "feat(pwa): …"` (Conventional Commits) → `git push` (PowerShell: mỗi lệnh một dòng, không dùng `&&`). Không bao giờ kết thúc phase mà chỉ commit không push. Chỉ dừng hỏi tôi cho thao tác phá huỷ (`push --force`, `reset --hard`, xoá file gốc không phục hồi).

════════════════════════════════════════
10. TIÊU CHÍ NGHIỆM THU
════════════════════════════════════════
Dữ liệu:
  ☐ `git diff --stat main~N -- apps/api packages apps/admin` rỗng; không đổi schema/endpoint/payload.
  ☐ Mở bản mới với tài khoản + localStorage + IndexedDB cũ: đăng nhập còn nguyên, tin trong outbox vẫn gửi được, wallpaper/background/draft/journey/card-seen giữ nguyên, push vẫn nhận (FCM, SSE, WebPush), widget Android vẫn cập nhật.
  ☐ Test migrate: viết test nạp snapshot localStorage cũ (fixture) → UI mới đọc đúng.
Chất lượng:
  ☐ `npm test` ≥ số ca kiểm hành vi trước đó, lint sạch, TypeScript strict sạch, build xanh.
  ☐ Không còn emoji-làm-icon, không `!important` ngoài ngoại lệ, không file CSS/TS patch cũ, không Google Fonts/unpkg ở runtime.
  ☐ Lighthouse mobile: Performance ≥90, Accessibility ≥95, Best Practices ≥95, PWA installable; ngân sách mục 7.5 đạt.
  ☐ Mọi màn có đủ trạng thái loading/empty/error/offline; reduced-motion + dark + accent bất kỳ không vỡ; 320px→430px + desktop căn giữa ổn.
  ☐ Screenshot after cho mọi màn (light/dark) so với baseline trong `design/redesign-v2/`.
Báo cáo cuối (tiếng Việt, bảng): thay đổi theo phase, metrics before/after, danh sách file xoá/thêm, rủi ro còn lại, hướng dẫn rollback (revert commit từng phase; SW cache bump giúp client tự cập nhật).

NGUYÊN TẮC LÀM VIỆC
- Thay đổi tối thiểu cần thiết cho từng phase; không thêm tính năng ngoài danh sách; không thêm dependency nếu không thật cần (nếu cần → hỏi).
- Không đoán: đọc code trước khi sửa; có nghi ngờ về dữ liệu → dừng hỏi.
- Mỗi quyết định thiết kế quan trọng ghi 1–2 dòng lý do vào `design/redesign-v2/decisions.md`.
```n