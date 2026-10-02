# Đóng góp

Cảm ơn bạn đã quan tâm. Repo này chỉ chứa công cụ tạo gói hash và tài liệu; dữ
liệu tên miền đến từ [HaGeZi DNS Blocklists](https://github.com/hagezi/dns-blocklists).

## Báo dữ liệu sai

- **Chặn nhầm** một trang phù hợp với trẻ: mở issue theo mẫu "Chặn nhầm".
- **Bỏ sót** một trang người lớn hoặc cờ bạc: hãy báo cho
  [HaGeZi](https://github.com/hagezi/dns-blocklists/issues). Repo này không thêm
  tên miền ngoài dữ liệu upstream.

## Sửa công cụ hoặc tài liệu

1. Cần Node.js 22.2 trở lên; không có gói phụ thuộc nào cần cài.
2. Chạy `npm test` trước khi mở pull request.
3. Thay đổi làm đổi nội dung `web-safety.bin` hoặc `manifest.json` phải cập nhật
   [FORMAT.md](FORMAT.md); thay đổi không tương thích phải tăng phiên bản định
   dạng.
4. Mỗi dòng thêm vào `config/allowlist.txt` cần kèm chú thích lý do.

Pull request không chạy bước ký và phát hành; việc đó chỉ diễn ra trên nhánh
`main` sau khi thay đổi được duyệt.

## Giấy phép

Đóng góp của bạn được phát hành theo GNU GPL phiên bản 3, giống phần còn lại
của repo ([LICENSE](LICENSE)). Riêng đóng góp vào `FORMAT.md` và
`tests/vectors.json` được phát hành theo CC0 1.0.
