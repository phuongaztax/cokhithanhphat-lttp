# Kiến trúc – Phần mềm quản lý cửa hàng đồ cơ khí

> Tài liệu sống: **mọi tính năng mới hoặc thay đổi nghiệp vụ đều phải cập nhật file này** (xem mục 9 và quy tắc trong `CLAUDE.md`).
> Nguồn yêu cầu: [dac-ta-nghiep-vu.md](dac-ta-nghiep-vu.md) · Use case: [../usecase-cuahang-cokhi.puml](../usecase-cuahang-cokhi.puml) · Wireframe: [../wireframe-cuahang-cokhi.drawio](../wireframe-cuahang-cokhi.drawio) · Mã nguồn: [../web/](../web/)

## 1. Tổng quan

Ứng dụng web nội bộ cho 1 cửa hàng (1 chủ, 2 nhân viên bán hàng, 1 thủ kho; 40–60 lượt khách/ngày), thay sổ công nợ và file Excel tồn kho.
Chạy trên 1 máy chủ trong cửa hàng, nhân viên truy cập bằng trình duyệt trong mạng LAN.

| Thành phần | Công nghệ | Ghi chú |
|---|---|---|
| Giao diện + máy chủ | Next.js 16 (App Router), React 19, TypeScript | Server Components đọc dữ liệu; Server Actions ghi dữ liệu |
| CSDL | SQLite qua `better-sqlite3` (đồng bộ) | 1 file `web/data/cuahang.db`, chế độ WAL |
| Xác thực | Phiên trong bảng `sessions` + cookie httpOnly | Mật khẩu băm `scrypt` (node:crypto) |
| Kiểm thử | `tsx` + `node:assert` | `npm test` chạy trên CSDL in-memory |

Không dùng ORM, không dùng thư viện UI – CSS thuần trong `app/globals.css`.
Tắt `cacheComponents` của Next 16 vì mọi trang đều phụ thuộc phiên đăng nhập và dữ liệu theo request.

## 2. Phân lớp

```
Trình duyệt
  │  (form / client component gọi Server Action)
  ▼
app/(app)/**/page.tsx        Server Component: requireUser(quyền) → gọi lib/services (đọc) → render
app/(app)/**/XxxForm.tsx     Client Component: trạng thái form, gọi action, hiển thị lỗi
app/actions.ts               Server Actions: guarded(quyền) → service → revalidatePath
  ▼
lib/services/*.ts            Nghiệp vụ thuần (nhận db, ném BizError) – không phụ thuộc Next
  ▼
lib/db-core.ts               Schema + openDb()        lib/db.ts  getDb() singleton (server-only)
  ▼
SQLite (data/cuahang.db)
```

Quy tắc phụ thuộc:
- `lib/services` **không** import từ `next/*` hay `app/*`; chỉ dùng `db-core` (kiểu), `util`, service khác → chạy được trong test.
- Kiểm tra quyền ở **cả hai** nơi: trang (`requireUser`) và action (`guarded`). Không tin dữ liệu từ client (giá, tồn…) – service tự tính lại.
- Mọi thao tác ghi nhiều bảng nằm trong `db.transaction(...)`; lỗi nghiệp vụ = `throw new BizError("thông điệp tiếng Việt")`, action trả `{ ok:false, error }`.

## 3. Mô hình dữ liệu

| Bảng | Vai trò | Ghi chú |
|---|---|---|
| `users`, `sessions` | Người dùng, phiên | `role ∈ {ban_hang, thu_kho, chu}` |
| `warehouses` | Kho | Kho chính, Kho phụ (quầy) |
| `products` | Hàng hóa | `base_unit`, `min_stock`, `status ∈ {dang_ban, ngung_nhap}` |
| `product_units` | Đơn vị & hệ số quy đổi (UC17) | `factor` = số đơn vị cơ sở trong 1 đơn vị; đơn vị cơ sở có `factor = 1`; giá bán theo từng đơn vị |
| `lots` | Lô tồn kho (UC10) | Theo (lô, kho); `cost_per_base` = giá nhập / đơn vị cơ sở; `qty_base` = tồn còn lại |
| `purchase_receipts`, `purchase_items` | Phiếu nhập | Mỗi dòng → 1 lô mới; `status ∈ {ok, huy}` + `cancelled_at/by`, `cancel_reason` (v1) |
| `sales`, `sale_items` | Phiếu bán | `payment_type ∈ {tien_mat, cong_no}`; `cost` = giá vốn dòng; `status ∈ {ok, huy}` + thông tin hủy (v1) |
| `sale_item_lots` | Phân bổ xuất kho theo lô | Dùng tính giá vốn và nhận lại đúng lô khi trả |
| `returns`, `return_items` | Phiếu trả hàng | `method ∈ {tru_no, hoan_tien}` |
| `return_item_lots` (v1) | Hàng trả nhận lại vào phân bổ lô nào | Để tính lại giá vốn hàng trả khi sửa giá nhập |
| `debt_entries` | Sổ công nợ | `doc_type ∈ {dau_ky, ban, tra, thu}`; `debit` (nợ đầu kỳ, bán ghi nợ) / `credit` (trả hàng, thu nợ) |
| `change_log` (v1) | Nhật ký hủy / sửa chứng từ | `action ∈ {huy_phieu_ban, huy_phieu_nhap, sua_gia_nhap, no_dau_ky}`, `doc_code`, `detail` |
| `payments` | Phiếu thu nợ | |
| `stocktakes`, `stocktake_items` | Kiểm kê | `status ∈ {nhap, chot}`; `diff_value` = giá trị lệch |
| `transfers`, `transfer_items` | Chuyển kho | Lưu lô nguồn và lô đích |

Mã chứng từ: `PB-` bán, `TH-` trả, `PT-` thu, `PN-` nhập, `PC-` chuyển, `KK-` kiểm kê, `NDK-` nợ đầu kỳ, dạng `XX-YYYYMMDD-NNN`. Lô: `L-<mã hàng>-<YYMM>[-n]`.
Tồn kho = `SUM(lots.qty_base)` – **không** có cột tồn riêng trên `products`.
Chứng từ đã hủy (`status = 'huy'`) vẫn giữ lại để tra cứu nhưng **bị loại khỏi mọi báo cáo, số liệu trang chính và gợi ý giá nhập**.

### Phiên bản CSDL & nâng cấp (migration)

- Schema gốc (phiên bản 0) nằm ở `web/lib/db-core.ts` (`SCHEMA`) – **không sửa**.
- Mọi thay đổi schema = thêm một bước mới vào cuối mảng `MIGRATIONS` trong `web/lib/migrations.ts`; phiên bản lưu ở `PRAGMA user_version`.
  `openDb()` luôn chạy: schema gốc → các bước còn thiếu (mỗi bước một transaction) → khởi tạo dữ liệu nếu CSDL chưa có người dùng.
  CSDL mới và CSDL cũ đi qua cùng một đường nên luôn giống nhau.
- Nâng cấp CSDL đang dùng: tự động khi ứng dụng mở CSDL, hoặc chạy tay `npm run db:nang-cap` (nên sao lưu trước).
- Bước có dữ liệu cần suy ra phải tự dựng lại (ví dụ v1 phát lại các phiếu trả cũ để tạo `return_item_lots`).

| Phiên bản | Nội dung |
|---|---|
| 0 | Schema gốc 17 bảng |
| 1 | Hủy phiếu bán / phiếu nhập (`status`, thông tin hủy); `return_item_lots` (dựng lại từ dữ liệu cũ); `debt_entries.doc_type` thêm `dau_ky` (dựng lại bảng); `change_log` |

## 4. Quy tắc nghiệp vụ (cài đặt trong `lib/services`)

| Use case | Quy tắc | Hàm |
|---|---|---|
| UC04/UC17 | Quy đổi về đơn vị cơ sở bằng `factor`; đơn vị cơ sở bắt buộc, hệ số 1, không trùng | `inventory.getUnit`, `master.saveProduct` |
| UC03 | Xuất kho **FIFO** theo lô (`created_at` tăng dần); không đủ tồn → lỗi, không ghi gì | `inventory.consumeFIFO`, `sales.createSale` |
| UC05/UC06 | Khách lẻ trả ngay; chỉ khách thầu ghi nợ → `debt_entries.debit` | `sales.createSale` |
| UC07/UC08 | Chỉ nhận hàng còn nguyên, ≤ số đã mua − đã trả; cộng lại đúng lô; tiền trả = SL × giá × (tổng/tạm tính); thầu → trừ nợ, lẻ → hoàn tiền | `sales.createReturn` |
| UC09/UC10 | Mỗi dòng nhập → 1 lô giữ giá nhập; hàng `ngung_nhap` không nhập được | `warehouse.createPurchase` |
| UC11/UC12 | Chốt so với sổ sách **tại lúc chốt**; chỉ dòng lệch ghi nhận; thiếu trừ FIFO, thừa cộng lô mới nhất | `warehouse.closeStocktake` |
| UC14/UC15 | Khoản giảm nợ trừ vào phiếu nợ cũ nhất trước; không thu vượt nợ | `debt.outstandingDebits`, `debt.createPayment` |
| UC21 | Kho nguồn ≠ đích; không vượt tồn lô; giữ mã lô, giá nhập, ngày lô | `warehouse.createTransfer` |
| UC20 | R1 lãi = doanh thu − hàng trả − (giá vốn bán − giá vốn hàng trả); R4 tồn ≤ tối thiểu; R5 không bán ≥ N ngày; chỉ tính chứng từ `status = 'ok'` | `reports.*` |
| UC22 | Hủy phiếu bán: bắt buộc lý do; không hủy nếu đã có phiếu trả hoặc khách đã trả phần nợ của phiếu (bỏ khoản nợ làm số dư âm); hoàn tồn đúng lô; xóa khoản nợ của phiếu; phiếu bị hủy không nhận trả hàng | `sales.cancelSale` |
| UC23 | Hủy phiếu nhập: chỉ khi chưa lô nào được bán / chuyển kho / điều chỉnh kiểm kê, tồn lô về 0. Sửa giá nhập: được cả khi lô đã bán – đổi giá lô ở mọi kho (cùng mã lô), tính lại giá vốn `sale_items`, `return_items`, `returns`; **không** tính lại `stocktake_items.diff_value` | `warehouse.cancelPurchase`, `warehouse.updatePurchasePrice` |
| UC24 | Nợ đầu kỳ: chỉ khách thầu **chưa có giao dịch công nợ nào khác** (tránh phân bổ lại các khoản đã trả); ngày ≤ hôm nay; được ghi nhiều khoản | `debt.createOpeningDebt` |
| – | Mọi lần hủy / sửa ghi vào `change_log` | |

## 5. Phân quyền

Định nghĩa ở `web/lib/auth.ts` (`ACCESS`, `can`). Chủ cửa hàng vào được mọi chức năng.

| Nhóm | Use case | Vai trò |
|---|---|---|
| `traCuu` | UC01 | NV bán hàng, Thủ kho |
| `banHang` | UC02, UC03, UC07 | NV bán hàng |
| `kho` | UC09, UC11, UC21 | Thủ kho |
| `congNo` | UC13, UC14, UC15 | NV bán hàng |
| `quanTri` | UC16, UC18, UC19, UC20, UC22, UC23, UC24 | Chủ cửa hàng |

## 6. Màn hình ↔ route ↔ use case

| Wireframe | Route | Use case |
|---|---|---|
| W00 | `/login` | UC00 |
| W01 | `/` | – |
| W02 | `/tra-cuu` | UC01, UC02 |
| W03 | `/ban-hang`, `/ban-hang/danh-sach` | UC03–UC06 |
| W04 | `/tra-hang` | UC07, UC08 |
| W05 | `/kho/nhap` | UC09, UC10 |
| W06 | `/kho/kiem-ke`, `/kho/kiem-ke/[id]` | UC11, UC12 |
| W07 | `/kho/chuyen-kho` | UC21 |
| W08 | `/khach-hang` | UC13 |
| W09 | `/cong-no` (khối Ghi nợ đầu kỳ – UC24, chỉ chủ thấy) | UC14, UC15, UC24 |
| W10 | `/quan-tri/hang-hoa` | UC16, UC17 |
| W11 | `/quan-tri/nha-cung-cap` | UC18 |
| W12 | `/quan-tri/nhan-vien` | UC19 |
| W13 | `/bao-cao?tab=lai-lo\|cong-no\|doanh-so\|sap-het\|ton-lau\|kiem-ke` | UC20 (R1–R6) |
| W14 | `/ban-hang/[id]` – xem / in phiếu bán, nút Hủy phiếu (chủ) | UC22 |
| W15 | `/kho/nhap/[id]` – xem / in phiếu nhập, sửa giá, hủy phiếu, lịch sử chỉnh sửa (chủ) | UC23 |

## 7. Kiểm thử & dữ liệu mẫu

- `npm test` → `web/scripts/test-nghiep-vu.ts`: mở CSDL `:memory:` có dữ liệu mẫu, kiểm tra từng quy tắc ở mục 4.
- Dữ liệu mẫu `web/lib/seed.ts` được tạo **bằng chính các hàm nghiệp vụ** (không INSERT tay) để luôn nhất quán; ngày tính lùi từ hôm nay.
- `npm run reset-db` xóa `web/data/`, lần chạy sau tạo lại dữ liệu mẫu.
- Khởi tạo: `npm run db:mau` (dữ liệu mẫu) / `npm run db:trong -- --pass <mk>` (CSDL trống: admin, 2 kho, khách lẻ – `seed.seedEmpty`);
  thêm `--force` để thay CSDL đang có (file cũ được đổi tên `*.saoluu-<thời điểm>`, không xóa). Script: `web/scripts/init-db.ts`.
- Kiểm thử có kiểm tra nâng cấp từ CSDL phiên bản 0 có dữ liệu (`migrate`) và CSDL trống.
- Hình cho `docs/huong-dan-su-dung.md`: `npm run docs:chup` (`web/scripts/chup-man-hinh.mjs`, điều khiển Edge/Chrome qua DevTools Protocol) – chạy trên server + CSDL mẫu riêng (xem `docs/cai-dat-van-hanh.md` mục 8). Đổi giao diện / luồng màn hình → chụp lại.

## 8. Vận hành

- Dev: `cd web && npm run dev` (cổng 3000). Production: `npm run build && npm start`.
- Biến môi trường: `DB_FILE` (đường dẫn CSDL), `DB_INIT=trong` (CSDL mới tự tạo sẽ trống thay vì có dữ liệu mẫu),
  `ADMIN_PASSWORD` (mật khẩu admin khi tạo CSDL trống, mặc định `admin123`), `HTTPS=1` (bật cookie `secure` khi chạy sau HTTPS).
- Sao lưu: chép file `data/cuahang.db` (kèm `-wal`, `-shm` nếu đang chạy) hoặc dùng `sqlite3 .backup`.

## 9. Nhật ký thay đổi kiến trúc

Ghi **mới nhất lên đầu**. Mỗi mục: ngày · tính năng · thay đổi (bảng / service / route / quyền) · use case liên quan.

| Ngày | Tính năng | Thay đổi | Use case |
|---|---|---|---|
| 2026-11-21 | Hướng dẫn sử dụng có hình; sửa thông báo chốt kiểm kê | Script chụp màn hình `scripts/chup-man-hinh.mjs` (`npm run docs:chup`), 40 hình ở `docs/hinh/`. Sửa lỗi: sau khi chốt kiểm kê, thông báo kết quả bị mất do phiếu được dựng lại → `/kho/kiem-ke/[id]?lech=&gt=` hiển thị kết quả. Menu thả xuống tăng độ đục (giao diện). | UC11, UC12 |
| 2026-11-21 | Bổ sung phần thiếu: nâng cấp CSDL, CSDL trống, hủy / sửa chứng từ, nợ đầu kỳ | CSDL v1 (`lib/migrations.ts`, `PRAGMA user_version`): cột `status`/hủy ở `sales`, `purchase_receipts`; bảng `return_item_lots`, `change_log`; `debt_entries.doc_type` + `dau_ky`. Service: `sales.cancelSale`, `warehouse.cancelPurchase/updatePurchasePrice/getPurchase`, `debt.createOpeningDebt`, `seed.seedEmpty`; `createReturn` ghi `return_item_lots`; báo cáo loại chứng từ hủy. Route mới `/kho/nhap/[id]`; nút hủy ở `/ban-hang/[id]`; khối nợ đầu kỳ ở `/cong-no`. Quyền `quanTri` thêm UC22–UC24. Script `init-db.ts` (`db:trong`, `db:mau`, `db:nang-cap`), biến `DB_INIT`, `ADMIN_PASSWORD`. Kiểm thử 17 → 24 | UC22, UC23, UC24 |
| 2026-11-21 | Khởi tạo ứng dụng | Next.js 16 + SQLite; 17 bảng; services inventory/sales/debt/warehouse/master/reports; 14 màn hình W00–W13; phân quyền theo vai trò; 17 kiểm thử nghiệp vụ | UC00–UC21 |
