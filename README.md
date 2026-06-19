# LoveCheck 💕 — Couple Check-In App

> App check-in tình yêu riêng tư cho 2 người. Cảm hứng từ Locket/BeReal nhưng tối giản, bảo mật, dễ deploy.

![LoveCheck](https://img.shields.io/badge/PWA-ready-FF3B7F?style=flat-square) ![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square) ![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square)

## 📦 Tại sao source nhẹ?

Project cũ nặng hơn **1GB** vì chứa:
- `node_modules/` — ~400MB packages
- `dist/` / `build/` — build artifacts
- `android/.gradle/`, `.gradle/` — Gradle cache
- `.dart_tool/`, `.pub-cache/` — Flutter/Dart toolchain
- `libflutter.so` nhiều kiến trúc CPU (arm64, x86_64...)
- File APK/AAB output

**Source thật của project này chỉ vài MB.** Toàn bộ các thư mục trên được exclude qua `.gitignore` và `.dockerignore`.

---

## 🏗️ Kiến trúc

```
check-in-love/
├── apps/
│   ├── api/          ← Node.js + Fastify + TypeScript (port 3001)
│   ├── pwa/          ← Vite PWA (port 3000, served via Nginx)
│   └── admin/        ← Vite Admin Dashboard (port 3002, Nginx)
├── packages/
│   └── shared/       ← Shared TypeScript types & constants
├── docker-compose.yml
├── .env.example
└── README.md
```

### Tech Stack
| Layer | Công nghệ |
|-------|-----------|
| Backend | Node.js 20, Fastify 4, TypeScript 5 |
| Database | MongoDB 7 (Mongoose) |
| Auth | JWT 30 ngày + anonymous device session |
| Storage | Local volume (swappable sang R2/S3) |
| Frontend | Vite + Vanilla TypeScript |
| PWA | manifest.webmanifest + Service Worker |
| Deploy | Docker Compose + Nginx |

---

## 🔗 Domains

| Service | URL |
|---------|-----|
| PWA (app chính) | https://couple.babyress.games |
| API Backend | https://api.couple.babyress.games/api |
| Admin Dashboard | https://admin.couple.babyress.games |

---

## 🚀 Chạy local (Development)

### Yêu cầu
- Node.js >= 20
- Docker + Docker Compose
- MongoDB (hoặc dùng Docker)

### Bước 1: Clone & setup
```bash
git clone <repo-url> check-in-love
cd check-in-love

# Copy và điền env
cp .env.example .env
# Mở .env và điền JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
```

### Bước 2: Chạy với Docker Compose (khuyến nghị)
```bash
docker-compose up --build
```

Sau khi build xong:
- PWA: http://localhost:3000
- API: http://localhost:3001/api/health
- Admin: http://localhost:3002

### Bước 3: Chạy từng service riêng (Development mode)
```bash
# Cài dependencies
npm install

# Terminal 1 — API
npm run dev:api

# Terminal 2 — PWA
npm run dev:pwa

# Terminal 3 — Admin
npm run dev:admin
```

---

## 🌐 Deploy lên Dokploy

### 1. Chuẩn bị server

Dokploy cần VPS với Docker đã cài. Truy cập Dokploy dashboard của bạn.

### 2. Tạo DNS Cloudflare

Vào **Cloudflare → babyress.games → DNS** và thêm 3 records:

```
Type  Name     Target                    Proxy
A     couple   <VPS_IP_ADDRESS>          ON ☁️
A     api      <VPS_IP_ADDRESS>          ON ☁️
A     admin    <VPS_IP_ADDRESS>          ON ☁️
```

> **Lưu ý:** Bật **Proxy ON** (biểu tượng cam ☁️) để có HTTPS tự động từ Cloudflare.

Trên Cloudflare → SSL/TLS → chọn **Full (strict)** mode.

### 3. Tạo App trên Dokploy

Trong Dokploy dashboard:

1. **New Project** → chọn **Docker Compose**
2. Source: **Git Repository** (hoặc upload trực tiếp)
3. Branch: `main`
4. Docker Compose Path: `docker-compose.yml`

### 4. Add Domains trong Dokploy

Với mỗi service, vào **Domains** tab và thêm:

| Service | Domain | Port |
|---------|--------|------|
| `pwa` | `couple.babyress.games` | 80 |
| `api` | `api.couple.babyress.games` | 3001 |
| `admin` | `admin.couple.babyress.games` | 80 |

Dokploy sẽ tự cấp Let's Encrypt cert. Vì Cloudflare đã proxy, cert nội bộ sẽ hoạt động ổn.

### 5. Cấu hình Environment Variables

Trong Dokploy → **Environment** tab, paste nội dung `.env` đã điền đủ:

```env
NODE_ENV=production
MONGODB_URI=mongodb://mongo:27017/checkinlove
JWT_SECRET=<random_string_min_32_chars>
ADMIN_EMAIL=your@email.com
ADMIN_PASSWORD=your_strong_password
PUBLIC_BASE_URL=https://api.couple.babyress.games
UPLOAD_DIR=/app/uploads
MAX_UPLOAD_MB=10
ALLOWED_ORIGINS=https://couple.babyress.games,https://admin.couple.babyress.games
VITE_API_URL=https://api.couple.babyress.games/api
```

### 6. Volumes trong Dokploy

Dokploy tự quản lý Docker volumes. Kiểm tra `mongo_data` và `uploads_data` được tạo.

Để đảm bảo persistent:
- Vào **Volumes** tab trong Dokploy
- Confirm 2 volumes: `checkinlove_mongo_data` và `checkinlove_uploads_data`

### 7. Deploy

```
Dokploy → Deploy button
```

Xem logs để chắc tất cả services đã start:
```
checkinlove_mongo  | MongoDB ready
checkinlove_api    | Server listening on 0.0.0.0:3001
checkinlove_pwa    | nginx: ready
checkinlove_admin  | nginx: ready
```

### 8. Kiểm tra health
```bash
curl https://api.couple.babyress.games/api/health
# → {"status":"ok","timestamp":"...","version":"1.0.0"}
```

---

## 📱 Cách dùng trên iPhone (Add to Home Screen)

Vì iPhone không cho cài APK và không có Apple Developer account:

1. Mở **Safari** trên iPhone (phải là Safari, không phải Chrome trên iOS)
2. Vào: `https://couple.babyress.games`
3. App sẽ hiển thị hướng dẫn tự động:
   - Bấm nút **Share** (📤) ở thanh công cụ Safari
   - Chọn **"Thêm vào Màn hình chính"** (Add to Home Screen)
   - Bấm **"Thêm"** (Add)
4. App sẽ xuất hiện trên Home Screen như app native
5. Mở app từ Home Screen → chạy ở chế độ fullscreen, không có thanh URL

> **Lưu ý iOS:** Push notification không được support trên iOS PWA (giới hạn của Apple). App dùng badge "Có check-in mới" làm fallback.

---

## 🤖 Cách dùng trên Android

### Option 1: PWA (dễ nhất)
1. Mở Chrome trên Android
2. Vào `https://couple.babyress.games`
3. Chrome sẽ hỏi "Cài đặt app?" → bấm **Cài đặt**
4. App xuất hiện trên màn hình như app native

### Option 2: TWA/APK Wrapper (sau này)
Có thể build APK wrapper bằng Bubblewrap hoặc PWABuilder sau khi PWA đã ổn định.

---

## 🔑 Biến môi trường chi tiết

| Biến | Mô tả | Bắt buộc |
|------|-------|----------|
| `NODE_ENV` | `development` hoặc `production` | ✅ |
| `MONGODB_URI` | MongoDB connection string | ✅ |
| `JWT_SECRET` | Ít nhất 32 ký tự random | ✅ |
| `ADMIN_EMAIL` | Email đăng nhập admin | ✅ |
| `ADMIN_PASSWORD` | Password admin | ✅ |
| `PUBLIC_BASE_URL` | Base URL của API (dùng trong file URL) | ✅ |
| `UPLOAD_DIR` | Thư mục lưu ảnh trong container | ✅ |
| `MAX_UPLOAD_MB` | Giới hạn upload MB (default: 10) | ❌ |
| `ALLOWED_ORIGINS` | CORS whitelist, phân cách bằng dấu phẩy | ✅ |
| `VAPID_PUBLIC_KEY` | Web Push VAPID public key | ❌ |
| `VAPID_PRIVATE_KEY` | Web Push VAPID private key | ❌ |
| `VAPID_EMAIL` | Email cho VAPID | ❌ |

### Generate VAPID keys (nếu muốn Web Push):
```bash
npx web-push generate-vapid-keys
```

---

## 💾 Backup

### Backup MongoDB:
```bash
# Vào container MongoDB
docker exec checkinlove_mongo mongodump \
  --db checkinlove \
  --out /tmp/backup

# Copy ra host
docker cp checkinlove_mongo:/tmp/backup ./backup-$(date +%Y%m%d)
```

### Backup Uploads:
```bash
# Trong Dokploy, volumes thường ở /var/lib/docker/volumes/
# Hoặc dùng rsync ra ngoài:
docker run --rm \
  -v checkinlove_uploads_data:/data \
  -v $(pwd)/uploads-backup:/backup \
  alpine tar czf /backup/uploads-$(date +%Y%m%d).tar.gz -C /data .
```

### Restore MongoDB:
```bash
docker exec -i checkinlove_mongo mongorestore \
  --db checkinlove \
  /tmp/backup/checkinlove
```

---

## 🔐 Bảo mật

- JWT secret phải random và dài (≥ 32 chars)
- Admin password mạnh
- CORS chỉ cho phép domains bạn kiểm soát
- Upload chỉ chấp nhận image/* MIME type
- Rate limiting bảo vệ auth và upload endpoints
- Soft delete: ảnh không bao giờ bị xóa vật lý ngay
- API kiểm tra coupleId từ JWT, không cho đọc data couple khác

---

## 📋 API Reference

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| GET | `/api/health` | - | Health check |
| POST | `/api/auth/start` | - | Onboarding / tạo account |
| POST | `/api/auth/login` | - | Đăng nhập |
| GET | `/api/me` | JWT | Profile của mình |
| PATCH | `/api/me` | JWT | Cập nhật profile |
| POST | `/api/me/avatar` | JWT | Upload avatar |
| GET | `/api/checkins/latest-partner` | JWT | Check-in mới nhất của partner |
| GET | `/api/checkins` | JWT | Danh sách check-ins |
| POST | `/api/checkins` | JWT | Tạo check-in |
| POST | `/api/checkins/:id/reactions` | JWT | React |
| DELETE | `/api/checkins/:id` | JWT | Xóa |
| GET | `/api/random/categories` | JWT | Danh mục random |
| POST | `/api/random/draw` | JWT | Bốc prompt |
| POST | `/api/push/subscribe` | JWT | Đăng ký push |
| POST | `/api/admin/login` | - | Admin login |
| GET | `/api/admin/summary` | Admin JWT | Dashboard stats |
| GET | `/api/admin/users` | Admin JWT | Danh sách users |
| PATCH | `/api/admin/users/:id` | Admin JWT | Block/unblock |

---

## 🛠️ Development Tips

### Chạy chỉ MongoDB bằng Docker:
```bash
docker-compose up mongo -d
# Sau đó chạy API local với tsx
```

### Reset database:
```bash
docker-compose down -v  # Xóa volumes
docker-compose up --build
```

### Xem logs:
```bash
docker-compose logs -f api
docker-compose logs -f mongo
```

---

## 📄 License

Private project. Chỉ dành cho 1 cặp đôi. ❤️
