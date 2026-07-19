# Project Rules — check-in-love

## Git & Deployment

- **LUÔN chạy `git push` sau mỗi lần commit** để kích hoạt auto deploy lên server.
  - Thứ tự bắt buộc: `git add` → `git commit` → `git push`
  - Không bao giờ kết thúc task mà chỉ commit mà không push.
- Nếu có nhiều file thay đổi, stage tất cả rồi commit một lần, sau đó push.
- Shell là **PowerShell** — dùng lệnh riêng từng dòng, không dùng `&&` để nối lệnh.
