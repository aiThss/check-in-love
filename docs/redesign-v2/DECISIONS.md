# DECISIONS — Redesign v2 (chỉ THÊM cuối)

| Ngày | Quyết định | Lý do | Phương án đã loại |
|---|---|---|---|
| 2026-11-25 | Phạm vi: PWA + lớp native Android | Android thực chất là WebView bọc PWA; chỉ widget/viewer/dialog/icon/splash/theme/notification cần restyle | Chỉ PWA; viết lại bằng Compose native |
| 2026-11-25 | Hướng thẩm mỹ: agent làm 3 mock HTML, user chọn trước khi code | Tránh code toàn bộ theo hướng user không thích | Chốt sẵn 1 hướng |
| 2026-11-25 | Icon: tự vẽ bộ SVG ~70 icon, không thư viện ngoài | Nhận diện riêng, không "đại trà" | Phosphor/Solar/Iconoir; giữ icons8 |
| 2026-11-25 | Giữ TypeScript thuần + Vite, tái cấu trúc CSS thành lớp, viết lại markup | Đập đi xây lại thật sự nhưng không mang rủi ro đổi framework | Chỉ restyle; chuyển Preact/Lit/Svelte |
| 2026-11-25 | Độ mượt: làm đủ 8 nhóm (view transition, skeleton/SWR, chat, gesture, hiệu năng, PWA, theme+accent, micro-animation) | User chọn tất cả | Chọn lọc |
| 2026-11-25 | Giao hàng: push thẳng `main` sau mỗi phase (theo AGENTS.md) | Lựa chọn của user | Nhánh redesign/v2; feature flag. Hệ quả: mỗi phase phải shippable, dùng alias token + prefix class mới để cũ/mới sống chung |
| 2026-11-25 | Log bàn giao: HANDOFF.md + docs/redesign-v2/ + script snapshot | Để AI khác tiếp tục khi hết token | Chỉ dựa vào lịch sử chat |
| 2026-11-26 | **Hướng thẩm mỹ chốt = MIX**: A (Soft Editorial Romance) làm nền + kính kiểu B CHỈ ở nav/bottom sheet/composer + từ C: **chat** (bong bóng viền mực 2,5px + bóng offset cứng, thanh reaction viền đậm), nhãn vàng cho streak/ngày kỷ niệm/chip ngày, micro-animation nhấn (translate 2px,3px) | User chọn công thức 'A + kính B ở nav/sheet + micro-animation/nhãn vàng C' và 'thêm chat của C'. Mock: design/redesign-v2/mock-mix.html | Thuần A, thuần B, thuần C. Lưu ý rủi ro: chat viền đậm của C đặt cạnh nền editorial mềm của A có thể lệch nhịp ở các màn khác; P3 phải kiểm tra, nếu lệch thì giảm viền chat xuống 2px hoặc dùng màu viền mực mềm hơn |
