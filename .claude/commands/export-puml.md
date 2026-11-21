---
description: Xuất tất cả sơ đồ trong các file .puml ra PNG vào thư mục out/
---

Tìm file `plantuml.jar` (thường trong thư mục extension `jebbs.plantuml` ở `~/.vscode/extensions/`).
Chạy `java -jar <đường dẫn plantuml.jar> -tpng -o out $ARGUMENTS` (mặc định `*.puml` nếu không có tham số).
Nếu báo thiếu Graphviz, chạy lại với `-Playout=smetana`. Báo lại danh sách ảnh đã tạo.
