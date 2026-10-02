# Tạo lại gói hash từ gói nguồn tương ứng

Cần Node.js 22.2 trở lên. Không cần cài thêm gói nào và không cần mạng.

```bash
tar -xzf corresponding-source.tar.gz
cd chocon-safety-data-*
node scripts/build.mjs --sources-dir sources --build-info build-info.json --unsigned --out rebuilt
shasum -a 256 rebuilt/runtime.zip
```

Kết quả `rebuilt/runtime.zip` phải có sha256 trùng với `runtime.sha256` trong
`manifest.json` của cùng bản phát hành (cũng được ghi ở trang Release).

Thành phần của gói nguồn:

| Đường dẫn | Nội dung |
|---|---|
| `sources/upstream/` | Dữ liệu đầu vào lấy nguyên văn từ HaGeZi tại đúng một commit, kèm giấy phép của upstream |
| `sources/upstream.json` | Repo, commit, URL và sha256 của từng file đầu vào |
| `config/allowlist.txt` | Các mục Chocon loại khỏi bảng hash |
| `config/sources.json` | Danh sách nào được dùng, ngưỡng kiểm tra |
| `config/never-block.txt` | Tên miền dùng làm chốt chặn; không làm đổi bảng hash |
| `scripts/`, `tests/` | Công cụ tạo và xác minh gói |
| `build-info.json` | Phiên bản và thời điểm tạo của bản phát hành |

Để tự xác minh một bản phát hành đã tải về (cả ba file trong cùng thư mục):

```bash
node scripts/verify.mjs <thư-mục> --rebuild
```

`--rebuild` chạy script nằm trong gói nguồn đã tải. Với bản có chữ ký hợp lệ,
gói nguồn được ràng buộc với manifest đã ký. Không dùng `--allow-unsigned
--rebuild` với file tải từ nơi không tin cậy.
