# Guide custom Android App Widget — Check IN Love

> Phạm vi: Android 16 (API 36), `minSdk 24`, `targetSdk 36`, cập nhật ngày 01-09-2026.

## Quyết định cho dự án này

Giữ **`AppWidgetProvider` + `RemoteViews` + XML** cho hai widget hiện tại. Đây là lựa chọn đúng cho Check IN Love trong ngắn hạn vì chúng đã hoạt động, có `minSdk 24`, và giao diện cần chỉ là thẻ check-in/streak có ảnh, text, và deep link.

Chỉ dùng **Jetpack Glance** cho một widget mới hoặc khi làm lại toàn bộ một widget cần nhiều breakpoint/layout thích ứng. Glance dùng API kiểu Compose nhưng vẫn kết xuất thành `RemoteViews`, nên không mở được các View/animation tuỳ ý như UI Compose trong app. Không trộn Compose UI thường với composable của Glance trong cùng layout widget.

| Nhu cầu | Công cụ chọn | Lý do |
| --- | --- | --- |
| Chỉnh màu, text, ảnh, click, layout của hai widget hiện có | `RemoteViews` + XML | Ít rủi ro, không thêm dependency, hoạt động từ API 24. |
| Tải ảnh/check-in hoặc refresh có mạng | `WorkManager` | Không giữ `BroadcastReceiver` quá 10 giây; có retry và ràng buộc mạng. |
| Widget mới có 2–4 bố cục cho phone/tablet/foldable | Jetpack Glance 1.1.1 (stable) | `SizeMode.Responsive`/`Exact` ít boilerplate hơn. |
| Kiểm tra widget trên thiết bị/emulator | Android Studio + ADB + `apps/android/scripts/WidgetDiagnostics.ps1` | Kiểm tra binding của launcher và SDK thực tế. |

Không thêm Glance hoặc WorkManager vào Gradle chỉ để đọc guide này. Khi bắt đầu migration, dùng bản stable đã kiểm chứng từ release note AndroidX, không dùng RC/alpha cho APK phát hành.

## Hiện trạng mã nguồn

| Thành phần | Vai trò |
| --- | --- |
| `apps/android/app/src/main/java/com/example/lovecheck/LoveCheckWidgetProvider.kt` | Widget streak/CTA; lưu state nhẹ trong `SharedPreferences`; FCM và bridge gọi `updateWidgetData()` / `updateWidgetNotification()`. |
| `apps/android/app/src/main/java/com/example/lovecheck/LoveCheckQuickWidgetProvider.kt` | Widget check-in nhanh có ảnh nền. |
| `apps/android/app/src/main/res/layout/love_check_widget.xml` | Layout XML của widget streak. |
| `apps/android/app/src/main/res/layout/love_check_quick_widget.xml` | Layout XML của widget ảnh/check-in. |
| `apps/android/app/src/main/res/xml/love_check_widget_info.xml` và `love_check_quick_widget_info.xml` | Kích thước, resize, preview và chính sách update. |
| `apps/android/app/src/main/java/com/example/lovecheck/MyFirebaseMessagingService.kt` | Nhận FCM rồi cập nhật widget ngay khi app đã được đánh thức. |

`compileSdk = 36` và `targetSdk = 36` đã đúng cho Android 16. Android 16 không buộc phải đổi App Widget sang Glance; việc quan trọng là widget thích ứng với launcher, tablet/foldable và không làm công việc dài trong receiver.

## Cách custom an toàn với RemoteViews

1. Sửa layout ở `res/layout/` và drawable ở `res/drawable/`. `RemoteViews` chỉ hỗ trợ một tập View và thuộc tính giới hạn; không đưa custom View hoặc Compose View trực tiếp vào XML widget.
2. Gán từng hành động bằng `PendingIntent` bất biến (`FLAG_IMMUTABLE`), với `requestCode` và `Intent.data` khác nhau nếu widget có nhiều nút.
3. Lưu snapshot nhỏ nhất cần để render (streak, tên, nội dung, URL ảnh đã cache) trong `SharedPreferences` hoặc DataStore; không dựa vào state in-memory vì widget do launcher host ở process khác.
4. Khi dữ liệu đổi, gọi `AppWidgetManager.updateAppWidget()` cho toàn bộ id của provider. Chỉ dùng `partiallyUpdateAppWidget()` cho phần text nhỏ và khi widget đã từng nhận full update.
5. Giữ `android:updatePeriodMillis="0"` như hiện tại: Check IN Love có FCM/SSE nên cập nhật theo sự kiện. Không refresh mỗi phút. Framework không hỗ trợ period dưới 30 phút; nếu thật sự cần refresh nền, dùng WorkManager với khoảng tối thiểu 15 phút và chỉ khi có giá trị cho người dùng.

### Mẫu cập nhật từ dữ liệu đã có

```kotlin
private fun refreshAll(context: Context) {
    val manager = AppWidgetManager.getInstance(context)
    val component = ComponentName(context, LoveCheckWidgetProvider::class.java)
    manager.getAppWidgetIds(component).forEach { widgetId ->
        manager.updateAppWidget(widgetId, buildViews(context))
    }
}
```

Không tải ảnh/mạng trong `onUpdate()` hay `onReceive()`. Receiver có ngân sách thời gian ngắn (thực tế khoảng 10 giây trước nguy cơ ANR). Luồng `thread { ... }` hiện tại ở `LoveCheckQuickWidgetProvider` nên được thay bằng `CoroutineWorker` khi nâng cấp phần tải ảnh, đặc biệt khi cần retry, ràng buộc mạng hoặc tải nhiều widget.

### Mẫu WorkManager cho ảnh nền (khi triển khai)

Thêm dependency stable khi task này bắt đầu:

```kotlin
implementation("androidx.work:work-runtime:2.11.2")
```

Worker cần:

- dùng `Constraints(NetworkType.CONNECTED)`;
- cache theo `appWidgetId` và URL hash, không dùng một file ảnh chung cho mọi widget;
- decode ảnh theo kích thước widget để tránh vượt giới hạn Binder/`RemoteViews` bitmap;
- ghi cache + state trước, rồi gọi full update ở cuối;
- retry lỗi mạng tạm thời, không retry vô hạn URL 4xx.

FCM vẫn có thể cập nhật text ngay. Nếu FCM chỉ mang URL ảnh, hãy hiển thị placeholder/text, enqueue worker, rồi refresh lần hai khi cache sẵn sàng.

## Layout responsive cho Android 16

Launcher khác nhau có số ô và khoảng cách khác nhau. Đừng suy luận từ số cell cố định. Widget cần hoạt động trên toàn khoảng `minResize…maxResize`.

Cho hai widget hiện tại, thêm dần các thuộc tính sau vào từng `appwidget-provider` khi đã thiết kế breakpoint:

```xml
android:targetCellWidth="2"
android:targetCellHeight="2"
android:maxResizeWidth="306dp"
android:maxResizeHeight="276dp"
```

- Streak widget: ít nhất layout **compact 2×1** (chỉ streak + nút) và **wide 4×1** (thêm subtitle).
- Quick widget: layout **2×2** (ảnh + tối đa 2 dòng) và **tall** (ảnh lớn + 3 dòng). Luôn có scrim đủ tương phản.
- Mỗi vùng bấm tối thiểu 48dp. Không đặt text quan trọng chỉ bằng emoji; thêm content description khi dùng `ImageView` có ý nghĩa.
- Preview picker: giữ `previewLayout`; tạo `previewImage` fallback nếu cần hỗ trợ trải nghiệm tốt Android 11 trở xuống. Android 15+ có generated preview, nhưng đó là tiện ích nên chỉ cân nhắc khi chuyển widget đó sang Glance.

Với `RemoteViews`, từ API 31 có thể cung cấp map `SizeF -> RemoteViews` để launcher chọn layout responsive. Nếu cần layout chính xác theo kích thước, xử lý `onAppWidgetOptionsChanged()` và render lại; đừng đổi layout trên mọi pixel resize.

## Khi nào chuyển sang Jetpack Glance

Chuyển một widget riêng lẻ khi có ít nhất một trong các điều kiện sau:

- 3+ breakpoint (phone ngang/dọc, tablet, foldable) khiến XML provider khó duy trì.
- Có danh sách action/checklist hoặc ảnh/lưới cần nhiều biến thể.
- Cần code UI Kotlin rõ ràng và testable hơn XML `RemoteViews`.

Dependency phát hành an toàn tại thời điểm viết guide:

```kotlin
implementation("androidx.glance:glance-appwidget:1.1.1")
```

Glance không nên là migration hàng loạt. Bắt đầu bằng một provider mới, xác nhận launcher thực tế, rồi thay provider cũ ở một release kế tiếp. Cần giữ `GlanceAppWidget` stateless; state app vẫn ở storage và gọi `update()`/`updateAll()` sau khi state thay đổi.

## Checklist triển khai

1. Chọn user story duy nhất: “xem streak”, “xem check-in mới nhất” hoặc “mở check-in”. Không nhồi toàn bộ PWA vào widget.
2. Vẽ compact và expanded state trước; xác định text cắt ở đâu và placeholder khi offline/chưa đăng nhập.
3. Cập nhật `appwidget-provider` (min/max resize, `targetCell*`, description, preview).
4. Custom XML/drawable và `buildViews()`. Mỗi action cần `PendingIntent` chính xác.
5. Gửi update khi app bridge/FCM thay đổi state. Dùng WorkManager cho ảnh/mạng chậm.
6. Thử từ widget picker trên Pixel emulator API 36 và ít nhất một launcher/OEM thật (Samsung hoặc Xiaomi nếu là thiết bị người dùng).
7. Test: thêm/xoá widget, resize mọi chiều, cold start, offline, URL ảnh hỏng, nhiều instance widget, đổi dark/light launcher, rồi restart máy.

## Lệnh kiểm tra

```powershell
cd apps\android
.\gradlew.bat :app:assembleDebug :app:testDebugUnitTest
cd ..\..
.\apps\android\scripts\WidgetDiagnostics.ps1
```

Nếu có nhiều thiết bị ADB:

```powershell
.\apps\android\scripts\WidgetDiagnostics.ps1 -Serial <serial>
```

Script chỉ đọc thông tin thiết bị/package/AppWidget host; không cài APK, không xoá data và không gửi broadcast cập nhật.

## Tài liệu và source tham chiếu

- [Android App widgets overview](https://developer.android.com/develop/ui/views/appwidgets/overview) — mô hình widget, loại widget, hạn chế `RemoteViews`.
- [Create a simple widget](https://developer.android.com/develop/ui/views/appwidgets) và [advanced widgets](https://developer.android.com/develop/ui/views/appwidgets/advanced) — metadata, update, collection và giới hạn receiver.
- [Flexible widget layouts](https://developer.android.com/develop/ui/views/appwidgets/layouts) và [Widget sizing](https://developer.android.com/design/ui/mobile/guides/widgets/sizing) — responsive sizes/breakpoint.
- [Android 16 behaviour changes](https://developer.android.com/about/versions/16/behavior-changes-16) — checklist khi target API 36.
- [Jetpack Glance](https://developer.android.com/develop/ui/compose/glance), [Glance release notes](https://developer.android.com/jetpack/androidx/releases/glance), và [Glance code samples](https://github.com/android/platform-samples/tree/main/samples/user-interface/appwidgets).
- [Android UI AppWidget samples](https://github.com/android/user-interface-samples/tree/main/AppWidget) — đặc biệt mẫu ảnh dùng Coil + WorkManager.
- [WorkManager release notes](https://developer.android.com/jetpack/androidx/releases/work) — kiểm tra stable version trước khi nâng dependency.
