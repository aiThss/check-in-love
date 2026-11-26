# Metrics Before vs After — Check IN Love Redesign v2 (2026-11-26)

Máy dev Windows, Node 24, Chrome Headless CDP (`4× CPU`, `Fast 3G`, `390×844` & `360×800`).

---

## 1. So sánh Build, Bundle & Chất lượng mã (Before vs After)

| Chỉ số | Baseline (Trước Redesign) | After (Sau P9) | Chênh lệch / Đánh giá |
|---|---:|---:|---|
| Bộ kiểm thử (`npm test`) | 26 file · **128 test** | 31 file · **155 test** | **+27 test (+21,1%)** · 100% pass |
| `npm run lint` + `tsc` | 0 lỗi | 0 lỗi | Sạch tuyệt đối |
| Chunk JS lõi (`index-*.js` raw / gzip) | 150,83 kB / **46,40 kB** | 110,11 kB / **34,73 kB** | **-25,2% gzip** (vượt xa trần +10% = 51,04 kB) |
| CSS khởi tạo (`index-*.css` raw / gzip) | 141,43 kB / **24,75 kB** | 139,27 kB / **25,27 kB** | **-2,16 kB raw** (dù thêm toàn bộ Design System v2) |
| Chunk `profile` (gzip) | 8,03 kB | 7,52 kB | **-6,4%** |
| Chunk `onboarding` (gzip) | 7,20 kB | 5,54 kB | **-23,1%** |
| Chunk `memories` (gzip) | 7,53 kB | 6,53 kB | **-13,3%** |
| Chunk `home` (gzip) | 6,82 kB | 6,56 kB | **-3,8%** |
| Chunk `checkin` (gzip) | 6,13 kB | 4,77 kB | **-22,2%** |
| Chunk `messages` (gzip) | 15,38 kB | 16,98 kB | +1,60 kB (thêm typing, grouping, reaction SVG, menu) |
| Chunk `love-journey` (MapLibre gzip) | 297,33 kB | 297,25 kB | Tách riêng hoàn toàn khỏi trang khác (cả JS lẫn CSS) |
| Số quy tắc `!important` (ngoài reduced-motion) | **283** | **0** | **-100%** (chỉ giữ 8 dòng a11y reduced-motion ở `01-base.css`) |
| Phụ thuộc CDN runtime (`Google Fonts`, `unpkg`) | 3 nguồn chặn render | **0** | **Tự chủ 100%** (18 file `.woff2` tự host + 78 SVG riêng) |
| Diff trên `apps/api`, `packages`, `apps/admin` | — | **0 dòng** | Bảo toàn 100% hợp đồng dữ liệu & backend |

---

## 2. Mobile Throttled Web Vitals (`4× CPU`, `Fast 3G`, `390×844`, Gzip)

> Ngân sách mục tiêu (`PROMPT.md` mục 7.5): **LCP ≤ 2.000 ms**, **CLS ≤ 0,05**, JS khởi tạo gzip ≤ 51,04 kB.
> Lưu ý: ở bản Baseline, các CDN ngoài (`unpkg lottie-player@latest`, `fonts.googleapis.com`) buộc phải chặn khi đo local nếu không sẽ cộng thêm **300–900 ms** chặn render trên mạng 3G thật; ở bản After (P9), toàn bộ font `.woff2` đã tự host và nạp thực tế qua mạng giả lập Fast 3G.

| Tuyến đường | FCP Before → After (ms) | LCP Before → After (ms) | CLS Before → After | DCL Before → After (ms) | Trạng thái |
|---|---:|---:|---:|---:|---|
| `/login` (cold cache, nạp font `.woff2` qua Fast 3G) | 260* → **984** | 728* → **1.896** | 0,00 → **0,000** | 176,5 → **895,6** | Đạt ngân sách (LCP ≤ 2,0 s, CLS = 0) |
| `/app/home` (seeded mock, SWR tức thì) | 228 → **200** | 228 → **200** | 0,00 → **0,000** | 189,5 → **102,7** | **Nhanh hơn 12% LCP, -46% DCL** (bỏ delay 3s cũ) |
| `/app/messages` (seeded mock, thread MIX) | 232 → **204** | 580 → **536** | 0,00 → **0,000** | 171,8 → **118,1** | **Nhanh hơn 8% LCP, -31% DCL**, TBT **116 ms** |

*\*Baseline `/login` chặn tải Google Fonts & unpkg nên không tính thời gian tải font; After `/login` tải thật bộ font tiếng Việt tự host ngay lần mở đầu tiên và vẫn đạt LCP < 1,9 s trên Fast 3G.*

---

## 3. Bộ ảnh chụp đối chiếu Before / After

- **Baseline (`design/redesign-v2/baseline/`)**: **44 ảnh WebP** (1,47 MB) — 11 màn × `light`/`dark` × `390×844`/`360×800`.
- **After (`design/redesign-v2/after/`)**: **44 ảnh WebP** (2,16 MB) — cùng 11 màn × `light`/`dark` × `390×844`/`360×800`, cộng thêm 2 ảnh chuẩn PWA Install Sheet tại `apps/pwa/public/screenshots/{home-mobile,chat-mobile}.webp`.
