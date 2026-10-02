# Thông báo về nguồn và giấy phép dữ liệu

Gói dữ liệu an toàn web của Chocon (`web-safety.bin`) là một bảng hash được tạo
từ các danh sách chặn sau của dự án **HaGeZi DNS Blocklists**:

- NSFW — `wildcard/nsfw-onlydomains.txt`
- Gambling — `wildcard/gambling-onlydomains.txt`

Nguồn gốc: <https://github.com/hagezi/dns-blocklists>
Bản quyền dữ liệu thuộc về HaGeZi và những người đóng góp cho dự án đó.
Giấy phép: GNU General Public License phiên bản 3 (toàn văn trong file `LICENSE`).

Gói dữ liệu này là bản đã sửa đổi của các danh sách trên và được phát hành theo
cùng giấy phép đó. Bạn có quyền sao chép, sửa đổi và phân phối lại gói này theo
các điều khoản của GNU GPL phiên bản 3.

## Chocon đã thay đổi gì

- Mỗi tên miền được chuẩn hóa (chữ thường, dạng ASCII/punycode) rồi thay bằng
  8 byte đầu của SHA-256; bảng hash không chứa tên miền dạng rõ.
- Các mục trong `config/allowlist.txt` (nếu có) bị loại khỏi bảng hash.
- Không thêm tên miền nào ngoài dữ liệu của HaGeZi.

Ngày chuyển đổi, commit upstream, phiên bản từng danh sách và checksum của dữ
liệu đầu vào được ghi trong `SOURCE.md` và `manifest.json` của từng bản phát hành.

## Nguồn tương ứng

Mỗi bản phát hành tại <https://github.com/vgpt-ai/chocon-safety/releases> có
kèm `corresponding-source.tar.gz`: đúng dữ liệu đầu vào, các điều chỉnh, script,
cấu hình và hướng dẫn để tạo lại gói hash của bản đó. Nguồn được cung cấp công
khai, không thu phí, tại cùng nơi với gói hash.

Công cụ tạo và xác minh gói trong repo này: Copyright © 2026 Chocon, phát hành
theo GNU GPL phiên bản 3. Đặc tả định dạng (`FORMAT.md`) và bộ ví dụ
(`tests/vectors.json`) được phát hành theo CC0 1.0 để ai cũng có thể tự viết bộ
đọc độc lập.

## Không bảo hành

Dữ liệu được cung cấp "nguyên trạng", không kèm bảo hành nào, theo điều 15 và
16 của GNU GPL phiên bản 3.

## English summary

`web-safety.bin` is a modified version (a table of truncated SHA-256 hashes) of
the NSFW and Gambling lists from HaGeZi DNS Blocklists
(<https://github.com/hagezi/dns-blocklists>), © HaGeZi and contributors,
licensed under the GNU General Public License version 3. This package is
distributed under the same license, without warranty. The complete
corresponding source for each release is published alongside it at
<https://github.com/vgpt-ai/chocon-safety/releases>; the exact link for this
version is in `SOURCE.md`.
