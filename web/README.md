# Cửa hàng cơ khí – Next.js + SQLite

Phần mềm quản lý bán hàng, kho, công nợ cho cửa hàng đồ cơ khí, triển khai từ
[đặc tả nghiệp vụ](../docs/dac-ta-nghiep-vu.md), [sơ đồ use case](../usecase-cuahang-cokhi.puml)
và [wireframe](../wireframe-cuahang-cokhi.drawio).

- **Next.js 16** (App Router, Server Components, Server Actions), TypeScript
- **SQLite** qua `better-sqlite3` – file `data/cuahang.db`, tự tạo kèm dữ liệu mẫu khi chạy lần đầu

## Chạy

```bash
npm install
npm run dev          # http://localhost:3000
# hoặc bản production
npm run build && npm start
```

| Tài khoản | Mật khẩu | Vai trò |
|---|---|---|
| `admin` | `admin123` | Chủ cửa hàng (vào được mọi màn hình) |
| `nv_lan`, `nv_mai` | `123456` | Nhân viên bán hàng |
| `tk_binh` | `123456` | Thủ kho |

Lệnh khác:

```bash
npm test                                  # kiểm thử nghiệp vụ trên CSDL tạm trong bộ nhớ
npm run db:trong -- --pass <mk> [--force]  # CSDL trống để dùng thật (admin + 2 kho + khách lẻ)
npm run db:mau [-- --force]                # CSDL dữ liệu mẫu
npm run db:nang-cap                        # nâng cấp CSDL hiện có lên phiên bản mới nhất
npm run reset-db                          # xóa data/, lần chạy sau tạo lại dữ liệu mẫu
```

Biến môi trường: `DB_FILE` (vị trí CSDL), `DB_INIT=trong` (CSDL tự tạo sẽ trống), `ADMIN_PASSWORD`.

## Màn hình ↔ use case

| Màn hình | Đường dẫn | Use case | Vai trò |
|---|---|---|---|
| W00 Đăng nhập | `/login` | UC00 | tất cả |
| W01 Trang chính | `/` | – | tất cả (menu theo vai trò) |
| W02 Tra cứu & báo giá | `/tra-cuu` | UC01, UC02 | NV bán hàng; thủ kho chỉ tra cứu |
| W03 Lập phiếu bán | `/ban-hang`, `/ban-hang/[id]`, `/ban-hang/danh-sach` | UC03–UC06 | NV bán hàng |
| W04 Khách trả hàng | `/tra-hang` | UC07, UC08 | NV bán hàng |
| W05 Phiếu nhập | `/kho/nhap` | UC09, UC10, UC04 | Thủ kho |
| W06 Kiểm kê | `/kho/kiem-ke`, `/kho/kiem-ke/[id]` | UC11, UC12 | Thủ kho |
| W07 Chuyển kho | `/kho/chuyen-kho` | UC21 | Thủ kho |
| W08 Khách hàng | `/khach-hang` | UC13 | NV bán hàng |
| W09 Công nợ & thu nợ | `/cong-no` | UC14, UC15 | NV bán hàng |
| W10 Hàng hóa & ĐVT | `/quan-tri/hang-hoa` | UC16, UC17 | Chủ |
| W11 Nhà cung cấp | `/quan-tri/nha-cung-cap` | UC18 | Chủ |
| W12 Nhân viên | `/quan-tri/nhan-vien` | UC19 | Chủ |
| W13 Báo cáo R1–R6 | `/bao-cao?tab=…` | UC20 | Chủ |
| W14 Chi tiết / hủy phiếu bán | `/ban-hang/[id]` | UC22 | Chủ hủy; NV xem |
| W15 Chi tiết / sửa giá / hủy phiếu nhập | `/kho/nhap/[id]` | UC23 | Chủ sửa, hủy; Thủ kho xem |
| (W09) Ghi nợ đầu kỳ | `/cong-no` | UC24 | Chủ |

## Quy tắc nghiệp vụ chính

- **Đơn vị tính (UC04, UC17):** mỗi hàng có một đơn vị cơ sở (hệ số 1) và các đơn vị quy đổi
  (VD ốc: con = 1, kg = 80, hộp = 500; dây điện: mét = 1, cuộn = 100). Tồn kho luôn lưu theo đơn vị cơ sở;
  mỗi đơn vị có giá bán riêng.
- **Lô & giá nhập (UC10):** mỗi dòng phiếu nhập tạo một lô giữ giá nhập riêng. Bán hàng xuất kho theo
  **FIFO** (lô cũ trước) và ghi lại lô đã dùng → giá vốn chính xác cho báo cáo lãi lỗ.
- **Thanh toán (UC05/UC06):** khách lẻ trả ngay; chỉ khách thầu được ghi nợ (lưu số tiền + ngày theo phiếu,
  cảnh báo khi vượt hạn mức).
- **Trả hàng (UC07/UC08):** chỉ nhận hàng còn nguyên, không vượt số đã mua; cộng lại đúng lô đã xuất;
  khách thầu trừ công nợ, khách lẻ hoàn tiền.
- **Thu nợ (UC15):** không thu vượt số nợ; khoản giảm nợ được trừ vào phiếu nợ cũ nhất trước (để tính “nợ từ ngày”).
- **Kiểm kê (UC11/UC12):** đếm thực tế, khi chốt so với sổ sách tại thời điểm chốt; chỉ dòng lệch được ghi nhận,
  thiếu thì trừ lô cũ nhất, thừa thì cộng lô mới nhất; chênh lệch hiện ở báo cáo R6 cho chủ cửa hàng.
- **Chuyển kho (UC21):** trừ kho nguồn, cộng kho đích, giữ nguyên mã lô và giá nhập; không vượt tồn của lô.
- **Hủy / sửa chứng từ (UC22, UC23 – chủ):** hủy phiếu bán khi chưa có trả hàng và khách chưa trả phần nợ đó; hủy phiếu nhập khi lô chưa dùng;
  sửa giá nhập tính lại giá vốn các phiếu bán / trả đã dùng lô. Chứng từ hủy bị loại khỏi báo cáo; mọi lần sửa / hủy ghi `change_log`.
- **Nợ đầu kỳ (UC24 – chủ):** chỉ cho khách thầu chưa có giao dịch công nợ trên phần mềm.

## Cấu trúc

```
app/
  actions.ts              Server Actions (kiểm tra đăng nhập + quyền, gọi lib/services)
  login/                  W00
  (app)/                  các màn hình sau đăng nhập (layout có menu theo vai trò)
components/               ProductPicker, PrintButton
lib/
  db-core.ts              schema gốc + openDb() (dùng được cả ngoài Next, cho test và script)
  migrations.ts           các bước nâng cấp CSDL theo phiên bản (PRAGMA user_version)
  db.ts                   getDb() dùng trong server
  auth.ts                 phiên đăng nhập (cookie httpOnly + bảng sessions), phân quyền
  seed.ts                 dữ liệu mẫu (tạo bằng chính các hàm nghiệp vụ)
  services/               nghiệp vụ: inventory, sales, debt, warehouse, master, reports
scripts/test-nghiep-vu.ts kiểm thử nghiệp vụ
scripts/init-db.ts        khởi tạo CSDL trống / mẫu, nâng cấp CSDL
```

> Lưu ý: dự án tắt `cacheComponents` của Next 16 vì mọi trang đều đọc phiên đăng nhập và CSDL theo từng request.
