# Đặc tả use case

Bám theo [sơ đồ use case](../usecase-cuahang-cokhi.puml) và [đặc tả nghiệp vụ](dac-ta-nghiep-vu.md).
Cột "Màn hình" tham chiếu [wireframe](../wireframe-cuahang-cokhi.drawio); cách cài đặt xem [kien-truc.md](kien-truc.md) mục 4.

## Tổng hợp

| Mã | Tên | Tác nhân | Quan hệ | Màn hình |
|---|---|---|---|---|
| UC00 | Đăng nhập | Người dùng | | W00 |
| UC01 | Tra cứu tồn kho & giá | NV bán hàng, Thủ kho | | W02 |
| UC02 | Báo giá cho khách | NV bán hàng | include UC01 | W02 |
| UC03 | Lập phiếu bán | NV bán hàng | include UC04 | W03 |
| UC04 | Quy đổi đơn vị tính | (hệ thống) | được include bởi UC03, UC09, UC21 | W03, W05, W07 |
| UC05 | Thu tiền ngay (khách lẻ) | NV bán hàng | extend UC03 | W03 |
| UC06 | Ghi công nợ (khách thầu) | NV bán hàng | extend UC03 | W03 |
| UC07 | Xử lý khách trả hàng | NV bán hàng | include UC08 | W04 |
| UC08 | Trừ công nợ / hoàn tiền | NV bán hàng | được include bởi UC07 | W04 |
| UC09 | Lập phiếu nhập hàng | Thủ kho | include UC10, UC04 | W05 |
| UC10 | Ghi giá nhập theo lô | (hệ thống) | được include bởi UC09 | W05 |
| UC11 | Kiểm kê kho | Thủ kho | | W06 |
| UC12 | Ghi nhận chênh lệch | Thủ kho | extend UC11 | W06 |
| UC13 | Quản lý khách hàng | NV bán hàng, Chủ | | W08 |
| UC14 | Tra cứu công nợ khách | NV bán hàng, Chủ | | W09 |
| UC15 | Thu nợ cuối tháng | NV bán hàng, Chủ | include UC14 | W09 |
| UC16 | Quản lý hàng hóa | Chủ | include UC17 | W10 |
| UC17 | Khai báo đơn vị & hệ số quy đổi | Chủ | được include bởi UC16 | W10 |
| UC18 | Quản lý nhà cung cấp | Chủ | | W11 |
| UC19 | Quản lý nhân viên | Chủ | | W12 |
| UC20 | Xem báo cáo (R1–R6) | Chủ | | W13 |
| UC21 | Chuyển kho | Thủ kho | include UC01, UC04 | W07 |
| UC22 | Hủy phiếu bán | Chủ | | W14 |
| UC23 | Hủy / sửa giá phiếu nhập | Chủ | | W15 |
| UC24 | Ghi nợ đầu kỳ | Chủ | | W09 |

Ghi chú chung cho mọi use case: người dùng đã đăng nhập (trừ UC00) và có quyền theo bảng trên; Chủ cửa hàng được thực hiện mọi use case.
Mọi thao tác lưu là "tất cả hoặc không": nếu một dòng lỗi thì không ghi gì vào CSDL.

---

## UC00 – Đăng nhập
- **Tác nhân:** mọi người dùng.
- **Luồng chính:** (1) Nhập tài khoản, mật khẩu. (2) Hệ thống kiểm tra, tạo phiên 7 ngày. (3) Vào trang chính, menu hiển thị theo vai trò.
- **Luồng phụ:** sai tài khoản/mật khẩu → báo "Sai tài khoản hoặc mật khẩu", giữ lại tên đăng nhập; tài khoản bị khóa → báo "Tài khoản đã bị khóa".
- **Hậu điều kiện:** có phiên đăng nhập. Đăng xuất hoặc bị khóa / đổi mật khẩu sẽ hủy phiên.

## UC01 – Tra cứu tồn kho & giá
- **Tác nhân:** NV bán hàng, Thủ kho.
- **Luồng chính:** (1) Nhập mã hoặc tên hàng, chọn nhóm, chọn kho (hoặc tất cả). (2) Hệ thống hiển thị mã, tên, tồn theo đơn vị cơ sở, giá bán theo từng đơn vị. (3) Chọn một dòng để xem tồn quy đổi theo từng đơn vị và theo từng kho.
- **Quy tắc:** hàng có tồn ≤ tồn tối thiểu được tô đỏ; hàng ngừng nhập có nhãn riêng.

## UC02 – Báo giá cho khách
- **Tác nhân:** NV bán hàng. **Include:** UC01.
- **Luồng chính:** (1) Từ kết quả tra cứu, bấm "+ Báo giá" cho từng mặt hàng. (2) Chọn khách (hoặc khách lẻ), sửa số lượng, đơn vị; đơn giá lấy theo đơn vị đã chọn. (3) In báo giá hoặc "Chuyển thành phiếu bán".
- **Luồng phụ:** chuyển thành phiếu bán → mở UC03 với sẵn khách và các dòng hàng.
- **Ghi chú:** báo giá không lưu vào CSDL, không giữ hàng.

## UC03 – Lập phiếu bán
- **Tác nhân:** NV bán hàng. **Include:** UC04. **Extend:** UC05, UC06.
- **Tiền điều kiện:** có hàng tồn ở kho xuất.
- **Luồng chính:**
  1. Chọn kho xuất (mặc định Kho chính).
  2. Chọn loại khách: khách lẻ (có thể chọn khách lẻ quen hoặc để vãng lai) hoặc khách thầu (bắt buộc chọn khách). Với khách thầu, hệ thống hiện nợ hiện tại và hạn mức.
  3. Gõ mã/tên hàng, nhập số lượng, chọn đơn vị, bấm Thêm. Lặp lại cho các mặt hàng khác.
  4. Hệ thống quy đổi về đơn vị cơ sở (UC04), hiện cột "Quy đổi", cảnh báo dòng vượt tồn.
  5. Nhập chiết khấu (nếu có); hệ thống tính tổng tiền và số phải trả.
  6. Chọn thanh toán: thu tiền ngay (UC05) hoặc ghi công nợ (UC06).
  7. Lưu. Hệ thống sinh số phiếu `PB-YYYYMMDD-NNN`, trừ tồn theo lô cũ nhất trước (FIFO), ghi giá vốn, mở phiếu để in.
- **Luồng phụ:** không đủ tồn → báo "Không đủ tồn: … còn X, cần Y", không lưu; chiết khấu âm hoặc lớn hơn tổng → báo lỗi.
- **Quy tắc:** nhân viên được sửa đơn giá trên phiếu (giá mặc định lấy theo đơn vị).

## UC04 – Quy đổi đơn vị tính
- **Hệ thống** dùng hệ số khai báo ở UC17: SL cơ sở = SL × hệ số. Ví dụ 5 kg ốc M10x30 × 80 = 400 con.
- Đơn vị chưa khai báo cho mặt hàng → báo lỗi.

## UC05 – Thu tiền ngay (khách lẻ)
- Nhập số tiền khách đưa (không bắt buộc), hệ thống tính tiền thối. Khách đưa ít hơn số phải trả → báo "Khách đưa chưa đủ tiền".

## UC06 – Ghi công nợ (khách thầu)
- Chỉ khách thầu được ghi nợ. Hệ thống ghi một khoản nợ bằng số phải trả, kèm ngày và số phiếu.
- Nợ sau phiếu vượt hạn mức → **cảnh báo** (vẫn cho lưu, chủ quyết định thu bớt).

## UC07 – Xử lý khách trả hàng
- **Tác nhân:** NV bán hàng. **Include:** UC08.
- **Luồng chính:** (1) Nhập số phiếu bán gốc. (2) Hệ thống hiện các dòng đã mua và số còn được trả. (3) Đánh dấu dòng trả, nhập số lượng, xác nhận "Còn nguyên". (4) Nhập lý do. (5) Chọn cách xử lý tiền (UC08). (6) Lưu → số phiếu `TH-…`.
- **Quy tắc:** chỉ nhận hàng còn nguyên; không trả quá số đã mua trừ số đã trả trước đó; hàng nhận lại cộng vào đúng các lô đã xuất; tiền trả lại = SL × đơn giá × (phải trả / tổng tiền hàng) để chia đều chiết khấu.
- **Luồng phụ:** dòng chưa xác nhận còn nguyên → từ chối; không tìm thấy phiếu → báo lỗi.

## UC08 – Trừ công nợ / hoàn tiền
- Khách thầu: trừ vào công nợ (không được trừ quá số nợ hiện có; khi đó chọn hoàn tiền). Khách lẻ: hoàn tiền mặt.

## UC09 – Lập phiếu nhập hàng
- **Tác nhân:** Thủ kho. **Include:** UC10, UC04.
- **Luồng chính:** (1) Chọn nhà cung cấp, kho nhập. (2) Chọn hàng, nhập số lượng, đơn vị (mặc định đơn vị lớn nhất như kg, cuộn), giá nhập; hệ thống gợi ý giá lần nhập trước và hiện giá các lô cũ. (3) Lưu → số phiếu `PN-…`, mỗi dòng tạo một lô mới.
- **Luồng phụ:** hàng đang "ngừng nhập" → không cho nhập; số lượng ≤ 0 hoặc giá âm → báo lỗi.

## UC10 – Ghi giá nhập theo lô
- Mỗi dòng nhập tạo lô mã `L-<mã hàng>-<YYMM>` (trùng thì thêm `-2`, `-3`…), lưu giá nhập quy về đơn vị cơ sở. Giá này dùng tính giá vốn khi bán.

## UC11 – Kiểm kê kho
- **Tác nhân:** Thủ kho. **Extend:** UC12.
- **Luồng chính:** (1) Tạo đợt: chọn kho và nhóm hàng → hệ thống lập danh sách với tồn sổ sách. (2) Nhập số đếm thực tế, ghi chú; có thể "Lưu tạm" nhiều lần. (3) "Chốt kiểm kê": hệ thống so số đếm với sổ sách **tại thời điểm chốt**.
- **Quy tắc:** dòng chưa nhập số đếm được bỏ qua; số đếm không được âm; đợt đã chốt không sửa được.

## UC12 – Ghi nhận chênh lệch
- Chỉ dòng có thực tế khác sổ sách. Thiếu → trừ tồn từ lô cũ nhất; thừa → cộng vào lô mới nhất (chưa có lô thì tạo lô theo giá nhập gần nhất). Ghi giá trị lệch; chủ xem ở báo cáo R6.

## UC13 – Quản lý khách hàng
- **Tác nhân:** NV bán hàng, Chủ.
- **Luồng chính:** tìm theo tên/SĐT/mã, lọc theo loại; thêm hoặc sửa: tên, SĐT, địa chỉ, loại (thầu/lẻ), hạn mức nợ, ghi chú. Mã khách tự sinh `KHnnn`.
- **Quy tắc:** khách đang còn nợ không chuyển được sang khách lẻ; khách lẻ có hạn mức 0.

## UC14 – Tra cứu công nợ khách
- **Tác nhân:** NV bán hàng, Chủ.
- **Luồng chính:** chọn khách thầu và khoảng ngày → hệ thống hiện nợ đầu kỳ, phát sinh, đã trừ/trả, còn nợ; sổ chi tiết từng chứng từ với số dư, phần còn nợ của từng phiếu, số ngày nợ. In bảng kê.
- **Tab "Danh sách khách đang nợ":** mọi khách còn nợ, nợ từ ngày nào, số ngày nợ (tô đỏ khi > 30 ngày).

## UC15 – Thu nợ cuối tháng
- **Include:** UC14.
- **Luồng chính:** từ màn hình tra cứu, bấm "Thu nợ khách này" → nhập số tiền (mặc định toàn bộ), hình thức, ghi chú → lưu phiếu `PT-…`.
- **Quy tắc:** số tiền > 0 và không vượt số nợ. Khoản thu trừ vào các phiếu nợ cũ nhất trước.

## UC16 – Quản lý hàng hóa
- **Tác nhân:** Chủ. **Include:** UC17.
- **Luồng chính:** tìm/lọc; thêm hoặc sửa mã, tên, nhóm, đơn vị cơ sở, tồn tối thiểu, trạng thái (đang bán / ngừng nhập).
- **Quy tắc:** mã hàng không trùng (tự viết hoa); không đổi đơn vị cơ sở khi hàng còn tồn; hàng ngừng nhập vẫn bán được phần còn tồn.

## UC17 – Khai báo đơn vị & hệ số quy đổi
- Bảng đơn vị của mặt hàng: tên đơn vị, hệ số (= bao nhiêu đơn vị cơ sở), giá bán, ghi chú dùng khi nào.
- **Quy tắc:** luôn có đơn vị cơ sở với hệ số 1; hệ số > 0; không trùng tên đơn vị.

## UC18 – Quản lý nhà cung cấp
- Thêm/sửa tên, người liên hệ, SĐT, địa chỉ, mã số thuế; xem lịch sử phiếu nhập; lập phiếu nhập nhanh cho nhà cung cấp đó.

## UC19 – Quản lý nhân viên
- Thêm/sửa họ tên, SĐT, tài khoản, vai trò, trạng thái; đặt lại mật khẩu.
- **Quy tắc:** tài khoản 3–30 ký tự (chữ thường, số, `_`, `.`), không trùng; mật khẩu tối thiểu 6 ký tự; khóa tài khoản hoặc đặt lại mật khẩu sẽ đăng xuất người đó; không tự khóa hoặc tự hạ quyền chính mình.

## UC20 – Xem báo cáo
- **Tác nhân:** Chủ. Chọn kỳ (tháng) với R1, R3, R6; chọn số ngày với R5; in được.

| Báo cáo | Nội dung |
|---|---|
| R1 Lãi lỗ | Doanh thu, hàng bị trả, giá vốn theo lô, lãi gộp; chi tiết theo nhóm hàng |
| R2 Công nợ | Khách còn nợ, số nợ, nợ từ ngày, số ngày nợ, hạn mức |
| R3 Doanh số nhân viên | Số phiếu, doanh số, hàng bị trả, doanh số thuần, tỉ lệ (để tính thưởng) |
| R4 Hàng sắp hết | Hàng đang bán có tồn ≤ tồn tối thiểu, nhà cung cấp gần nhất, nút lập phiếu nhập |
| R5 Hàng tồn lâu | Hàng còn tồn mà không bán trong 90/180/365 ngày, giá trị tồn, gợi ý ngừng nhập |
| R6 Chênh lệch kiểm kê | Các dòng lệch của đợt kiểm kê đã chốt trong kỳ, giá trị lệch |

## UC21 – Chuyển kho
- **Tác nhân:** Thủ kho. **Include:** UC01, UC04.
- **Luồng chính:** (1) Chọn kho nguồn, kho đích. (2) Chọn hàng theo lô (hiện tồn còn lại của lô), số lượng, đơn vị. (3) Lưu → số phiếu `PC-…`; trừ kho nguồn, cộng kho đích.
- **Quy tắc:** kho nguồn khác kho đích; không vượt tồn của lô; giữ nguyên mã lô, giá nhập và ngày lô.

## UC22 – Hủy phiếu bán
- **Tác nhân:** Chủ cửa hàng. **Màn hình:** W14 (`/ban-hang/[id]`).
- **Tiền điều kiện:** phiếu chưa bị hủy; chưa có phiếu trả hàng nào của phiếu này.
- **Luồng chính:** (1) Mở phiếu bán, bấm **Hủy phiếu**. (2) Nhập lý do (bắt buộc). (3) Hệ thống cộng lại hàng vào đúng các lô đã xuất; nếu phiếu ghi nợ thì bỏ khoản nợ của phiếu; đánh dấu phiếu "đã hủy" kèm thời điểm, người hủy, lý do; ghi nhật ký.
- **Luồng phụ:** đã có phiếu trả hàng → từ chối (tiếp tục dùng UC07); phiếu ghi nợ mà khách đã trả phần nợ đó (bỏ khoản nợ làm số dư âm) → từ chối, dùng trả hàng.
- **Hậu điều kiện:** phiếu vẫn xem được nhưng bị loại khỏi báo cáo, số liệu trang chính; không nhận trả hàng.

## UC23 – Hủy / sửa giá phiếu nhập
- **Tác nhân:** Chủ cửa hàng. **Màn hình:** W15 (`/kho/nhap/[id]`). Thủ kho chỉ xem.
- **Sửa giá nhập:** bấm **sửa** ở dòng hàng, nhập giá mới, xác nhận. Hệ thống đổi giá của lô (ở mọi kho, kể cả phần đã chuyển kho), tính lại tổng phiếu và **giá vốn của các phiếu bán / phiếu trả đã dùng lô** → báo cáo lãi lỗ cập nhật theo. Giá trị lệch của các đợt kiểm kê đã chốt không tính lại. Được sửa cả khi lô đã bán.
- **Hủy phiếu nhập:** bấm **Hủy phiếu**, nhập lý do. Chỉ được khi **chưa lô nào** của phiếu được bán, chuyển kho hoặc điều chỉnh kiểm kê; tồn các lô về 0; giá của phiếu hủy không dùng để gợi ý giá nhập.
- **Ghi chú:** nhập nhầm số lượng mà hàng đã bán → không hủy được; điều chỉnh bằng kiểm kê (UC11).
- Mọi lần sửa / hủy hiện ở **Lịch sử chỉnh sửa** của phiếu.

## UC24 – Ghi nợ đầu kỳ
- **Tác nhân:** Chủ cửa hàng. **Màn hình:** khối "Ghi nợ đầu kỳ" ở W09 (`/cong-no`).
- **Mục đích:** chuyển số nợ còn trong sổ công nợ cũ sang phần mềm khi bắt đầu sử dụng.
- **Luồng chính:** chọn khách thầu, nhập số nợ, **nợ từ ngày** (ngày bắt đầu nợ theo sổ cũ, để tính số ngày nợ), ghi chú → số chứng từ `NDK-…`. Có thể ghi nhiều khoản cho một khách.
- **Quy tắc:** chỉ khách thầu; chỉ khi khách **chưa có giao dịch công nợ nào khác** trên phần mềm (tránh phân bổ lại các khoản đã trả); ngày không sau hôm nay; số nợ > 0.
