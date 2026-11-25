# Metrics baseline (P0) — 2026-11-26

Máy dev Windows, Node 20+, chạy ngay trước khi sửa bất kỳ mã nào cho Redesign v2.

| Chỉ số | Giá trị |
|---|---|
| `npm test` | **26 file, 128 test, tất cả pass** (~8 s) |
| `npm run lint` | sạch (chỉ có thông báo npm notice) |
| `npm run build --workspace=apps/pwa` | pass, `vite build` 4,0 s |
| Chunk `index` (JS lõi) | 150,83 kB · gzip **46,40 kB** |
| Chunk `messages` | 47,62 kB · gzip 15,38 kB |
| Chunk `profile` | 25,55 kB · gzip 8,03 kB |
| Chunk `onboarding` | 23,37 kB · gzip 7,20 kB |
| Chunk `memories` | 21,14 kB · gzip 7,53 kB |
| Chunk `home` | 19,80 kB · gzip 6,82 kB |
| Chunk `checkin` | 16,36 kB · gzip 6,13 kB |
| Chunk `love-journey` (MapLibre) | 1.086,23 kB · gzip **297,33 kB** |
| CSS tổng (dòng) | components 5.785 · auth 1.314 · love-journey 1.165 · thread-enh 680 · polaroid 466 · layout-fix 295 · animations 303 · tokens 124 · viewer 81 |

Ngân sách cho Redesign (PROMPT.md mục 7.5): JS khởi tạo (gzip) không vượt baseline +10% → trần **≈51 kB** cho chunk `index`.

## Chưa đo (làm đầu P1)

- Lighthouse mobile: LCP, INP, CLS, TBT, điểm Performance/Accessibility/Best Practices/PWA.
- Screenshot baseline từng màn (light/dark, 360×800 và 390×844).
