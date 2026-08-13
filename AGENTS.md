# Git workflow

After completing a user-requested change, stage the files that belong to that change, create a focused commit, and push the current branch to its configured remote. Do this proactively; do not wait for the user to ask.

# Occasion & Scratch Cards UI Rules

- **Quy chuẩn Kích thước & Giao diện Thiệp (`anniversary-cards.ts`)**:
  - Khung thiệp (`.occasion-shell`) sử dụng chiều rộng `min(340px, calc(100vw - 32px))` và chiều cao tự nhiên `height: auto` (`overflow: visible`), **tuyệt đối không được tạo thanh cuộn (scrollbar) hay khung cuộn bên trong thiệp**.
  - Kích thước phải dựa trên CSS viewport (`vw`/`dvh`), không dựa theo số inch quảng cáo của điện thoại. Với các thiệp không phải sinh nhật trên trình duyệt hỗ trợ `dvh`, dùng `min(100vw - 32px, clamp(328px, 42dvh, 360px))`: giữ đúng width 328px ở 360×720, lớn dần trên màn hình cao/rộng hơn, và không vượt quá vùng hiển thị. Giữ nguyên size e62 của thiệp sinh nhật.
  - Thiệp giấy bên dưới (`.occasion-paper`) để `min-height: 0`, ôm tự nhiên theo độ dài nội dung thực tế.
  - Ba lớp `.occasion-shell`, `.occasion-paper` và `.occasion-scratch` luôn phải có cùng rendered rectangle (cùng `top`, `left`, `width`, `height`) cho mọi loại thiệp. Ở viewport 360×720, width chuẩn là 328px; chiều cao tự nhiên theo nội dung, không giới hạn bằng `max-height`.
  - Lớp cào canvas (`.occasion-scratch`) luôn đo kích thước thật của `.occasion-paper` bằng `paper.getBoundingClientRect()` cho **mọi** thiệp, rồi đồng bộ cả CSS `inset/width/height` lẫn bitmap canvas. Cài `border-radius: 26px; overflow: hidden;` để phủ khớp 100%, không hở hoặc lệch góc.
  - Sau bất kỳ thay đổi nào về font, padding, animation hoặc breakpoint, phải kiểm tra trên `/preview/cards` ở viewport 360×720: mỗi thiệp phải có rect của shell/paper/scratch bằng nhau trước khi commit.
  - Thiệp sinh nhật (`birthday`) hiển thị SVG Bánh sinh nhật (`BIRTHDAY_CAKE_SVG`), ô chứa bánh có nền màu Xanh Da Trời (`linear-gradient(145deg, #a0c4ff, #4ea8de)`), và lớp cào ở giữa có khung thủy tinh mờ với text `🎂 Chúc Mừng Sinh Nhật 🎂`.
