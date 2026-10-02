# chocon-safety

[![ci](https://github.com/vgpt-ai/chocon-safety/actions/workflows/ci.yml/badge.svg)](https://github.com/vgpt-ai/chocon-safety/actions/workflows/ci.yml)
[![Bản mới nhất](https://img.shields.io/github/v/release/vgpt-ai/chocon-safety?label=d%E1%BB%AF%20li%E1%BB%87u)](https://github.com/vgpt-ai/chocon-safety/releases/latest)
[![Giấy phép: GPL v3](https://img.shields.io/badge/license-GPLv3-blue.svg)](LICENSE)

Dữ liệu an toàn web của [Chocon](https://chocon.net): gói hash dùng để nhận biết
tên miền người lớn (NSFW) và cờ bạc (Gambling), cùng công cụ tạo và xác minh
gói đó.

*English summary: this repository publishes the hashed web-safety data used by
Chocon, derived from HaGeZi's NSFW and Gambling DNS blocklists (GPL-3.0). Every
release ships the runtime hash package together with its complete corresponding
source. See [NOTICE.md](NOTICE.md) and [FORMAT.md](FORMAT.md).*

## Nguồn dữ liệu và giấy phép

Dữ liệu được tạo từ hai danh sách của dự án
[HaGeZi DNS Blocklists](https://github.com/hagezi/dns-blocklists):

| Danh mục | File upstream |
|---|---|
| NSFW | `wildcard/nsfw-onlydomains.txt` |
| Gambling | `wildcard/gambling-onlydomains.txt` |

HaGeZi phát hành các danh sách này theo **GNU GPL phiên bản 3**. Gói hash là bản
chuyển đổi của dữ liệu đó, nên được phát hành theo cùng giấy phép và luôn đi kèm
nguồn tương ứng. Công cụ trong repo này cũng theo GNU GPL phiên bản 3
([LICENSE](LICENSE)). Chi tiết về nguồn gốc và các thay đổi: [NOTICE.md](NOTICE.md).
Cách từng nghĩa vụ của giấy phép được đáp ứng: [COMPLIANCE.md](COMPLIANCE.md).

## Tải ở đâu

Mọi bản phát hành nằm tại
[Releases](https://github.com/vgpt-ai/chocon-safety/releases), tag dạng
`data-YYYYMMDD-NNN`. Mỗi bản có ba file:

| File | Nội dung |
|---|---|
| `manifest.json` | Phiên bản, checksum, đường tải và chữ ký Ed25519 |
| `runtime.zip` | `web-safety.bin` (bảng hash) cùng `LICENSE`, `NOTICE.md`, `SOURCE.md` |
| `corresponding-source.tar.gz` | **Nguồn tương ứng** của đúng bản đó |

- `runtime.zip` không chứa tên miền dạng rõ. Ứng dụng Chocon chỉ tải
  `manifest.json` và `runtime.zip`.
- `corresponding-source.tar.gz` chứa danh sách tên miền gốc lấy từ HaGeZi tại
  đúng commit đã dùng, các điều chỉnh của Chocon, script, cấu hình và hướng dẫn
  tạo lại. File này dành cho người chủ động tải nguồn.
- Mục "Source code (zip/tar.gz)" do GitHub tự tạo ở mỗi Release chỉ chứa công
  cụ, **không** chứa dữ liệu đầu vào. Nguồn tương ứng đầy đủ là
  `corresponding-source.tar.gz`.
- Bản đã phát hành không bị sửa. Khi cần thay đổi dữ liệu, một bản mới được tạo.

## Hash được tạo như thế nào

1. Tải hai danh sách và giấy phép của HaGeZi tại **một commit cố định**.
2. Chuẩn hóa từng tên miền (chữ thường, punycode), bỏ dòng không hợp lệ, loại
   các mục trong [config/allowlist.txt](config/allowlist.txt). Build dừng nếu
   danh sách bị hụt bất thường hoặc nếu một tên miền trong
   [config/never-block.txt](config/never-block.txt) bị chặn.
3. Thay mỗi tên miền bằng 8 byte đầu của SHA-256, sắp xếp theo từng danh mục và
   ghi vào `web-safety.bin`.
4. Đóng gói `runtime.zip` và `corresponding-source.tar.gz`, ghi checksum vào
   `manifest.json` rồi ký bằng khóa Ed25519.
5. Trước khi phát hành, giải nén gói nguồn và tạo lại `runtime.zip` từ đó; hai
   bản phải trùng từng byte.

Bản mới được tạo khoảng mỗi tháng một lần và chỉ được phát hành khi bảng hash
thực sự thay đổi. Chocon không chạy theo dữ liệu mới nhất của upstream.

Định dạng file, cách tra cứu và quy trình cập nhật cho ứng dụng: [FORMAT.md](FORMAT.md).

## Tự tạo lại và xác minh

Cần Node.js 22.2 trở lên, không cần cài thêm gói nào.

```bash
# Xác minh một bản đã tải (ba file trong cùng thư mục), kể cả tạo lại từ nguồn
node scripts/verify.mjs <thư-mục> --rebuild

# Tạo thử một bản từ dữ liệu HaGeZi mới nhất, không ký
node scripts/build.mjs --version data-20260101-001 --unsigned --out dist
node scripts/verify.mjs dist --allow-unsigned --rebuild

# Chạy test
npm test
```

Hướng dẫn tạo lại từ gói nguồn của một bản cụ thể: [REBUILD.md](REBUILD.md).

## Chữ ký

`manifest.json` được ký bằng Ed25519. Khóa công khai nằm ở
[keys/web-safety-ed25519.pub.pem](keys/web-safety-ed25519.pub.pem); khóa riêng
không có trong repo. Việc ký và phát hành chỉ chạy trên nhánh `main`, theo lịch
hoặc do người duy trì kích hoạt; pull request không chạy được bước này.

## Báo chặn nhầm, đóng góp và bảo mật

- Trang học tập hoặc trang phù hợp với trẻ bị chặn nhầm: mở
  [issue "Chặn nhầm"](https://github.com/vgpt-ai/chocon-safety/issues/new/choose).
  Lỗi thuộc về danh sách gốc cũng nên được báo cho
  [HaGeZi](https://github.com/hagezi/dns-blocklists/issues).
- Sửa công cụ hoặc tài liệu: xem [CONTRIBUTING.md](CONTRIBUTING.md).
- Lỗ hổng bảo mật: báo riêng theo [SECURITY.md](SECURITY.md).

## Cấu trúc repo

```text
config/     Danh sách upstream được dùng, ngưỡng kiểm tra, allowlist, never-block
keys/       Khóa công khai xác minh manifest
scripts/    build.mjs, verify.mjs, release-notes.mjs và thư viện dùng chung
tests/      Test của công cụ
.github/    Workflow kiểm tra và phát hành
```
