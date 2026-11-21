# Cài đặt và vận hành

## 1. Yêu cầu

| Thành phần | Yêu cầu |
|---|---|
| Máy chủ | Một máy tính trong cửa hàng chạy Windows 10/11, macOS hoặc Linux; bật liên tục trong giờ bán hàng |
| Node.js | Bản 20 trở lên (đã thử với Node 24) – tải tại nodejs.org |
| Máy nhân viên | Trình duyệt Chrome / Edge, cùng mạng LAN với máy chủ |
| Máy in | In từ trình duyệt (Ctrl+P) |

Không cần cài máy chủ CSDL: dữ liệu nằm trong một file SQLite.

## 2. Cài đặt lần đầu

```bash
cd web
npm install          # cài thư viện (cần Internet lần đầu)
npm run build        # biên dịch bản chạy thật
npm start            # chạy ở cổng 3000
```

- Mở `http://localhost:3000` trên máy chủ, hoặc `http://<IP máy chủ>:3000` trên máy nhân viên (IP hiện ở dòng `Network:` khi chạy).
- Lần đầu chạy, hệ thống tạo file `web/data/cuahang.db` kèm **dữ liệu mẫu** và các tài khoản:

  | Tài khoản | Mật khẩu | Vai trò |
  |---|---|---|
  | `admin` | `admin123` | Chủ cửa hàng |
  | `nv_lan`, `nv_mai` | `123456` | Nhân viên bán hàng |
  | `tk_binh` | `123456` | Thủ kho |

- Windows có thể hỏi cho phép Node.js qua tường lửa – chọn **Private network** để máy khác trong LAN truy cập được.

## 3. Đưa vào sử dụng thật

Dữ liệu mẫu chỉ để thử. Khi dùng thật, tạo **CSDL trống**:

```bash
cd web
npm run db:trong -- --pass <mật khẩu admin> --force   # --force: thay CSDL mẫu đang có (file cũ được đổi tên làm bản sao lưu, không xóa)
npm start
```

CSDL trống chỉ có: tài khoản `admin` (chủ cửa hàng), 2 kho (Kho chính, Kho phụ), khách "Khách lẻ". Sau đó:

1. Đăng nhập `admin`, vào *Quản trị → Nhân viên*: sửa tên chủ, thêm tài khoản nhân viên và thủ kho.
2. Khai báo hàng hóa và đơn vị quy đổi, nhà cung cấp, khách thầu (kèm hạn mức).
3. Nhập **tồn đầu kỳ** bằng phiếu nhập (có thể tạo nhà cung cấp "Tồn đầu kỳ"; giá nhập = giá vốn hiện tại). Nhập sai thì chủ cửa hàng hủy / sửa giá phiếu.
4. Ghi **nợ đầu kỳ** cho từng khách thầu ở *Công nợ → Công nợ & thu nợ* (khối "Ghi nợ đầu kỳ") – phải làm trước khi khách phát sinh giao dịch trên phần mềm.

Cách khác: đặt biến môi trường `DB_INIT=trong` (và `ADMIN_PASSWORD=...`) trước khi chạy lần đầu – CSDL tự tạo sẽ trống thay vì có dữ liệu mẫu.

## 4. Bản demo trên Vercel

Có bản dùng thử tại **https://cokhithanhphat-lttp.vercel.app** (tài khoản mẫu như mục 2).

- Mọi trang có dải vàng **"Bản dùng thử"**: dữ liệu **tự trở về dữ liệu mẫu** mỗi khi Vercel khởi động lại máy chạy (sau một lúc không có người dùng, hoặc khi deploy lại), và hai người dùng cùng lúc có thể thấy dữ liệu khác nhau.
- Chỉ dùng để xem thử, trình diễn, nộp bài. **Không nhập số liệu thật** vào bản này – cửa hàng dùng thật thì chạy trên máy của cửa hàng (mục 2–3).
- Deploy lại (người phát triển): `cd web && npx vercel deploy --prod` (dự án Vercel `cokhithanhphat-lttp`, Root Directory `web`).

## 5. Chạy hằng ngày

- Mở cửa sổ dòng lệnh trên máy chủ: `cd web` rồi `npm start`. Giữ cửa sổ mở trong giờ bán hàng.
- Muốn tự chạy khi bật máy: dùng Task Scheduler (Windows) hoặc `pm2` (`npm i -g pm2`, `pm2 start npm --name cuahang -- start`, `pm2 save`).
- Chạy ở cổng khác: `npm start -- -p 8080`.

| Biến môi trường | Ý nghĩa | Mặc định |
|---|---|---|
| `DB_FILE` | Đường dẫn file CSDL | `web/data/cuahang.db` |
| `DB_INIT` | `trong` = CSDL mới tự tạo sẽ trống (không dữ liệu mẫu) | dữ liệu mẫu |
| `ADMIN_PASSWORD` | Mật khẩu `admin` khi tạo CSDL trống (≥ 6 ký tự) | `admin123` |
| `HTTPS` | Đặt `1` khi chạy sau HTTPS để cookie đăng nhập bật cờ `secure` | không đặt |

## 6. Sao lưu và khôi phục

Toàn bộ dữ liệu nằm trong `web/data/`.

- **Sao lưu hằng ngày (khuyến nghị):** cuối ngày tắt phần mềm (Ctrl+C), chép cả thư mục `web/data/` sang USB hoặc ổ đám mây, đặt tên theo ngày.
- **Sao lưu khi đang chạy:** dùng công cụ `sqlite3`: `sqlite3 web/data/cuahang.db ".backup 'D:/saoluu/cuahang-2026-11-21.db'"`.
  Không chép riêng file `.db` khi đang chạy vì có thể thiếu phần dữ liệu nằm trong file `-wal`.
- **Khôi phục:** tắt phần mềm, chép file sao lưu thành `web/data/cuahang.db` (xóa `cuahang.db-wal`, `cuahang.db-shm` nếu có), chạy lại.

## 7. Nâng cấp phần mềm

Khi cập nhật mã nguồn phiên bản mới, CSDL đang dùng **tự được nâng cấp** lần đầu phần mềm mở nó (dữ liệu giữ nguyên).
Nên làm theo thứ tự:

1. Tắt phần mềm, **sao lưu** thư mục `web/data/` (mục 6).
2. Cập nhật mã nguồn, chạy `npm install` và `npm run build`.
3. (Tùy chọn) chạy `npm run db:nang-cap` để nâng cấp và xem thông báo phiên bản trước khi mở phần mềm.
4. `npm start`.

## 8. Khắc phục sự cố

| Hiện tượng | Cách xử lý |
|---|---|
| `EADDRINUSE: address already in use :::3000` | Phần mềm đang chạy ở cửa sổ khác, hoặc cổng bị chiếm. Tắt cửa sổ cũ hoặc chạy cổng khác (`-p 3001`). |
| Máy nhân viên không vào được | Kiểm tra cùng mạng, đúng IP máy chủ, tường lửa cho phép Node.js. |
| Lỗi khi `npm install` liên quan `better-sqlite3` | Dùng Node bản LTS (20/22/24). Nếu vẫn lỗi trên Windows, cài "Desktop development with C++" của Visual Studio Build Tools rồi cài lại. |
| Muốn làm lại từ dữ liệu mẫu | `npm run db:mau -- --force` (CSDL cũ được đổi tên làm bản sao lưu), hoặc `npm run reset-db` (**xóa hẳn**). |
| Báo "Đã có CSDL … Thêm --force" | Lệnh `db:trong` / `db:mau` không ghi đè CSDL đang có nếu thiếu `--force`. |
| Trang báo "Lỗi hệ thống" | Xem thông báo lỗi ở cửa sổ dòng lệnh đang chạy phần mềm, gửi cho người phát triển. |

## 9. Dành cho người phát triển

- Chế độ phát triển: `npm run dev` (tự tải lại khi sửa code). Kiểm thử nghiệp vụ: `npm test`.
- Kiến trúc, mô hình dữ liệu và quy tắc cập nhật tài liệu: [kien-truc.md](kien-truc.md), [../CLAUDE.md](../CLAUDE.md).
- Đổi cấu trúc CSDL: thêm bước vào cuối `web/lib/migrations.ts` (không sửa schema gốc), kèm kiểm thử nâng cấp.
- **Chụp lại hình cho hướng dẫn sử dụng** (khi giao diện thay đổi) – chạy trên CSDL mẫu riêng, không đụng dữ liệu thật:
  ```bash
  cd web
  npm run build
  # cửa sổ 1: server riêng ở cổng 3457 với CSDL mẫu mới (đường dẫn chưa tồn tại)
  DB_FILE=/tmp/huongdan/hd.db npx next start -p 3457
  # cửa sổ 2: chụp 40 hình vào docs/hinh/ (cần Microsoft Edge hoặc Chrome; đặt EDGE_PATH nếu khác vị trí mặc định)
  npm run docs:chup
  ```
  Script `web/scripts/chup-man-hinh.mjs` thao tác như người dùng thật và đánh số đỏ các vị trí; nếu đổi bố cục trang, sửa bộ chọn tương ứng trong script.
- Đề xuất cải tiến vận hành: nút sao lưu trong phần mềm, quản lý danh sách kho trên giao diện.
