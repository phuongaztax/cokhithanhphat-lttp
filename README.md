# Cơ khí Thành Phát – Phần mềm quản lý cửa hàng đồ cơ khí

Phân tích, thiết kế và xây dựng phần mềm quản lý cho một cửa hàng bán đồ cơ khí: bán hàng (khách lẻ trả ngay, khách thầu ghi nợ),
nhập hàng theo lô với giá nhập riêng, quy đổi đơn vị tính (con / kg / mét / cuộn…), kiểm kê, chuyển kho, công nợ và báo cáo.

| Thư mục / file | Nội dung |
|---|---|
| [docs/](docs/README.md) | Tài liệu dự án: đặc tả nghiệp vụ, đặc tả use case, kiến trúc, hướng dẫn sử dụng (có hình), cài đặt & vận hành |
| [usecase-cuahang-cokhi.puml](usecase-cuahang-cokhi.puml) | Sơ đồ use case UC00–UC24 (PlantUML) |
| [wireframe-cuahang-cokhi.drawio](wireframe-cuahang-cokhi.drawio) | Wireframe 16 màn hình W00–W15 (draw.io; bản PlantUML Salt: `wireframe-cuahang-cokhi.puml`) |
| [web/](web/README.md) | Ứng dụng Next.js 16 + SQLite |
| [tools/](tools/) | Script sinh wireframe draw.io |

## Chạy thử nhanh

```bash
cd web
npm install
npm run dev        # http://localhost:3000 – lần đầu tự tạo CSDL có dữ liệu mẫu
```

Tài khoản mẫu: `admin / admin123` (chủ cửa hàng), `nv_lan / 123456` (bán hàng), `tk_binh / 123456` (thủ kho).
Dùng thật: xem [docs/cai-dat-van-hanh.md](docs/cai-dat-van-hanh.md).
