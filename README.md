# Check IN Love 💕

<p align="center">
  <a href="https://github.com/aiThss/check-in-love/releases/latest">
    <img src="https://img.shields.io/github/v/release/aiThss/check-in-love?logo=github&color=007ec6&label=Release" alt="Release" />
  </a>
  <a href="https://github.com/aiThss/check-in-love/releases/latest">
    <img src="https://img.shields.io/badge/Download-APK-2496ED?logo=android&logoColor=white" alt="Download APK" />
  </a>
  <img src="https://img.shields.io/badge/PWA-v2_MIX-FF3B7F?logo=pwa&logoColor=white" alt="PWA Ready" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white" alt="Docker" />
</p>

Ứng dụng check-in ảnh, bản đồ hẹn hò và trò chuyện riêng tư dành cho hai người yêu nhau.

## 🏗️ Kiến trúc hệ thống

- **Backend (`apps/api`)**: Fastify / Cloudflare Workers + TypeScript (D1 / MongoDB, R2, WebPush, Firebase FCM v1, SSE realtime)
- **PWA Frontend (`apps/pwa`)**: Vite + Vanilla TypeScript + Design System v2 **MIX** (`@layer` CSS, 18 font `.woff2` tự host `Be Vietnam Pro` & `Fraunces Variable`, 78 icon SVG "Nét Yêu", 6 bảng màu nhấn đạt chuẩn WCAG AA, Offline & Outbox IndexedDB)
- **Admin Dashboard (`apps/admin`)**: Vite + Vanilla TypeScript + Nginx
- **Android App (`apps/android`)**: Native Kotlin + Jetpack Compose + WebView wrapper (Adaptive Icon, Splash Android 12+, Widget màn hình chính, thông báo đẩy đa tầng FCM + SSE)
- **Tài liệu Thiết kế v2 & Báo cáo**: xem [`docs/redesign-v2/REPORT.md`](docs/redesign-v2/REPORT.md) và [`HANDOFF.md`](HANDOFF.md)

## 🚀 Khởi chạy nhanh (Development)

1. Cài đặt dependencies tại thư mục gốc:
   ```bash
   npm install
   ```

2. Sao chép `.env.example` sang `.env` và điền biến môi trường:
   ```bash
   cp .env.example .env
   ```

3. Chạy kiểm tra chất lượng, unit test và build PWA:
   ```bash
   npm run lint
   npm test
   npm run build --workspace=apps/pwa
   ```

4. Hoặc khởi chạy toàn bộ cụm dịch vụ bằng Docker Compose:
   ```bash
   docker-compose up --build
   ```

## 🔐 Đăng nhập Google (OAuth 2.0)

Cấu hình cùng một OAuth 2.0 Web Client ID cho cả API và PWA:

```env
GOOGLE_CLIENT_ID=<oauth_2_web_client_id>
VITE_GOOGLE_CLIENT_ID=<same_oauth_2_web_client_id>
```

Thêm tên miền PWA vào **Authorized JavaScript origins** trên Google Cloud Console.

## 📄 Bản quyền

Dự án riêng tư (Private project).
