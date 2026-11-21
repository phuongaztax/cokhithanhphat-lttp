# Buổi 2 – Phân tích hệ thống quản lý cửa hàng đồ cơ khí

Bài tập phân tích yêu cầu: vẽ sơ đồ UML (use case, sau đó có thể là activity, class, sequence) bằng PlantUML cho phần mềm quản lý một cửa hàng bán đồ cơ khí.

## Tài liệu
- Mục lục tài liệu dự án: [docs/README.md](docs/README.md) – kèm đặc tả use case, hướng dẫn sử dụng, cài đặt & vận hành. Khi thay đổi chức năng, cập nhật luôn các tài liệu này nếu bị ảnh hưởng.
- Đặc tả nghiệp vụ gốc: [docs/dac-ta-nghiep-vu.md](docs/dac-ta-nghiep-vu.md). Mọi sơ đồ phải bám sát tài liệu này.
- Kiến trúc ứng dụng: [docs/kien-truc.md](docs/kien-truc.md) – công nghệ, phân lớp, mô hình dữ liệu, quy tắc nghiệp vụ, phân quyền, route, nhật ký thay đổi.
- Sơ đồ use case: [usecase-cuahang-cokhi.puml](usecase-cuahang-cokhi.puml) (5 khối: tổng quát, bán hàng, kho, công nợ, quản trị & báo cáo).
- Wireframe màn hình: [wireframe-cuahang-cokhi.puml](wireframe-cuahang-cokhi.puml) (PlantUML Salt, khối `@startsalt W00..W15`; bảng ánh xạ màn hình → use case ở đầu file). Mỗi hàng nhiều cột ở cấp ngoài cùng bọc trong `{ ... }` riêng để các cột không bị căn theo nhau.
- Wireframe draw.io: [wireframe-cuahang-cokhi.drawio](wireframe-cuahang-cokhi.drawio) (trang "00 Mục lục" + W00..W15, cùng nội dung bản Salt). File được **sinh** từ [tools/gen_drawio_wireframe.py](tools/gen_drawio_wireframe.py): sửa hàm `screen_Wxx` rồi chạy `python tools/gen_drawio_wireframe.py` (ghi đè file .drawio, kèm ảnh xem nhanh SVG ở `out/drawio-preview/`).

- Ứng dụng: [web/](web/) – Next.js 16 + SQLite (better-sqlite3), triển khai đủ W00–W15 (UC00–UC24). Xem [web/README.md](web/README.md).
  Nghiệp vụ nằm ở `web/lib/services/`, mọi thay đổi nghiệp vụ phải kèm cập nhật `web/scripts/test-nghiep-vu.ts` (`npm test`).
  Next 16 khác bản cũ: đọc `web/node_modules/next/dist/docs/` trước khi dùng API mới.
  Đổi schema CSDL: KHÔNG sửa `SCHEMA` trong `web/lib/db-core.ts`; thêm bước mới vào cuối `web/lib/migrations.ts` + kiểm thử nâng cấp.

## Quy tắc khi phát triển tính năng (bắt buộc)
Mọi tính năng mới, sửa nghiệp vụ, đổi schema, thêm route hoặc đổi phân quyền trong `web/` đều phải cập nhật [docs/kien-truc.md](docs/kien-truc.md) **trong cùng lần thay đổi**, trước khi báo hoàn thành:
1. Thêm một dòng vào **mục 9 – Nhật ký thay đổi kiến trúc** (mới nhất lên đầu): ngày · tính năng · thay đổi · use case.
2. Cập nhật các mục bị ảnh hưởng:
   - bảng / cột mới → mục 3 (kèm cách nâng cấp CSDL cũ: `ALTER TABLE` hoặc `npm run reset-db`);
   - quy tắc nghiệp vụ / hàm service → mục 4;
   - vai trò, quyền → mục 5; màn hình / route → mục 6;
   - kiểm thử, dữ liệu mẫu → mục 7; cấu hình, biến môi trường, vận hành → mục 8.
3. Nếu thêm use case mới: cập nhật cả sơ đồ use case (mã tiếp theo) và wireframe tương ứng.
4. Báo lại cho người dùng những mục đã sửa trong `docs/kien-truc.md`.

Thay đổi chỉ về giao diện (CSS, chữ hiển thị) không đổi hành vi thì không bắt buộc ghi nhật ký.

## Quy ước
- Ngôn ngữ: tiếng Việt có dấu cho tên use case, tác nhân, ghi chú.
- Mã use case dạng `UC01`, `UC02`…; không đánh lại mã đã có, use case mới lấy số tiếp theo (hiện tại đến `UC24`).
- Mỗi sơ đồ là một khối `@startuml <tên>` riêng trong file `.puml`.
- Tác nhân: Nhân viên bán hàng, Thủ kho, Chủ cửa hàng (đều kế thừa Người dùng). Khách hàng và nhà cung cấp không thao tác trực tiếp trên hệ thống.

## Công cụ
- Xem sơ đồ: extension PlantUML (jebbs) trong VS Code, Alt+D.
- Máy có Java, chưa có Graphviz → nếu lỗi layout, cài `winget install graphviz` hoặc thêm `!pragma layout smetana`.
