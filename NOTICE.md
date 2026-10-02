# Thông báo về nguồn và giấy phép dữ liệu

Gói dữ liệu an toàn web của Chocon (`web-safety.bin`) là một bảng hash được tạo
từ các danh sách chặn sau của dự án **HaGeZi DNS Blocklists**:

- NSFW — `wildcard/nsfw-onlydomains.txt`
- Gambling — `wildcard/gambling-onlydomains.txt`

Nguồn gốc: <https://github.com/hagezi/dns-blocklists>
Bản quyền thuộc về HaGeZi và những người đóng góp cho dự án đó.
Giấy phép: GNU General Public License phiên bản 3 (toàn văn trong file `LICENSE`).

## Chocon đã thay đổi gì

- Mỗi tên miền được chuẩn hóa (chữ thường, dạng ASCII/punycode) rồi thay bằng
  8 byte đầu của SHA-256; bảng hash không chứa tên miền dạng rõ.
- Các mục trong `config/allowlist.txt` (nếu có) bị loại khỏi bảng hash.
- Không thêm tên miền nào ngoài dữ liệu của HaGeZi.

Commit upstream, phiên bản từng danh sách và checksum của dữ liệu đầu vào được
ghi trong `manifest.json` của từng bản phát hành.

## Nguồn tương ứng

Mỗi bản phát hành tại <https://github.com/vgpt-ai/chocon-safety/releases> có
kèm `corresponding-source.tar.gz`: đúng dữ liệu đầu vào, các điều chỉnh, script,
cấu hình và hướng dẫn để tạo lại gói hash của bản đó. Công cụ trong repo này
cũng được phát hành theo GNU GPL phiên bản 3.

## Không bảo hành

Dữ liệu được cung cấp "nguyên trạng", không kèm bảo hành nào, theo điều 15 và
16 của GNU GPL phiên bản 3.
