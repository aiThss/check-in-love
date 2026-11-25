# Đặc tả Bộ Icon Tự Vẽ — Check IN Love ("Nét Yêu")

## 1. Triết lý & Ngôn ngữ Hình học
Bộ icon **Nét Yêu** được vẽ thủ công trên lưới chuẩn `24×24`, không dùng thư viện icon đại trà (Lucide/Feather/Heroicons), mang tinh thần ấm áp của hướng thẩm mỹ **MIX** (nền Editorial Romance + kính chọn lọc + nhấn Sticker):

- **Lưới & Vùng an toàn**: `viewBox="0 0 24 24"`, vùng vẽ chính từ `2.5` đến `21.5` (padding quang học `2.5px`), đảm bảo sắc nét ở cả `16px`, `20px`, `24px`, `28px`.
- **Nét vẽ**: `stroke-width: 1.75` (tự cân bằng quang học), `stroke-linecap: round`, `stroke-linejoin: round`.
- **Dấu ấn nhận diện ("Nét Yêu")**:
  1. **Góc bo mềm hữu cơ**: Các khung thẻ/ảnh/lịch dùng bo góc `rx="3.5"` đến `4.5` thay vì góc vuông sắc cạnh.
  2. **Khẩu độ tim (Heart-Aperture)**: Nút Check-in trung tâm (`checkin-lens`), máy ảnh, polaroid, ghim bản đồ và huy hiệu kỷ niệm lồng khéo chi tiết lúm trái tim mềm thay cho tâm tròn vô hồn.
  3. **Bộ 6 Reaction độc bản**: `react-love`, `react-haha`, `react-wow`, `react-ouch`, `react-hug`, `react-fire` thiết kế chung độ dày nét và biểu cảm tay vẽ thay cho emoji hệ thống.

## 2. Hai Biến thể (`outline` & `filled`)
Mỗi `<symbol>` chứa tối đa hai lớp:
- Lớp nền duotone/tô đặc (`.cil-tone`): ở trạng thái `outline` mặc định có `fill-opacity: 0` (hoặc `0.08` khi hover); khi sang biến thể `filled` (tab đang chọn, đã thả tim, công tắc bật) lớp `.cil-tone` nâng `fill-opacity: 0.24` (hoặc `1` đối với icon trái tim/ngôi sao/lửa) kết hợp `currentColor`.
- Lớp nét chính (`.cil-stroke`): `fill="none" stroke="currentColor"`.

## 3. Vi chuyển động (Compositor & Stroke-Dash)
Chỉ dùng `transform`, `opacity` và `stroke-dashoffset`, thời lượng `160ms–360ms`, tự tắt hoàn toàn khi `@media (prefers-reduced-motion: reduce)` hoặc `[data-reduced-motion="true"]`:
- `pop`: nảy nhẹ theo lò xo (`scale(0.82) -> scale(1.08) -> scale(1)`) cho tab active.
- `heartbeat`: nhịp tim đôi cho thả reaction / kỷ niệm.
- `shutter`: nén–nhả vòng ống kính khi bấm chụp check-in.
- `fly`: nghiêng và bay nhẹ chéo lên khi gửi tin nhắn.
- `draw`: vẽ nét `stroke-dashoffset` cho dấu `check` → `double-check`.
- `spin`: xoay mượt 360° cho `refresh` / trạng thái tải.
- `shake`: lắc chuông `bell` / cảnh báo `alert`.

## 4. Danh mục 78 Icon
1. **Điều hướng (5)**: `home`, `memories`, `checkin-lens`, `chat`, `profile`
2. **Máy ảnh & Ảnh (8)**: `camera`, `flash`, `flash-off`, `flip-camera`, `shutter`, `gallery`, `image`, `polaroid`
3. **Trò chuyện & Tác vụ (12)**: `send`, `attach`, `sticker`, `emoji`, `mic`, `reply`, `forward`, `copy`, `delete`, `edit`, `share`, `more`
4. **Trạng thái & Điều hướng phụ (9)**: `back`, `chevron-right`, `chevron-down`, `close`, `check`, `double-check`, `clock`, `alert`, `wifi-off`
5. **Tình yêu & Reaction riêng (12)**: `heart`, `heart-broken`, `heart-burst`, `react-love`, `react-haha`, `react-wow`, `react-ouch`, `react-hug`, `react-fire`, `streak`, `sparkle`, `star`
6. **Hành trình & Dịp kỷ niệm (9)**: `calendar`, `anniversary`, `gift`, `location-pin`, `map`, `route`, `bucket-list`, `scratch-card`, `dice`
7. **Khám phá & Cài đặt (11)**: `search`, `filter`, `settings`, `bell`, `bell-off`, `moon`, `sun`, `palette`, `refresh`, `download`, `upload`
8. **Tài khoản, Bảo mật & PWA (12)**: `lock`, `shield`, `key`, `mail`, `google`, `eye`, `eye-off`, `link`, `user`, `couple`, `logout`, `install`, `info`, `help`
