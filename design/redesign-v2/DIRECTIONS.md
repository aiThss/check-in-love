# 3 hướng thẩm mỹ — Check IN Love Redesign v2

Mở bằng trình duyệt (thêm `?theme=dark` để mở sẵn chế độ tối):
- [index.html](index.html) — trang so sánh
- [mock-a-editorial.html](mock-a-editorial.html) — **A · Soft Editorial Romance**
- [mock-b-liquid.html](mock-b-liquid.html) — **B · Liquid Glass 2.0**
- [mock-c-sticker.html](mock-c-sticker.html) — **C · Playful Sticker**

Ảnh chụp sẵn trong `shots/` (light + dark mỗi hướng). Mỗi mock có 6 khung 390×844: Home, Chat, Check-in, Memories, Profile, và khung Component (nút, 12+ icon mẫu, bottom sheet với thanh reaction). Tất cả dùng chung bảng màu gốc (accent `#ff3b7f`, nền `#f8e2e7`, dark plum `#261824`→`#632d4d`), chung markup, khác hẳn ngôn ngữ thị giác. Sinh lại bằng `node design/redesign-v2/build-mocks.mjs`.

> Font trong mock dùng font hệ thống để mở được offline. Khi triển khai: tự host Be Vietnam Pro (body) + font display theo hướng được chọn.

## ✅ Hướng đã chốt: MIX

[mock-mix.html](mock-mix.html) · ảnh: shots/mix-light.png, shots/mix-dark.png. Công thức: **A làm nền** + **kính kiểu B chỉ ở nav, bottom sheet, composer** + từ **C**: chat (bong bóng viền mực + bóng offset cứng, thanh reaction), nhãn vàng cho streak/chip ngày, micro-animation nhấn. Quyết định ghi trong docs/redesign-v2/DECISIONS.md.

## So sánh

| | **A · Editorial Romance** | **B · Liquid Glass 2.0** | **C · Playful Sticker** |
|---|---|---|---|
| Cảm giác | Thư tay / album ảnh in, ấm, riêng tư | Hiện đại kiểu iOS 26, bóng bẩy | Vui, trẻ, dễ thương, nổi bật |
| Chữ | Serif (Iowan/Georgia) cho tiêu đề, số ngày nghiêng; sans cho nội dung | Sans đậm, tracking chặt, số ngày gradient | Rounded 900, số ngày viền + bóng đổ cứng |
| Nền & bề mặt | Hồng phấn + giấy kem + grain nhẹ | Orb gradient + kính mờ nhiều lớp | Hồng phẳng + viền đen 3px + bóng offset |
| Card ảnh | Polaroid nghiêng + băng dính, lưới "album" | Card kính bo 30px | Sticker nghiêng, viền dày |
| Icon | Nét 1,6px, active = tô đặc + gạch chân nhỏ | Nét 1,5px duotone (tô mờ 14%), active = viên kính | Nét 2,3px + bóng offset, active = nhãn vàng nghiêng |
| Chat | Bong bóng bo 20px, đuôi nhỏ, nền kem | Bong bóng gradient, kính | Viền đen + bóng cứng |
| Nav | Thanh kem mờ nhẹ, nút check-in vòng kem | Viên thuốc kính nổi | Thanh trắng viền dày, nút check-in sticker |
| Mức dùng `backdrop-filter` | Thấp (nav, header chat, composer, sheet) | **Cao** (hầu hết card) | **Không có** |
| Chi phí hiệu năng WebView tầm trung | Thấp–vừa | **Cao nhất**; cần fallback màu đặc | **Thấp nhất** |
| Dễ giữ nhất quán 70 icon tự vẽ | Dễ (nét mảnh, đều) | Vừa (duotone cần tinh chỉnh từng icon) | Dễ nhưng cần kỷ luật bóng đổ |
| Rủi ro | Có thể "hơi nghiêm" nếu làm quá cổ điển | Dễ giống mọi app glass khác ("đại trà"); tụt FPS | Dễ thành trẻ con; khó mở rộng sang màn dày dữ liệu |
| Hợp với accent picker | Tốt | Tốt (gradient tự suy ra) | Cần chọn lại màu vàng phụ theo accent |

## Gợi ý của tôi (ý kiến, không bắt buộc)

**A làm nền**, vì ba lý do: nhận diện riêng (không giống mọi app kính), nhẹ hơn B rất nhiều cho Android WebView, và polaroid/album ăn khớp với tính năng cốt lõi (check-in ảnh, daily polaroid, kỷ niệm). Có thể mượn từ **C** cách làm *micro-animation + nhãn vàng* cho streak/ngày kỷ niệm, và từ **B** chỉ giữ kính ở nav + bottom sheet (A đã làm đúng như vậy).

Bạn cũng có thể trộn: ví dụ "A + chat của B" hoặc "A + icon active của C". Nói rõ để agent ghi vào `DECISIONS.md`.

## Kiểm tra theo PROMPT.md mục 2.4

- Tap target ≥ 44×44: nút/icon-button/nav-item trong mock đặt `min-height` 44–48px. ✔
- Tương quan màu: chữ trắng trên nút dùng `accent-strong` ≥ 4,5:1 (tính tay: `#e0246a` 4,54:1). Chữ phụ đã tối hơn token cũ. ✔ (cần test tự động ở P1)
- Tiếng Việt có dấu hiển thị đúng với font hệ thống (xem ảnh chụp). ✔
- Reaction và icon UI đều là SVG tự vẽ, không dùng emoji hệ thống làm icon (emoji chỉ còn trong nội dung tin nhắn mẫu). ✔
