# Khóa công khai xác minh manifest

`web-safety-ed25519.pub.pem` là khóa công khai Ed25519 dùng để xác minh chữ ký
trong `manifest.json`. Khóa riêng tương ứng không nằm trong repo này.

File ở đây phục vụ việc tự kiểm tra độc lập. Chocon Desktop và backend dùng bản
khóa công khai đã đóng sẵn trong ứng dụng; chúng không tải khóa từ repo hay từ
bản phát hành rồi coi đó là điểm tin cậy.
