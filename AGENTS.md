# Git workflow

After completing a user-requested change, stage the files that belong to that change, create a focused commit, and push the current branch to its configured remote. Do this proactively; do not wait for the user to ask.

# Occasion & Scratch Cards UI Rules

- **Quy chuẩn Kích thước & Giao diện Thiệp (`anniversary-cards.ts`)**:
  - Khung thiệp (`.occasion-shell`) sử dụng chiều rộng `min(340px, calc(100vw - 32px))` và chiều cao tự nhiên `height: auto` (`overflow: visible`), **tuyệt đối không được tạo thanh cuộn (scrollbar) hay khung cuộn bên trong thiệp**.
  - Thiệp giấy bên dưới (`.occasion-paper`) để `min-height: 0`, ôm tự nhiên theo độ dài nội dung thực tế.
  - Lớp cào canvas (`.occasion-scratch`) đo chính xác kích thước thực của thiệp giấy bằng `paper.getBoundingClientRect()`, cài `border-radius: 26px; overflow: hidden;` để phủ khớp 100% lên thiệp giấy bên dưới mà không bị hở hay lệch góc.
  - Thiệp sinh nhật (`birthday`) hiển thị SVG Bánh sinh nhật (`BIRTHDAY_CAKE_SVG`), ô chứa bánh có nền màu Xanh Da Trời (`linear-gradient(145deg, #a0c4ff, #4ea8de)`), và lớp cào ở giữa có khung thủy tinh mờ với text `🎂 Chúc Mừng Sinh Nhật 🎂`.
