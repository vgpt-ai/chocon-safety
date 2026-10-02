# Định dạng dữ liệu và cách sử dụng

Tài liệu này mô tả `manifest.json`, `runtime.zip`, `web-safety.bin` và quy trình
mà một ứng dụng (Chocon Desktop, backend) dùng để cập nhật và tra cứu.

## 1. Các file của một bản phát hành

Tag có dạng `data-YYYYMMDD-NNN` (ngày theo UTC, số thứ tự trong ngày).

| File | Nội dung | Ứng dụng tự tải? |
|---|---|---|
| `manifest.json` | Phiên bản, định dạng, kích thước, checksum, đường tải, chữ ký | Có |
| `runtime.zip` | `web-safety.bin`, `LICENSE`, `NOTICE.md`, `SOURCE.md` | Có, khi có bản mới |
| `corresponding-source.tar.gz` | Nguồn tương ứng, có danh sách tên miền gốc | Không |

`runtime.zip` lưu file nguyên dạng (không nén) và không chứa tên miền dạng rõ.

## 2. `manifest.json`

```json
{
  "payload": "{\"schemaVersion\":1,\"version\":\"data-20261003-001\", ... }",
  "signature": { "algorithm": "ed25519", "keyId": "…", "value": "<base64>" }
}
```

- `payload` là một **chuỗi** JSON. Chữ ký Ed25519 được tính trên đúng các byte
  UTF-8 của chuỗi này; phải xác minh chữ ký trước rồi mới `JSON.parse(payload)`.
- `keyId` là 16 ký tự hex đầu của SHA-256 trên khóa công khai dạng SPKI DER, chỉ
  để chọn khóa. Khóa dùng để xác minh phải là khóa đã đóng sẵn trong ứng dụng.

Các trường của payload:

| Trường | Ý nghĩa |
|---|---|
| `schemaVersion` | Hiện là `1`. Giá trị khác: bỏ qua bản này |
| `version` | Tag của bản phát hành |
| `createdAt` | Thời điểm tạo (ISO 8601, UTC) |
| `format.version` | Phiên bản định dạng `web-safety.bin`. Giá trị không hỗ trợ: bỏ qua bản này |
| `runtime.url`, `.size`, `.sha256` | Đường tải gắn với đúng tag, kích thước và SHA-256 của `runtime.zip` |
| `runtime.bin.size`, `.sha256`, `.categories[]` | Kích thước, SHA-256 và số mục theo danh mục của `web-safety.bin` |
| `correspondingSource.*` | Đường tải, kích thước, SHA-256 của gói nguồn |
| `upstream.*` | Repo, commit, giấy phép, checksum dữ liệu đầu vào, phiên bản từng danh sách |

## 3. `web-safety.bin` (định dạng phiên bản 1)

Số nguyên nhiều byte đều theo thứ tự big-endian.

| Vị trí | Kích thước | Nội dung |
|---|---|---|
| 0 | 8 | Magic ASCII `CHCNWSD1` |
| 8 | 2 | Phiên bản định dạng = 1 |
| 10 | 1 | Thuật toán hash = 1 (SHA-256 cắt ngắn) |
| 11 | 1 | Độ dài mỗi hash = 8 byte |
| 12 | 2 | Số section `S` |
| 14 | 2 | Dự trữ = 0 |
| 16 | 16 × S | Bảng section |
| … | 8 × tổng số mục | Dữ liệu các section, nối liền nhau theo thứ tự trong bảng |
| cuối | 32 | SHA-256 của toàn bộ phần đứng trước |

Mỗi dòng của bảng section:

| Vị trí | Kích thước | Nội dung |
|---|---|---|
| 0 | 2 | Id danh mục: `1` = nsfw, `2` = gambling |
| 2 | 2 | Dự trữ = 0 |
| 4 | 4 | Số mục |
| 8 | 8 | Vị trí bắt đầu của section tính từ đầu file |

Trong một section, các hash 8 byte được sắp tăng dần (so sánh như số nguyên
không dấu 64 bit) và không trùng nhau, nên tra cứu bằng tìm kiếm nhị phân.

Hash của một tên miền = 8 byte đầu của `SHA-256(tên miền đã chuẩn hóa, UTF-8)`.

## 4. Tra cứu một hostname

1. Chuẩn hóa: bỏ khoảng trắng, đổi sang chữ thường, bỏ dấu chấm cuối, chuyển
   tên miền quốc tế sang punycode. Hostname chỉ có một nhãn hoặc không hợp lệ
   thì coi là không khớp.
2. Lấy hostname và mọi tên miền cha theo ranh giới nhãn, tới khi còn hai nhãn.
   Ví dụ `a.b.example.com` → `a.b.example.com`, `b.example.com`, `example.com`.
3. Tính hash từng chuỗi và tìm trong từng section. Khớp ở đâu thì hostname thuộc
   danh mục đó. Một mục chặn cả tên miền đó lẫn mọi tên miền con.

Việc tra cứu chỉ dùng dữ liệu cục bộ; không gọi mạng khi xét từng trang web.
Với 8 byte hash và khoảng 660 nghìn mục, xác suất một tên miền bất kỳ bị khớp
nhầm vào khoảng 4 × 10⁻¹⁴.

Mã tham chiếu: `scripts/lib/bin.mjs` (`parseBin`, `lookup`) và
`scripts/lib/domains.mjs` (`normalizeHostname`).

## 5. Quy trình cập nhật cho ứng dụng

```text
# Chỉ để biết phiên bản mới nhất
https://github.com/vgpt-ai/chocon-safety/releases/latest/download/manifest.json

# Tải gói: dùng đúng runtime.url trong manifest (đã gắn tag cụ thể)
https://github.com/vgpt-ai/chocon-safety/releases/download/<tag>/runtime.zip
```

1. Khởi động bằng bản hợp lệ đã lưu trên máy.
2. Khoảng một lần mỗi ngày, có giãn ngẫu nhiên, tải `manifest.json`.
3. Xác minh chữ ký bằng khóa công khai đóng sẵn; kiểm `schemaVersion` và
   `format.version`.
4. Nếu `runtime.bin.sha256` trùng bản đang dùng thì dừng, không tải gì thêm.
5. Tải `runtime.url`; từ chối nếu vượt `runtime.size`; kiểm `runtime.sha256`.
6. Lấy `web-safety.bin` trong ZIP; kiểm `runtime.bin.sha256`, magic, bảng
   section và 32 byte toàn vẹn cuối file.
7. Ghi ra file tạm rồi đổi tên để thay thế; giữ lại bản trước để phục hồi.

Không cần token GitHub và không dùng GitHub REST API.

| Tình huống | Hành vi |
|---|---|
| Không truy cập được GitHub | Tiếp tục dùng bản đang có |
| Manifest sai chữ ký, gói sai checksum hoặc sai cấu trúc | Bỏ bản mới, giữ bản đang có |
| Tải bị gián đoạn | Không thay bản đang dùng bằng file chưa hoàn chỉnh |
| Chưa từng có bản hợp lệ | Báo trạng thái đang chuẩn bị; không coi danh sách chặn là rỗng |

Ứng dụng nên giới thiệu kèm `LICENSE`, `NOTICE.md` và `SOURCE.md` trong
`runtime.zip` ở mục giấy phép dữ liệu của mình.
