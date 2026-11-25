# Metrics baseline (P0/P1) — 2026-11-26

Máy dev Windows, Node 24, chạy trước khi sửa mã ứng dụng cho Redesign v2.

## 1. Build & Bundle Baseline

| Chỉ số | Giá trị |
|---|---|
| `npm test` | **26 file, 128 test, tất cả pass** (~7,1 s) |
| `npm run lint` | sạch (0 error, 0 warning) |
| `npm run build --workspace=apps/pwa` | pass, `vite build` 3,77 s |
| Chunk `index` (JS lõi) | 150,83 kB · gzip **46,40 kB** |
| Chunk `messages` | 47,62 kB · gzip 15,38 kB |
| Chunk `profile` | 25,55 kB · gzip 8,03 kB |
| Chunk `onboarding` | 23,37 kB · gzip 7,20 kB |
| Chunk `memories` | 21,14 kB · gzip 7,53 kB |
| Chunk `home` | 19,80 kB · gzip 6,82 kB |
| Chunk `checkin` | 16,36 kB · gzip 6,13 kB |
| Chunk `love-journey` (MapLibre) | 1.086,23 kB · gzip **297,33 kB** |
| CSS tổng (`index-*.css`) | 141,43 kB · gzip 24,75 kB |

Ngân sách cho Redesign (`PROMPT.md` mục 7.5): JS khởi tạo (gzip) không vượt baseline +10% → trần **≈ 51,04 kB** cho chunk `index`.

## 2. Mobile Throttled Web Vitals Baseline (Chrome Headless CDP — 4× CPU, Fast 3G, 390×844)

> Lưu ý: khi đo offline local preview, các CDN ngoài (`unpkg lottie-player`, `fonts.googleapis.com`) bị chặn để không treo trình duyệt; trên mạng thật 3G các CDN đồng bộ trong `<head>` còn cộng thêm 300–900 ms chặn render.

| Tuyến đường | FCP (ms) | LCP (ms) | CLS | TBT (ms) | DCL (ms) |
|---|---:|---:|---:|---:|---:|
| `/login` (cold) | 260 | 728 | 0,00 | 148 | 176,5 |
| `/app/home` (seeded mock) | 228 | 228 | 0,00 | 111 | 189,5 |
| `/app/messages` (seeded mock) | 232 | 580 | 0,00 | 74 | 171,8 |

## 3. Baseline Screenshots

Đã chụp **44 ảnh WebP** (`design/redesign-v2/baseline/`, tổng 1,47 MB) cho 11 màn hình (`login`, `onboarding`, `install`, `home`, `memories`, `checkin`, `messages`, `profile`, `random`, `replies`, `journey`) × 2 chế độ (`light`, `dark`) × 2 kích thước (`390x844`, `360x800`).
