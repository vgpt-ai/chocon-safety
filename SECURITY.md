# Chính sách bảo mật

## Báo lỗ hổng

Vui lòng **không** mở issue công khai cho lỗ hổng bảo mật. Hãy báo riêng qua
[Report a vulnerability](https://github.com/vgpt-ai/chocon-safety/security/advisories/new)
của repo này.

Những vấn đề thuộc phạm vi:

- Cách giả mạo hoặc vượt qua chữ ký của `manifest.json`.
- Cách khiến `scripts/verify.mjs` chấp nhận một bản phát hành đã bị sửa.
- Lỗi trong định dạng hoặc mã tra cứu làm một tên miền có trong danh sách không
  bị nhận ra.
- Lỗi trong workflow phát hành có thể làm lộ khóa ký hoặc cho phép mã chưa được
  duyệt chạy bước ký.

Một tên miền bị chặn nhầm hoặc bị bỏ sót trong dữ liệu không phải lỗ hổng bảo
mật; hãy dùng mẫu issue tương ứng.

## Phiên bản được hỗ trợ

Chỉ bản phát hành mới nhất được duy trì. Bản đã phát hành không bị sửa; mọi
khắc phục được đưa ra dưới dạng một bản mới.

## Khóa ký

Manifest được ký bằng Ed25519. Khóa công khai nằm ở
[keys/web-safety-ed25519.pub.pem](keys/web-safety-ed25519.pub.pem). Nếu khóa
riêng bị nghi lộ, khóa mới sẽ được công bố tại đây và trong bản cập nhật ứng
dụng Chocon; ứng dụng không nhận khóa mới từ bản phát hành dữ liệu.
