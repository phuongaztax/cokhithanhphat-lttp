# Tài liệu dự án – Phần mềm quản lý cửa hàng đồ cơ khí

## 1. Giới thiệu

Cửa hàng bán đồ cơ khí có 1 chủ, 2 nhân viên bán hàng và 1 thủ kho, phục vụ 40–60 lượt khách mỗi ngày.
Trước đây cửa hàng ghi công nợ vào sổ tay và theo dõi tồn kho bằng một file Excel. Dự án xây dựng phần mềm
thay thế hai công cụ này, chạy trên trình duyệt trong mạng nội bộ của cửa hàng.

### Vấn đề cần giải quyết (theo lời chủ cửa hàng)

| Vấn đề | Cách phần mềm giải quyết |
|---|---|
| Phải tra xem còn hàng không rồi báo giá | Tra cứu tồn kho & giá theo từng đơn vị, lập phiếu báo giá rồi chuyển thành phiếu bán |
| Khách thầu lấy hàng cả tháng, cuối tháng mới trả | Ghi công nợ theo từng phiếu, biết ai nợ bao nhiêu, nợ từ ngày nào; thu nợ một lần hoặc nhiều lần |
| Giá nhập mỗi đợt một khác, phải nhớ lô nào giá bao nhiêu | Mỗi lần nhập tạo một lô giữ giá nhập riêng; khi bán tự lấy lô cũ trước để tính giá vốn |
| Cùng một món tính theo con, theo ký hoặc theo mét | Mỗi mặt hàng khai báo nhiều đơn vị tính với hệ số quy đổi và giá bán riêng |
| Cần biết món nào sắp hết, món nào nằm kho cả năm | Báo cáo hàng sắp hết (dưới tồn tối thiểu) và hàng tồn lâu không bán |
| Cuối tháng muốn biết lãi, ai còn nợ, nhân viên nào bán giỏi | Báo cáo lãi lỗ, công nợ, doanh số theo nhân viên |
| Khách trả lại hàng còn nguyên | Phiếu trả hàng: nhận lại vào kho, trừ công nợ hoặc hoàn tiền |
| Kiểm kê xem sổ sách và thực tế có khớp không | Đợt kiểm kê: nhập số đếm, chốt để ghi nhận chênh lệch và báo cho chủ |
| (bổ sung) Chuyển hàng giữa các kho | Phiếu chuyển kho giữ nguyên lô và giá nhập |
| (bổ sung) Lập nhầm phiếu, nhập nhầm giá | Chủ cửa hàng hủy phiếu bán, hủy phiếu nhập chưa dùng, sửa giá nhập (giá vốn tự tính lại); mọi lần sửa / hủy đều có nhật ký |
| (bổ sung) Chuyển từ sổ tay sang phần mềm | Khởi tạo CSDL trống; nhập tồn đầu kỳ bằng phiếu nhập; ghi nợ đầu kỳ cho khách thầu |

### Phạm vi

- **Trong phạm vi:** bán hàng, trả hàng, báo giá, công nợ khách hàng (kể cả nợ đầu kỳ), nhập hàng, kiểm kê, chuyển kho,
  hủy / sửa chứng từ, danh mục (hàng hóa, khách hàng, nhà cung cấp, nhân viên), 6 báo cáo.
- **Ngoài phạm vi (phiên bản hiện tại):** công nợ với nhà cung cấp, hóa đơn điện tử, thanh toán trực tuyến,
  nhiều chi nhánh, ứng dụng di động, tính lương/thưởng tự động.

## 2. Tác nhân

| Tác nhân | Công việc trên hệ thống |
|---|---|
| Nhân viên bán hàng | Tra cứu, báo giá, lập phiếu bán, xử lý trả hàng, quản lý khách hàng, tra cứu và thu công nợ |
| Thủ kho | Tra cứu tồn kho, lập phiếu nhập, kiểm kê, chuyển kho |
| Chủ cửa hàng | Toàn quyền; riêng quản lý hàng hóa, nhà cung cấp, nhân viên, xem báo cáo, hủy / sửa chứng từ và ghi nợ đầu kỳ chỉ chủ làm được |

Khách hàng và nhà cung cấp **không** thao tác trực tiếp trên hệ thống.

## 3. Danh mục tài liệu

| Tài liệu | Nội dung | Dành cho |
|---|---|---|
| [dac-ta-nghiep-vu.md](dac-ta-nghiep-vu.md) | Đặc tả gốc – lời mô tả của chủ cửa hàng | Cả nhóm |
| [dac-ta-use-case.md](dac-ta-use-case.md) | Đặc tả chi tiết 25 use case UC00–UC24: luồng chính, luồng phụ, ràng buộc | Phân tích, phát triển, kiểm thử |
| [kien-truc.md](kien-truc.md) | Công nghệ, phân lớp, mô hình dữ liệu, quy tắc nghiệp vụ, phân quyền, nhật ký thay đổi | Phát triển |
| [huong-dan-su-dung.md](huong-dan-su-dung.md) | Hướng dẫn từng bước theo vai trò, 40 hình chụp có đánh số (thư mục `hinh/`) | Nhân viên cửa hàng |
| [cai-dat-van-hanh.md](cai-dat-van-hanh.md) | Cài đặt, chạy, sao lưu, khắc phục sự cố | Người cài đặt / quản trị |
| [../usecase-cuahang-cokhi.puml](../usecase-cuahang-cokhi.puml) | Sơ đồ use case (PlantUML, 5 sơ đồ) | Phân tích |
| [../wireframe-cuahang-cokhi.drawio](../wireframe-cuahang-cokhi.drawio) | Wireframe 16 màn hình W00–W15 (draw.io; bản PlantUML Salt: `../wireframe-cuahang-cokhi.puml`) | Thiết kế, phát triển |
| [../web/README.md](../web/README.md) | Hướng dẫn nhanh cho mã nguồn | Phát triển |

## 4. Tiến trình thực hiện

| Giai đoạn | Sản phẩm | Trạng thái |
|---|---|---|
| 1. Thu thập yêu cầu | Đặc tả nghiệp vụ | Xong |
| 2. Phân tích | Sơ đồ use case (UC00–UC24) | Xong |
| 3. Thiết kế giao diện | Wireframe W00–W15 (PlantUML Salt, draw.io) | Xong |
| 4. Xây dựng | Ứng dụng Next.js 16 + SQLite, đủ 16 màn hình | Xong |
| 4b. Bổ sung | Nâng cấp CSDL theo phiên bản, CSDL trống, hủy / sửa chứng từ, nợ đầu kỳ (UC22–UC24) | Xong |
| 5. Kiểm thử | 24 kiểm thử nghiệp vụ tự động (kể cả nâng cấp CSDL); chạy thử trên trình duyệt: bán – trả – thu nợ, hủy phiếu, sửa giá nhập, nợ đầu kỳ | Xong |
| 6. Tiếp theo (đề xuất) | Sơ đồ activity / class / sequence; công nợ nhà cung cấp; nút sao lưu trong phần mềm; quản lý danh sách kho | Chưa làm |

## 5. Thuật ngữ

| Thuật ngữ | Nghĩa |
|---|---|
| Khách lẻ | Khách vãng lai, trả tiền ngay khi mua |
| Khách thầu | Khách quen (thầu xây dựng) được ghi nợ, thanh toán cuối tháng |
| Đơn vị cơ sở | Đơn vị nhỏ nhất dùng để lưu tồn kho (con, mét, cái…), hệ số = 1 |
| Hệ số quy đổi | Số đơn vị cơ sở trong 1 đơn vị khác (1 kg ốc = 80 con) |
| Lô | Một đợt nhập của một mặt hàng, giữ giá nhập riêng |
| FIFO | Nhập trước – xuất trước: khi bán lấy hàng từ lô cũ nhất trước |
| Giá vốn | Giá nhập của số hàng đã bán, tính theo lô đã xuất |
| Tồn tối thiểu | Mức tồn mà dưới đó cần đặt thêm hàng |
| Hạn mức nợ | Số nợ tối đa cho phép của khách thầu (0 = không giới hạn) |
