# Đặc tả nghiệp vụ – Cửa hàng đồ cơ khí

## Hiện trạng
- Nhân sự: 1 chủ cửa hàng, 2 nhân viên bán hàng, 1 thủ kho.
- Công cụ đang dùng: 1 sổ công nợ, 1 file Excel tồn kho.
- Lưu lượng: 40–60 lượt khách mỗi ngày.

## Mô tả của chủ cửa hàng
Khách tới hỏi món gì, nhân viên tra xem còn hàng không rồi báo giá, khách đồng ý thì lấy hàng và viết phiếu bán. Khách lẻ trả tiền ngay; mấy ông thầu xây dựng thì lấy hàng suốt tháng, cuối tháng mới thanh toán một lần, nên tôi phải ghi công nợ từng người, ai nợ bao nhiêu, nợ từ hôm nào.

Hàng nhập về từ nhiều nhà cung cấp khác nhau, mỗi lần nhập viết một phiếu nhập, mà giá nhập mỗi đợt một khác nên tôi phải nhớ lô nào giá bao nhiêu.

Rắc rối nhất là đơn vị tính: cùng một thứ ốc vít, bán lẻ thì tính theo con, bán sỉ thì cân ký, dây điện thì tính mét.

Tôi cần biết món nào sắp hết để còn đặt thêm, món nào nằm kho cả năm không ai mua để ngừng nhập. Cuối tháng tôi muốn biết lãi được bao nhiêu, ai còn nợ tôi, và nhân viên nào bán được nhiều nhất vì tôi có thưởng theo doanh số.

Khách trả lại hàng cũng có, hàng còn nguyên thì tôi nhận lại rồi trừ vào công nợ.

Thỉnh thoảng người giữ kho phải kiểm kê lại xem sổ sách với hàng thực tế có khớp không, lệch thì ghi vô cho tôi biết.

## Bổ sung sau
- Thủ kho có nghiệp vụ chuyển kho (UC21).
- Chủ cửa hàng hủy phiếu bán lập nhầm (UC22), hủy hoặc sửa giá phiếu nhập nhập nhầm (UC23), và chuyển số nợ còn trong sổ công nợ cũ sang phần mềm khi bắt đầu sử dụng (UC24 – ghi nợ đầu kỳ).
