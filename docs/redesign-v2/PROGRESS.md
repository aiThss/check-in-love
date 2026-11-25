# PROGRESS — Redesign v2 (chỉ THÊM cuối, không sửa dòng cũ)

Mẫu mỗi mục:
## <ngày giờ> — <phase> (<model/agent>)
- Làm: ...
- Commit: <hash> "<msg>"
- Kiểm: lint / test / build / `git diff --stat -- apps/api packages` rỗng
- Dở: <file + lý do>
- Bước tiếp: ...

---

## 2026-11-25 23:58 — Chuẩn bị (Claude Sonnet 5.5)
- Làm: khảo sát repo, chốt phạm vi và hướng làm với user, viết master prompt, tạo hệ thống log bàn giao.
- Kiểm: chưa chạy baseline test/build (việc đầu tiên của P0).
- Dở: chưa có.
- Bước tiếp: P0 theo HANDOFF.md mục 3.

### Snapshot tự động 2026-11-25 23:56
- Nhánh: main
- Commit cuối: 65924d3 fix(api,pwa): restore full NoSQL parity for messages, photo checkins, push/SSE, and optimize D1 queries
- File thay đổi chưa commit:
   M .agents/AGENTS.md
   M AGENTS.md
  ?? HANDOFF.md
  ?? docs/redesign-v2/
  ?? scripts/
- Diff apps/api + packages (phải rỗng): rỗng (OK)

## 2026-11-26 00:05 — P0 (Claude Sonnet 5.5)
- Làm: baseline test/lint/build; audit (audit.md); metrics (metrics.md); 3 mock HTML A/B/C + trang so sánh (DIRECTIONS.md, build-mocks.mjs, shots/ light+dark bằng Chrome headless). Đã sửa các lỗi layout phát hiện khi chụp (seg/dots xếp dọc, tile trống ở A, emoji trong UI thay bằng icon SVG).
- Kiểm: test 26 file/128 pass; build pass; git diff apps/api packages rỗng.
- Dở: chưa chụp screenshot baseline app thật, chưa chạy Lighthouse (làm đầu P1).
- Bước tiếp: CHỜ user chọn hướng thẩm mỹ rồi mới bắt đầu P1.

### Snapshot tự động 2026-11-26 00:03
- Nhánh: main
- Commit cuối: 8bf5388 docs: add AI handoff log system for Redesign v2
- File thay đổi chưa commit:
   M HANDOFF.md
   M docs/redesign-v2/PROGRESS.md
  ?? design/redesign-v2/
- Diff apps/api + packages (phải rỗng): rỗng (OK)

## 2026-11-26 00:10 — Chốt hướng (Claude Sonnet 5.5)
- Làm: user chọn MIX (A + kính B ở nav/sheet + nhãn vàng/micro-animation C + chat C). Thêm mock-mix.html + shots/mix-*.png vào build-mocks.mjs; bỏ animation vào khung tĩnh để ảnh chụp không bị mờ giữa chừng.
- Bước tiếp: P1 (tokens + alias, font tự host, theme/accent engine, icon system, component lib, /preview/ui).

## 2026-11-26 00:30 — P1 Nền tảng Design System v2 (Gemini)
- Làm:
  - Chụp 44 ảnh baseline WebP (`design/redesign-v2/baseline/`) + đo Web Vitals mobile (4x CPU, Fast 3G) ghi vào `metrics.md`.
  - Tự host 18 file `.woff2` (`Be Vietnam Pro` 400/500/600/700 + `Fraunces Variable` normal/italic, đủ tiếng Việt); bỏ Google Fonts & `unpkg lottie-player` trong `index.html`; thêm inline script chống nháy theme trước first paint.
  - Xây dựng kiến trúc CSS `@layer` (`00-fonts`, `00-tokens` + toàn bộ alias tương thích ngược, `01-base`, `02-utilities`, `10-components/*`, `20-pages/preview-ui`), mỗi file <= 350 dòng, 0 `!important` ngoài reduced-motion.
  - Xây dựng `src/ui/theme` (6 preset accent đạt WCAG AA >= 4.5:1 cả sáng/tối, đồng bộ `store` + `<meta name="theme-color">`), `src/ui/icons` (78 icon SVG "Nét Yêu" riêng + `icon-spec.md`), thư viện `src/ui/{primitives,forms,feedback,overlays}.ts`, trang `/preview/ui` và `ui.test.ts`.
- Kiểm: lint ✅ · test ✅ (27 file / 133 test) · build ✅ (`index` gzip 46,18 kB < baseline 46,40 kB) · `git diff apps/api packages apps/admin` rỗng ✅.
- Dở: không có.
- Bước tiếp: P2 (Shell: bottom nav v2, modal/toast/sheet/loader toàn cục, haptics, view transitions, thanh SWR).

### Snapshot tự động 2026-11-26 00:30
- Nhánh: main
- Commit cuối: 75f21eb docs(design): lock MIX direction and add mock-mix
- File thay đổi chưa commit:
   M HANDOFF.md
   M apps/pwa/index.html
   M apps/pwa/src/main.ts
   M apps/pwa/src/styles/tokens.css
   M design/redesign-v2/metrics.md
   M docs/redesign-v2/DECISIONS.md
   M docs/redesign-v2/PROGRESS.md
  ?? apps/pwa/public/fonts/
  ?? apps/pwa/src/pages/ui-preview.ts
  ?? apps/pwa/src/styles/00-fonts.css
  ?? apps/pwa/src/styles/00-tokens.css
  ?? apps/pwa/src/styles/01-base.css
  ?? apps/pwa/src/styles/02-utilities.css
  ?? apps/pwa/src/styles/10-components/
  ?? apps/pwa/src/styles/20-pages/
  ?? apps/pwa/src/styles/index.css
  ?? apps/pwa/src/ui/
  ?? design/redesign-v2/baseline/
  ?? design/redesign-v2/decisions.md
  ?? design/redesign-v2/icon-spec.md
- Diff apps/api + packages (phải rỗng): rỗng (OK)
