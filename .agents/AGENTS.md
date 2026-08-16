# Hướng Dẫn & Quy Tắc Dự Án — Check IN Love

## 1. Quy Trình Git & Auto Deploy (Bắt Buộc)

- **LUÔN chạy `git push` sau mỗi lần commit** để kích hoạt auto deploy lên server Dokploy.
  - Thứ tự bắt buộc: `git add .` → `git commit -m "..."` → `git push`
  - Không bao giờ kết thúc task mà chỉ commit mà không push.
- Shell là **PowerShell** — dùng lệnh riêng từng dòng, không dùng `&&` để nối lệnh.

---

## 2. Công Thức & Kiến Trúc Thông Báo Đa Tầng (Push Notification Formula)

Hệ thống thông báo của Check IN Love được thiết kế đa tầng để đảm bảo **100% người dùng nhận được thông báo tức thì**:

```
                       ┌─── Layer 1: Firebase FCM v1 (Background Push via Google)
                       │
Backend Event Trigger ─┼─── Layer 2: Server-Sent Events SSE (Real-time Stream 0.1s)
                       │        └─> Native Android Local Notification (Pop-up + Avatar + Sound)
                       │
                       └─── Layer 3: Web Push Protocol (VAPID / Web Browser)
```

### 🔹 Layer 1: Firebase Cloud Messaging (FCM v1)
- **Client (Android Native)**:
  - Plugin `com.google.gms.google-services` được kích hoạt trong `apps/android/app/build.gradle.kts`.
  - File `google-services.json` đặt tại `apps/android/app/google-services.json`.
  - `MyFirebaseMessagingService.kt`: Xử lý token, tải avatar tròn (`getCircleBitmap`), ảnh check-in (`BigPictureStyle`), phát âm thanh `PRIORITY_MAX` trên kênh `realtime_interactions`.
- **Backend (API)**:
  - Biến `FCM_SERVICE_ACCOUNT_JSON` trong `.env` trên server VPS chứa toàn bộ chuỗi JSON khóa riêng tư (Private Key) tải từ Firebase Console (*Project Settings -> Service Accounts -> Generate new private key*).
  - Gửi qua Firebase HTTP v1 API (`https://fcm.googleapis.com/v1/projects/{projectId}/messages:send`).

### 🔹 Layer 2: Server-Sent Events (SSE Real-time Stream)
- Tuyến đường `/api/events` trên backend duy trì kết nối luồng dữ liệu thời gian thực.
- Client PWA (`apps/pwa/src/api/events.ts`) lắng nghe sự kiện và gọi native bridge:
  `window.LoveCheckAndroid.showLocalNotification(title, body, targetUrl, photoUrl, senderAvatar)`
- Native Android lập tức tải avatar của đối phương, bo tròn và hiển thị pop-up banner cùng chuông thông báo ngay trong 0.1 giây.

---

## 3. Công Thức Đóng Gói (Build) APK Android

Khi cần build bản cập nhật APK mới:

1. **Tăng phiên bản trong `apps/android/app/build.gradle.kts`**:
   ```kotlin
   versionCode = <tăng_1_đơn_vị> // Ví dụ: 23
   versionName = "0.0.11"
   ```
2. **Build Release APK (PowerShell)**:
   ```powershell
   cd apps\android
   .\gradlew.bat assembleRelease
   cd ..\..
   ```
3. **Copy APK ra thư mục gốc**:
   ```powershell
   Copy-Item -Path apps\android\app\build\outputs\apk\release\app-release.apk -Destination app-release.apk -Force
   ```
4. **Kiểm tra Unit Tests**:
   ```powershell
   npm test
   ```
5. **Commit và Push để kích hoạt Deploy**:
   ```powershell
   git add .
   git commit -m "build: release apk vX.X.X"
   git push
   ```

---

## 4. Tùy Biến Giao Diện Thông Báo Android

- **Icon nhỏ (Small Icon)**: Đặt tại `apps/android/app/src/main/res/drawable/ic_notification.xml` (icon màu trắng nền trong suốt chuẩn Android).
- **Avatar người gửi (Large Icon)**: Tự động tải từ `senderAvatar` / `avatarUrl`, sau đó hàm `getCircleBitmap()` cắt thành hình tròn sắc nét.
- **Ảnh đính kèm (Big Picture)**: Tự động tải từ `photoUrl` và hiển thị dạng mở rộng `NotificationCompat.BigPictureStyle`.
- **Kênh thông báo (Channel)**: `realtime_interactions` với `NotificationManager.IMPORTANCE_HIGH` và `PRIORITY_MAX` để hiển thị banner nổi (heads-up pop-up).
