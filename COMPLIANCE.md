# Tuân thủ giấy phép GNU GPL phiên bản 3

Tài liệu này ghi lại cách Chocon đáp ứng giấy phép của dữ liệu HaGeZi khi phân
phối gói hash, và những điều ứng dụng Chocon phải giữ. Đây là mô tả kỹ thuật
của bên duy trì, không phải ý kiến pháp lý.

## 1. Lập trường

- Danh sách chặn của HaGeZi được phát hành theo GNU GPL phiên bản 3.
- `web-safety.bin` được tạo hoàn toàn từ các danh sách đó. Chocon chọn cách
  hiểu thận trọng: coi bảng hash là **bản đã sửa đổi** của dữ liệu HaGeZi và
  phát hành nó theo chính GNU GPL phiên bản 3, kèm nguồn tương ứng.
- Chocon không dựa vào lập luận "hash không còn là tác phẩm gốc" để giảm nghĩa vụ.

## 2. Nghĩa vụ và cách đáp ứng

| Điều khoản GPLv3 | Yêu cầu | Cách đáp ứng |
|---|---|---|
| §4 | Giữ nguyên thông báo bản quyền, giấy phép và miễn trừ bảo hành; trao kèm bản giấy phép | Gói nguồn chứa nguyên văn file của HaGeZi (kể cả phần đầu file) và `LICENSE` của upstream. `runtime.zip` chứa `LICENSE` và `NOTICE.md` |
| §5(a) | Ghi rõ tác phẩm đã được sửa đổi và ngày sửa đổi | `NOTICE.md` mô tả thay đổi; `SOURCE.md` trong `runtime.zip` ghi ngày chuyển đổi, phiên bản và commit upstream |
| §5(b) | Ghi rõ tác phẩm được phát hành theo GPLv3 | `NOTICE.md`, `SOURCE.md`, ghi chú của từng Release, trường `license` trong manifest |
| §5(c) | Cấp phép toàn bộ tác phẩm theo GPLv3 cho bất kỳ ai nhận được | Toàn bộ `runtime.zip` và công cụ trong repo theo GPLv3; không kèm điều khoản bổ sung |
| §6(d) | Phân phối dạng không phải nguồn qua mạng thì cung cấp nguồn tương ứng theo cách tương đương, cùng nơi, không thu thêm phí | `corresponding-source.tar.gz` nằm cùng Release với `runtime.zip`, tải công khai, không cần tài khoản. `SOURCE.md` dẫn tới đúng file của đúng phiên bản |
| §1 (định nghĩa nguồn tương ứng) | Nguồn phải đủ để tạo lại bản không phải nguồn, gồm cả script điều khiển việc đó | Gói nguồn có dữ liệu đầu vào tại đúng commit, `config/` (các điều chỉnh), `scripts/`, `REBUILD.md`. Trước mỗi lần phát hành, workflow tạo lại `runtime.zip` từ gói nguồn và so từng byte |
| §6 (đoạn cuối mục d) | Bảo đảm nguồn còn lấy được chừng nào còn cần | Xem mục 5 |
| §7, §10 | Không áp thêm hạn chế lên quyền mà giấy phép trao | Xem mục 3 và 4 |
| §15, §16 | Miễn trừ bảo hành và trách nhiệm | Giữ nguyên trong `LICENSE`; nhắc lại trong `NOTICE.md` |

Nguồn được cung cấp là của **chính bản đã phát hành**, không phải đường dẫn tới
bản `latest` của HaGeZi.

## 3. Ranh giới giữa ứng dụng Chocon và dữ liệu

Ứng dụng Chocon (Desktop, backend) là chương trình độc lập, không được tạo từ
dữ liệu HaGeZi. Để ranh giới này là thực chất chứ không chỉ là tách repo:

1. **Dữ liệu là đầu vào, không phải một phần chương trình.** Ứng dụng đọc
   `web-safety.bin` như một file dữ liệu theo định dạng công khai
   ([FORMAT.md](FORMAT.md)). Dữ liệu không được nhúng, biên dịch hay liên kết vào
   mã ứng dụng, và ứng dụng chạy được (ở trạng thái "đang chuẩn bị bảo vệ web")
   khi chưa có file này.
2. **Phân phối tách rời.** Bộ cài và gói tài nguyên của ứng dụng không chứa
   `web-safety.bin` hay danh sách tên miền. Ứng dụng tải `manifest.json` và
   `runtime.zip` từ Releases của repo này khi chạy.
3. **Mã đọc dữ liệu được viết độc lập.** Phần đọc và tra cứu trong ứng dụng được
   cài đặt từ đặc tả `FORMAT.md` và kiểm bằng `tests/vectors.json`. Hai tài liệu
   này được Chocon phát hành theo CC0 1.0 chính vì mục đích đó. Không sao chép mã
   trong `scripts/` (GPLv3) vào ứng dụng.
4. **Không hạn chế thêm.** Điều khoản sử dụng của ứng dụng Chocon không được
   cấm hay hạn chế việc sao chép, sửa đổi, phân phối lại gói dữ liệu; quyền đối
   với gói dữ liệu do GPLv3 quy định.
5. **Chữ ký không khóa dữ liệu.** Chữ ký Ed25519 chỉ để ứng dụng biết gói đến từ
   Chocon. Gói dữ liệu không bị mã hóa, định dạng công khai, ai cũng đọc, sửa và
   dùng được trong phần mềm khác. Việc ứng dụng Chocon chỉ nhận gói do Chocon ký
   là hành vi của ứng dụng, không phải hạn chế gắn vào dữ liệu. Nghĩa vụ
   "Installation Information" ở §6 áp dụng khi tác phẩm được trao kèm trong giao
   dịch chuyển giao một "User Product" (thiết bị); Chocon không bán thiết bị.

## 4. Việc ứng dụng Chocon phải làm

- Giữ nguyên `LICENSE`, `NOTICE.md`, `SOURCE.md` cạnh `web-safety.bin` trên máy.
- Có mục "Giấy phép dữ liệu" mà người dùng mở được, nêu: dữ liệu an toàn web tạo
  từ HaGeZi DNS Blocklists, giấy phép GNU GPL phiên bản 3, phiên bản dữ liệu đang
  dùng, và đường dẫn tới Release của đúng phiên bản đó để lấy nguồn tương ứng.
- Không đóng dữ liệu vào bộ cài; không sao chép mã GPL của repo này.
- Không đưa điều khoản nào hạn chế quyền của người dùng đối với gói dữ liệu.

## 5. Duy trì khả năng lấy nguồn

- Mỗi Release là bất biến: asset và tag không bị sửa sau khi phát hành.
- Chocon không xóa Release chừng nào bản runtime của nó còn có thể đang được
  dùng hoặc còn được cung cấp để tải.
- Nếu sau này gói runtime được phân phối từ hạ tầng khác, gói nguồn tương ứng
  của từng phiên bản vẫn được giữ công khai và `SOURCE.md` vẫn dẫn tới đúng nơi.
- Chocon giữ bản sao của mọi bản đã phát hành ngoài GitHub. Dùng GitHub không
  chuyển nghĩa vụ duy trì nguồn sang GitHub.

## 6. Điểm cần người có chuyên môn pháp lý xác nhận

1. Ranh giới ở mục 3 có đủ để ứng dụng Chocon và gói dữ liệu là hai tác phẩm
   tách biệt hay không.
2. Câu chữ trong điều khoản sử dụng của ứng dụng liên quan tới dữ liệu bên thứ ba.
3. Tên pháp nhân đứng tên bản quyền công cụ trong `NOTICE.md`.
4. Việc phát hành `FORMAT.md` và `tests/vectors.json` theo CC0 1.0.
