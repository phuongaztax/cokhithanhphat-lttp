# -*- coding: utf-8 -*-
"""Sinh file draw.io wireframe cho hệ thống quản lý cửa hàng cơ khí.

Chạy:  python tools/gen_drawio_wireframe.py
Ra:    wireframe-cuahang-cokhi.drawio  (mỗi màn hình một trang)
       out/drawio-preview/*.svg       (ảnh xem nhanh, cùng toạ độ)

Sửa màn hình: chỉnh hàm screen_Wxx tương ứng rồi chạy lại script.
"""
import html
import os
import zlib  # noqa: F401  (để dành nếu muốn nén diagram)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DRAWIO = os.path.join(ROOT, "wireframe-cuahang-cokhi.drawio")
OUT_SVG = os.path.join(ROOT, "out", "drawio-preview")

# ---------------------------------------------------------------- màu / style
C_DARK = "#3A4B57"
C_LINE = "#9AA5AD"
C_HEAD = "#E8EEF2"
C_RED = "#C0392B"
C_BLUE = "#1F6FB2"
C_GRAY = "#6B7780"
FONT = "fontFamily=Helvetica;fontSize=12;"

STYLE = {
    "win": "rounded=0;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#5B6770;strokeWidth=1.5;shadow=1;",
    "titlebar": f"rounded=0;whiteSpace=wrap;html=1;fillColor={C_DARK};strokeColor={C_DARK};fontColor=#FFFFFF;align=left;spacingLeft=10;fontStyle=1;{FONT}",
    "menubar": f"rounded=0;whiteSpace=wrap;html=1;fillColor=#F4F6F8;strokeColor={C_LINE};align=left;spacingLeft=10;fontColor=#333333;{FONT}",
    "L": f"text;html=1;align=left;verticalAlign=middle;whiteSpace=wrap;fontColor=#222222;{FONT}",
    "LB": f"text;html=1;align=left;verticalAlign=middle;whiteSpace=wrap;fontColor=#222222;fontStyle=1;{FONT}",
    "LR": f"text;html=1;align=right;verticalAlign=middle;whiteSpace=wrap;fontColor=#222222;{FONT}",
    "LRB": f"text;html=1;align=right;verticalAlign=middle;whiteSpace=wrap;fontColor=#222222;fontStyle=1;{FONT}",
    "N": f"text;html=1;align=left;verticalAlign=middle;whiteSpace=wrap;fontColor={C_RED};{FONT}",
    "i": f"text;html=1;align=left;verticalAlign=middle;whiteSpace=wrap;fontColor={C_GRAY};fontStyle=2;{FONT}",
    "H": f"text;html=1;align=left;verticalAlign=middle;whiteSpace=wrap;fontColor={C_DARK};fontStyle=1;fontSize=16;fontFamily=Helvetica;",
    "I": f"rounded=0;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor={C_LINE};align=left;spacingLeft=6;fontColor=#333333;{FONT}",
    "D": f"rounded=0;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor={C_LINE};align=left;spacingLeft=6;fontColor=#333333;{FONT}",
    "B": f"rounded=1;arcSize=15;whiteSpace=wrap;html=1;fillColor={C_DARK};strokeColor={C_DARK};fontColor=#FFFFFF;fontStyle=1;{FONT}",
    "b": f"rounded=1;arcSize=15;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor={C_DARK};fontColor={C_DARK};{FONT}",
    "x": f"rounded=1;arcSize=15;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor={C_RED};fontColor={C_RED};fontSize=11;fontFamily=Helvetica;",
    "R": f"text;html=1;align=left;verticalAlign=middle;whiteSpace=wrap;fontColor=#222222;{FONT}",
    "C": f"text;html=1;align=left;verticalAlign=middle;whiteSpace=wrap;fontColor=#222222;{FONT}",
    "group": f"rounded=1;arcSize=2;whiteSpace=wrap;html=1;fillColor=none;strokeColor={C_LINE};",
    "grouptitle": f"text;html=1;align=left;verticalAlign=middle;fillColor=#FFFFFF;fontColor={C_DARK};fontStyle=1;spacingLeft=4;spacingRight=4;{FONT}",
    "th": f"rounded=0;whiteSpace=wrap;html=1;fillColor={C_HEAD};strokeColor={C_LINE};fontStyle=1;align=left;spacingLeft=5;fontColor=#222222;{FONT}",
    "td": f"rounded=0;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor={C_LINE};align=left;spacingLeft=5;fontColor=#222222;{FONT}",
    "tab_on": f"rounded=0;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor={C_DARK};fontStyle=1;fontColor={C_DARK};{FONT}",
    "tab_off": f"rounded=0;whiteSpace=wrap;html=1;fillColor={C_HEAD};strokeColor={C_LINE};fontColor=#555555;{FONT}",
    "sep": f"line;strokeWidth=1;html=1;strokeColor={C_LINE};",
    "stat": f"rounded=1;arcSize=6;whiteSpace=wrap;html=1;fillColor=#F7FAFB;strokeColor={C_LINE};align=left;spacingLeft=10;verticalAlign=middle;fontColor=#222222;{FONT}",
    "callout": "shape=note;size=12;whiteSpace=wrap;html=1;fillColor=#FFF8DC;strokeColor=#D4B106;align=left;spacingLeft=8;spacingRight=6;verticalAlign=top;spacingTop=6;fontColor=#5C4A00;fontSize=11;fontFamily=Helvetica;",
}

GAP = 8
ROW_H = 28
PAD = 20
WIN_W = 980


def esc(s):
    return html.escape(s, quote=True)


class Page:
    def __init__(self, pid, name, title, role, active_menu=None, menu=True):
        self.pid, self.name, self.title, self.role = pid, name, title, role
        self.cells = []  # (id, value, style, x, y, w, h)
        self.n = 0
        self.ox, self.oy = 40, 70  # gốc cửa sổ
        self.x0 = self.ox + PAD
        self.y = self.oy
        self.width = WIN_W
        self.menu = menu
        self.active_menu = active_menu
        self.win_index = None
        self.callouts = []

    # ------------------------------------------------------------ primitives
    def add(self, value, style, x, y, w, h):
        self.n += 1
        cid = f"{self.pid}-{self.n}"
        self.cells.append([cid, value, STYLE.get(style, style), x, y, w, h])
        return len(self.cells) - 1

    def start(self):
        self.add(f"{self.pid} – {self.title}", "H", self.ox, 20, self.width, 34)
        self.win_index = self.add("", "win", self.ox, self.oy, self.width, 100)
        self.add("CỬA HÀNG CƠ KHÍ", "titlebar", self.ox, self.oy, self.width, 34)
        self.add(f"👤 {self.role}  ·  Đăng xuất", f"text;html=1;align=right;verticalAlign=middle;fontColor=#FFFFFF;spacingRight=10;{FONT}",
                 self.ox + self.width - 360, self.oy, 360, 34)
        self.y = self.oy + 34
        if self.menu:
            items = ["Bán hàng", "Kho", "Công nợ", "Quản trị", "Báo cáo"]
            x = self.ox
            self.add("", "menubar", self.ox, self.y, self.width, 30)
            for it in items:
                w = 100
                st = (f"text;html=1;align=center;verticalAlign=middle;fontStyle=1;fontColor={C_DARK};"
                      f"strokeColor={C_DARK};fillColor=#FFFFFF;{FONT}" if it == self.active_menu
                      else f"text;html=1;align=center;verticalAlign=middle;fontColor=#444444;{FONT}")
                self.add(it, st, x + 1, self.y + 1, w, 28)
                x += w
            self.y += 30
        self.y += 16

    def finish(self):
        self.y += PAD - GAP
        self.cells[self.win_index][6] = self.y - self.oy
        # callout bên phải cửa sổ
        cy = self.oy
        for text, h in self.callouts:
            self.add(text, "callout", self.ox + self.width + 30, cy, 260, h)
            cy += h + 14

    # ------------------------------------------------------------- layout
    def row(self, items, x=None, h=ROW_H, gap=GAP):
        x = self.x0 if x is None else x
        for it in items:
            kind, text, w = it[0], it[1], it[2]
            x = self._item(kind, text, w, x, self.y, h, it[3:] if len(it) > 3 else ())
            x += gap
        self.y += h + GAP

    def _item(self, kind, text, w, x, y, h, extra):
        if kind == "S":
            return x + w
        if kind == "D":
            self.add(esc(text), "D", x, y, w, h)
            self.add("▾", f"text;html=1;align=center;verticalAlign=middle;fontColor={C_DARK};{FONT}", x + w - 22, y, 22, h)
            return x + w
        if kind == "R":
            mark = "◉" if (extra and extra[0]) else "○"
            self.add(f"{mark} {esc(text)}", "R", x, y, w, h)
            return x + w
        if kind == "C":
            mark = "☑" if (extra and extra[0]) else "☐"
            self.add(f"{mark} {esc(text)}", "C", x, y, w, h)
            return x + w
        if kind in ("I", "B", "b", "x"):
            bh = h - 2 if kind != "I" else h
            self.add(esc(text), kind, x, y + (h - bh) / 2, w, bh)
            return x + w
        # nhãn: cho phép html thô (đã viết sẵn <b>, <font>)
        self.add(text, kind, x, y, w, h)
        return x + w

    def sep(self):
        self.add("", "sep", self.x0, self.y, self.width - 2 * PAD, 8)
        self.y += 14

    def note(self, text, kind="i", h=22):
        self.add(text, kind, self.x0, self.y, self.width - 2 * PAD, h)
        self.y += h + 4

    def table(self, cols, rows, x=None, rh=28):
        x0 = self.x0 if x is None else x
        x = x0
        for head, w in cols:
            self.add(f"{esc(head)}", "th", x, self.y, w, rh)
            x += w
        self.y += rh
        for r in rows:
            x = x0
            for (head, w), cell in zip(cols, r):
                self.add("", "td", x, self.y, w, rh)
                if isinstance(cell, tuple):
                    k, t = cell[0], cell[1]
                    ex = cell[2:]
                    if k in ("I", "D"):
                        self._item(k, t, w - 8, x + 4, self.y + 3, rh - 6, ex)
                    elif k in ("B", "b", "x"):
                        self._item(k, t, w - 10, x + 5, self.y + 3, rh - 6, ex)
                    elif k in ("C", "R"):
                        self._item(k, t, w - 6, x + 5, self.y, rh, ex)
                    else:
                        self.add(t, k, x + 5, self.y, w - 8, rh)
                else:
                    self.add(cell, "L", x + 5, self.y, w - 8, rh)
                x += w
            self.y += rh
        self.y += GAP + 4
        return x - x0

    def group(self, title, body, w=None, x=None):
        """Vẽ khung nhóm có tiêu đề; body(page) vẽ nội dung với x0 thụt vào."""
        gx = self.x0 if x is None else x
        gw = (self.width - 2 * PAD) if w is None else w
        gy = self.y
        idx = self.add("", "group", gx, gy + 9, gw, 10)
        self.add(esc(title), "grouptitle", gx + 10, gy, len(title) * 7.2 + 14, 18)
        old = self.x0
        self.x0 = gx + 14
        self.y = gy + 28
        body(self)
        self.x0 = old
        self.y += 4
        self.cells[idx][6] = self.y - (gy + 9)
        self.y += GAP + 6

    def columns(self, parts, gap=16):
        """Vẽ các khối cạnh nhau: parts = [(width, fn)]."""
        y0 = self.y
        x0 = self.x0
        maxy = y0
        x = x0
        for w, fn in parts:
            self.y = y0
            self.x0 = x
            old_w = self.width
            fn(self, w)
            self.width = old_w
            maxy = max(maxy, self.y)
            x += w + gap
        self.x0 = x0
        self.y = maxy

    def tabs(self, names, active=0):
        x = self.x0
        for i, nm in enumerate(names):
            w = len(nm) * 7.5 + 28
            self.add(esc(nm), "tab_on" if i == active else "tab_off", x, self.y, w, 30)
            x += w - 1
        self.add("", f"line;strokeWidth=1;html=1;strokeColor={C_DARK};", x, self.y + 26, self.ox + self.width - PAD - x, 8)
        self.y += 30 + 14

    def callout(self, text, h=70):
        self.callouts.append((text, h))

    # ------------------------------------------------------------- output
    def xml(self):
        out = [f'  <diagram id="{self.pid}" name="{esc(self.name)}">',
               '    <mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" '
               'arrows="1" fold="1" page="1" pageScale="1" pageWidth="1400" pageHeight="1000" math="0" shadow="0">',
               '      <root>',
               f'        <mxCell id="{self.pid}-0" />',
               f'        <mxCell id="{self.pid}-p" parent="{self.pid}-0" />']
        for cid, value, style, x, y, w, h in self.cells:
            out.append(f'        <mxCell id="{cid}" value="{esc(value)}" style="{esc(style)}" vertex="1" parent="{self.pid}-p">'
                       f'<mxGeometry x="{x:g}" y="{y:g}" width="{w:g}" height="{h:g}" as="geometry" /></mxCell>')
        out += ['      </root>', '    </mxGraphModel>', '  </diagram>']
        return "\n".join(out)

    def svg(self):
        """Ảnh xem nhanh (xấp xỉ) để kiểm tra bố cục."""
        import re
        W = max(c[3] + c[5] for c in self.cells) + 40
        H = max(c[4] + c[6] for c in self.cells) + 40
        o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W:g}" height="{H:g}" font-family="Helvetica,Arial" font-size="12">',
             f'<rect width="100%" height="100%" fill="#ffffff"/>']
        for cid, value, style, x, y, w, h in self.cells:
            st = dict(kv.split("=", 1) for kv in style.split(";") if "=" in kv)
            fill = st.get("fillColor", "none")
            stroke = st.get("strokeColor", "none")
            if style.startswith("text;") and "strokeColor" not in st:
                stroke = "none"
            if style.startswith("text;") and "fillColor" not in st:
                fill = "none"
            if style.startswith("line;"):
                o.append(f'<line x1="{x}" y1="{y+h/2}" x2="{x+w}" y2="{y+h/2}" stroke="{stroke}"/>')
                continue
            if fill != "none" or stroke != "none":
                rx = 4 if "rounded=1" in style else 0
                o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}"/>')
            txt = re.sub(r"<[^>]+>", "", html.unescape(value))
            if txt:
                fc = st.get("fontColor", "#222")
                fs = st.get("fontSize", "12")
                bold = "bold" if st.get("fontStyle") in ("1",) else "normal"
                ital = "italic" if st.get("fontStyle") == "2" else "normal"
                al = st.get("align", "center")
                if al == "left":
                    tx, anc = x + float(st.get("spacingLeft", 2)), "start"
                elif al == "right":
                    tx, anc = x + w - 4, "end"
                else:
                    tx, anc = x + w / 2, "middle"
                ty = y + 16 if st.get("verticalAlign") == "top" else y + h / 2 + 4
                for k, line in enumerate(txt.split("\n")):
                    o.append(f'<text x="{tx}" y="{ty + k*14}" fill="{fc}" font-size="{fs}" font-weight="{bold}" '
                             f'font-style="{ital}" text-anchor="{anc}">{esc(line)}</text>')
        o.append("</svg>")
        return "\n".join(o)


def red(t):
    return f'<font color="{C_RED}">{t}</font>'


def blue(t):
    return f'<font color="{C_BLUE}">{t}</font>'


NV = "Nguyễn Văn Lan (Nhân viên bán hàng)"
TK = "Trần Văn Bình (Thủ kho)"
CH = "Chủ cửa hàng"


# ====================================================================== màn hình
def screen_W00():
    p = Page("W00", "W00 Đăng nhập", "Đăng nhập (UC00)", "Chưa đăng nhập", menu=False)
    p.start()
    p.width = WIN_W
    x = p.ox + (WIN_W - 380) / 2
    p.y += 20

    def body(q):
        q.row([("L", "Tên đăng nhập", 340)])
        q.row([("I", "nv_lan", 340)], h=32)
        q.row([("L", "Mật khẩu", 340)])
        q.row([("I", "••••••••", 340)], h=32)
        q.row([("C", "Ghi nhớ đăng nhập", 200, False)])
        q.row([("B", "Đăng nhập", 340)], h=36)
        q.row([("N", "Sai tài khoản hoặc mật khẩu (hiện khi lỗi)", 340)])
    p.group("Đăng nhập hệ thống", body, w=380, x=x)
    p.y += 20
    p.callout("Sau khi đăng nhập, menu hiển thị theo vai trò: Nhân viên bán hàng / Thủ kho / Chủ cửa hàng.", 64)
    p.finish()
    return p


def screen_W01():
    p = Page("W01", "W01 Trang chính", "Trang chính – menu theo vai trò", NV)
    p.start()
    p.row([("LB", "Xin chào, Nguyễn Văn Lan", 400), ("S", "", 320), ("LR", "Ca làm: 21/11/2026", 200)])
    p.sep()
    p.row([("LB", "Lối tắt", 200)])
    p.row([("B", "Lập phiếu bán (F2)", 200), ("b", "Tra cứu hàng (F3)", 200), ("b", "Khách trả hàng (F4)", 200),
           ("b", "Tra cứu công nợ", 200)], h=36)
    p.y += 6
    p.row([("LB", "Hôm nay", 200)])
    p.row([("stat", "Số phiếu bán<br><b style='font-size:20px'>37</b>", 210),
           ("stat", "Doanh thu<br><b style='font-size:20px'>18.450.000 đ</b>", 210),
           ("stat", "Ghi nợ mới<br><b style='font-size:20px'>4.200.000 đ</b>", 210),
           ("stat", "Khách trả hàng<br><b style='font-size:20px'>2 phiếu</b>", 210)], h=64)
    p.y += 6
    p.group("Cảnh báo", lambda q: (
        q.row([("N", "⚠ 12 mặt hàng dưới mức tồn tối thiểu", 400), ("b", "Xem", 70)]),
        q.row([("L", "3 khách thầu nợ quá 30 ngày", 400), ("b", "Xem", 70)])))
    p.callout("Menu theo vai trò:<br>• NV bán hàng: Bán hàng, Công nợ<br>• Thủ kho: Kho (+ tra cứu tồn)<br>"
              "• Chủ cửa hàng: tất cả + Quản trị, Báo cáo", 96)
    p.finish()
    return p


def screen_W02():
    p = Page("W02", "W02 Tra cứu & báo giá", "Tra cứu tồn kho & giá / Báo giá (UC01, UC02)", NV, "Bán hàng")
    p.start()
    p.row([("I", "🔍 ốc lục giác M10", 380), ("D", "Tất cả nhóm", 150), ("D", "Kho chính", 150), ("B", "Tìm", 80)], h=32)
    p.table([("Mã", 80), ("Tên hàng", 220), ("Tồn", 70), ("ĐVT", 60), ("Giá lẻ", 120), ("Giá sỉ", 150), ("", 120)], [
        ["OC010", "Ốc lục giác M10x30", "2.350", "con", "1.500 / con", "62.000 / kg", ("b", "+ Báo giá")],
        ["OC011", "Ốc lục giác M10x50", "120", "con", "2.200 / con", "60.000 / kg", ("b", "+ Báo giá")],
        ["DD025", "Dây điện 2x2.5", "340", "mét", "14.000 / m", "1.250.000 / cuộn", ("b", "+ Báo giá")],
    ])
    p.note("Tồn theo đơn vị cơ sở; chọn một dòng để xem tồn theo từng đơn vị quy đổi và theo kho.")

    def bg(q):
        q.row([("L", "Khách", 60), ("I", "Anh Tư (thầu)", 260), ("b", "Chọn khách", 110)])
        q.table([("Hàng", 220), ("SL", 80), ("ĐVT", 90), ("Đơn giá", 110), ("Thành tiền", 120), ("", 70)], [
            ["Ốc lục giác M10x30", ("I", "5"), ("D", "kg"), "62.000", "310.000", ("x", "Xóa")],
            ["Dây điện 2x2.5", ("I", "50"), ("D", "mét"), "14.000", "700.000", ("x", "Xóa")],
        ])
        q.row([("S", "", 400), ("LRB", "Tổng: 1.010.000 đ", 280)])
        q.row([("b", "In báo giá", 120), ("B", "Chuyển thành phiếu bán", 200), ("b", "Hủy", 80)], h=32)
    p.group("Phiếu báo giá", bg)
    p.callout("UC02 include UC01: báo giá luôn bắt đầu từ việc tra tồn & giá.", 54)
    p.callout("Đổi ĐVT trong phiếu báo giá → đơn giá lấy theo đơn vị đó (khai báo ở W10).", 64)
    p.finish()
    return p


def screen_W03():
    p = Page("W03", "W03 Lập phiếu bán", "Lập phiếu bán (UC03 + UC04 quy đổi ĐVT + UC05 thu tiền / UC06 ghi nợ)", NV, "Bán hàng")
    p.start()
    p.row([("L", "Số phiếu: <b>PB-20261121-038</b>", 300), ("L", "Ngày: 21/11/2026", 200), ("L", "NV bán: Nguyễn Văn Lan", 260)])

    def kh(q):
        q.row([("R", "Khách lẻ", 100, False), ("R", "Khách thầu", 110, True), ("I", "Anh Tư – 0905xxx123", 280),
               ("b", "Tìm", 60), ("b", "+ Khách mới", 110)])
        q.row([("L", "Nợ hiện tại: " + red("8.600.000 đ") + " (từ 02/11/2026) · Hạn mức: 30.000.000 đ", 600)])
    p.group("Khách hàng", kh)

    def hb(q):
        q.row([("L", "Mã / tên hàng", 100), ("I", "OC010", 220), ("L", "SL", 24), ("I", "5", 70), ("D", "kg", 90),
               ("B", "Thêm", 80)])
    p.group("Thêm hàng", hb)
    p.table([("#", 34), ("Hàng", 200), ("SL", 60), ("ĐVT", 80), ("Quy đổi", 110), ("Đơn giá", 100), ("Thành tiền", 120), ("", 70)], [
        ["1", "Ốc lục giác M10x30", "5", ("D", "kg"), "≈ 400 con", "62.000", "310.000", ("x", "Xóa")],
        ["2", "Dây điện 2x2.5", "50", ("D", "mét"), "50 mét", "14.000", "700.000", ("x", "Xóa")],
        ["3", "Long đền M10", "200", ("D", "con"), "200 con", "300", "60.000", ("x", "Xóa")],
    ])
    p.note("ĐVT lấy theo khai báo của hàng (con / kg / mét / cuộn); hệ thống tự quy đổi về đơn vị cơ sở để trừ tồn.")

    def tong(q, w):
        q.row([("L", "Tổng tiền hàng", 140), ("LRB", "1.070.000 đ", 140)], x=q.x0)
        q.row([("L", "Chiết khấu", 140), ("I", "0", 140)], x=q.x0)
        q.row([("LB", "Phải trả", 140), ("LRB", "1.070.000 đ", 140)], x=q.x0)

    def tt(q, w):
        def body(r):
            r.row([("R", "Thu tiền ngay (khách lẻ)", 200, False), ("L", "Khách đưa", 80), ("I", "", 120), ("L", "Thối lại: 0", 100)])
            r.row([("R", "Ghi công nợ (khách thầu)", 200, True), ("L", "Nợ sau phiếu: " + red("<b>9.670.000 đ</b>"), 300)])
        q.group("Thanh toán", body, w=w, x=q.x0)
    p.columns([(300, tong), (620, tt)])
    p.row([("B", "Lưu & In phiếu (F9)", 180), ("b", "Lưu nháp", 110), ("b", "Hủy", 80)], h=34)
    p.callout("UC05 / UC06 extend UC03: chọn một trong hai hình thức thanh toán.", 54)
    p.callout("Ghi nợ: lưu số tiền và ngày phát sinh theo phiếu; cảnh báo nếu vượt hạn mức.", 64)
    p.finish()
    return p


def screen_W04():
    p = Page("W04", "W04 Khách trả hàng", "Xử lý khách trả hàng (UC07 + UC08 trừ công nợ / hoàn tiền)", NV, "Bán hàng")
    p.start()
    p.row([("L", "Phiếu bán gốc", 110), ("I", "PB-20261118-012", 220), ("B", "Tìm phiếu", 100)], h=32)
    p.row([("L", "Khách: <b>Anh Tư (thầu)</b>", 260), ("L", "Ngày bán: 18/11/2026", 200), ("L", "Hình thức: Ghi nợ", 200)])
    p.table([("Trả", 50), ("Hàng", 200), ("Đã mua", 90), ("SL trả", 90), ("ĐVT", 70), ("Còn nguyên?", 130), ("Tiền trả lại", 120)], [
        [("C", "", True), "Ốc lục giác M10x30", "5 kg", ("I", "1"), "kg", ("C", "Còn nguyên", True), "62.000"],
        [("C", "", False), "Dây điện 2x2.5", "50 mét", ("I", ""), "mét", ("C", "Còn nguyên", False), "0"],
    ])
    p.note("⚠ Chỉ nhận lại hàng còn nguyên; hàng nhận lại được cộng vào tồn kho (đúng lô đã bán).", "N")
    p.row([("L", "Lý do trả", 80), ("I", "Mua dư", 500)])

    def xl(q):
        q.row([("R", "Trừ vào công nợ", 200, True), ("L", "Nợ trước: 9.670.000", 180), ("L", "Nợ sau: <b>9.608.000 đ</b>", 200)])
        q.row([("R", "Hoàn tiền mặt (khách lẻ)", 200, False), ("L", "Hoàn: 0", 180)])
    p.group("Xử lý tiền (UC08)", xl)
    p.row([("B", "Lưu phiếu trả", 140), ("b", "In", 70), ("b", "Hủy", 70)], h=34)
    p.callout("UC07 include UC08: mỗi phiếu trả luôn kèm bước trừ nợ hoặc hoàn tiền.", 54)
    p.finish()
    return p


def screen_W05():
    p = Page("W05", "W05 Phiếu nhập", "Lập phiếu nhập hàng (UC09 + UC10 giá nhập theo lô + UC04 quy đổi ĐVT)", TK, "Kho")
    p.start()
    p.row([("L", "Số phiếu: <b>PN-20261121-004</b>", 260), ("L", "Ngày nhập", 70), ("I", "21/11/2026", 110),
           ("L", "Thủ kho: Trần Văn Bình", 220)])
    p.row([("L", "Nhà cung cấp", 100), ("D", "Công ty Bulong Việt Đức", 260), ("L", "Kho nhập", 70), ("D", "Kho chính", 160)])

    def th(q):
        q.row([("L", "Mã / tên", 70), ("I", "OC010", 160), ("L", "SL", 24), ("I", "50", 60), ("D", "kg", 80),
               ("L", "Giá nhập", 64), ("I", "48.000", 100), ("L", "/ kg", 40), ("B", "Thêm", 80)])
        q.row([("i", "Giá các lô trước: lô 10/2026 – 46.500 / kg · lô 08/2026 – 45.000 / kg", 700)])
    p.group("Thêm hàng", th)
    p.table([("Hàng", 200), ("SL", 60), ("ĐVT", 70), ("Quy đổi", 110), ("Giá nhập", 100), ("Thành tiền", 120), ("Mã lô", 130), ("", 70)], [
        ["Ốc lục giác M10x30", "50", "kg", "≈ 4.000 con", "48.000", "2.400.000", "L-OC010-2611", ("x", "Xóa")],
        ["Dây điện 2x2.5", "2", "cuộn", "200 mét", "980.000", "1.960.000", "L-DD025-2611", ("x", "Xóa")],
    ])
    p.row([("LB", "Tổng tiền nhập: 4.360.000 đ", 280), ("L", "Ghi chú", 60), ("I", "", 400)])
    p.row([("B", "Lưu phiếu nhập", 150), ("b", "In", 70), ("b", "Hủy", 70)], h=34)
    p.callout("Mỗi dòng nhập tạo một lô mới giữ giá nhập riêng → dùng tính giá vốn cho báo cáo lãi lỗ.", 64)
    p.finish()
    return p


def screen_W06():
    p = Page("W06", "W06 Kiểm kê", "Kiểm kê kho (UC11 + UC12 ghi nhận chênh lệch)", TK, "Kho")
    p.start()
    p.row([("L", "Đợt: <b>KK-2026-11</b>", 150), ("L", "Kho", 34), ("D", "Kho chính", 150), ("L", "Nhóm", 44),
           ("D", "Ốc vít", 140), ("B", "Tải danh sách", 130)], h=32)
    p.table([("Mã", 80), ("Hàng", 210), ("ĐVT", 60), ("Sổ sách", 100), ("Thực tế", 110), ("Lệch", 80), ("Ghi chú", 200)], [
        ["OC010", "Ốc lục giác M10x30", "con", "6.350", ("I", "6.300"), ("N", "<b>−50</b>"), ("I", "rơi vãi")],
        ["OC011", "Ốc lục giác M10x50", "con", "120", ("I", "120"), "0", ("I", "")],
        ["LD010", "Long đền M10", "con", "1.800", ("I", "1.820"), ("L", blue("<b>+20</b>")), ("I", "")],
    ])
    p.row([("C", "Chỉ hiện dòng bị lệch", 200, False), ("L", "Đã đếm: 3 / 48 mặt hàng", 200)])
    p.sep()
    p.row([("L", "Tổng dòng lệch: <b>2</b>", 180), ("L", "Giá trị lệch: " + red("<b>−69.000 đ</b>"), 220)])
    p.row([("b", "Lưu tạm", 100), ("B", "Chốt kiểm kê & báo chủ cửa hàng", 260), ("b", "Hủy", 70)], h=34)
    p.callout("UC12 extend UC11: chỉ ghi khi Thực tế ≠ Sổ sách; khi chốt, tồn cập nhật theo thực tế và báo cho chủ.", 76)
    p.finish()
    return p


def screen_W07():
    p = Page("W07", "W07 Chuyển kho", "Chuyển kho (UC21 + UC01 tra tồn + UC04 quy đổi ĐVT)", TK, "Kho")
    p.start()
    p.row([("L", "Số phiếu: <b>PC-20261121-001</b>", 260), ("L", "Ngày: 21/11/2026", 160), ("L", "Thủ kho: Trần Văn Bình", 220)])
    p.row([("L", "Kho nguồn", 80), ("D", "Kho chính", 180), ("LB", "  ➜", 40), ("L", "Kho đích", 70), ("D", "Kho phụ (quầy)", 180)], h=32)

    def th(q):
        q.row([("L", "Mã / tên", 64), ("I", "DD025", 130), ("L", "Lô", 24), ("D", "L-DD025-2611 (còn 200 m)", 230),
               ("L", "SL", 24), ("I", "100", 70), ("D", "mét", 80), ("B", "Thêm", 80)])
    p.group("Thêm hàng", th)
    p.table([("Hàng", 200), ("Lô", 130), ("Tồn kho nguồn", 130), ("SL chuyển", 90), ("ĐVT", 130), ("Giá nhập lô", 120), ("", 70)], [
        ["Dây điện 2x2.5", "L-DD025-2611", "200 mét", "100", "mét", "9.800 / m", ("x", "Xóa")],
        ["Ốc lục giác M10x30", "L-OC010-2611", "4.000 con", "10", "kg (≈ 800 con)", "48.000 / kg", ("x", "Xóa")],
    ])
    p.note("Trừ tồn kho nguồn, cộng tồn kho đích; giữ nguyên lô và giá nhập.")
    p.note("⚠ SL chuyển không được vượt tồn kho nguồn của lô.", "N")
    p.row([("B", "Lưu phiếu chuyển", 160), ("b", "In", 70), ("b", "Hủy", 70)], h=34)
    p.finish()
    return p


def screen_W08():
    p = Page("W08", "W08 Khách hàng", "Quản lý khách hàng (UC13)", NV, "Công nợ")
    p.start()
    p.row([("I", "🔍 tên / SĐT", 300), ("L", "Loại", 40), ("D", "Tất cả", 130), ("B", "Tìm", 70), ("S", "", 180),
           ("b", "+ Thêm khách", 130)], h=32)
    p.table([("Mã", 70), ("Tên khách", 220), ("SĐT", 120), ("Loại", 70), ("Hạn mức nợ", 130), ("Đang nợ", 130), ("", 70)], [
        ["KH001", "Anh Tư", "0905xxx123", "Thầu", "30.000.000", "9.608.000", ("b", "Sửa")],
        ["KH002", "Công ty XD Hòa Phát", "0236xxx456", "Thầu", "100.000.000", "42.150.000", ("b", "Sửa")],
        ["KH000", "Khách lẻ", "–", "Lẻ", "–", "–", ""],
    ])

    def f(q):
        for lb, v in [("Tên khách", "Anh Tư"), ("Số điện thoại", "0905xxx123"), ("Địa chỉ", "12 Lê Lợi, Q. Hải Châu")]:
            q.row([("L", lb, 120), ("I", v, 360)])
        q.row([("L", "Loại khách", 120), ("R", "Thầu (thanh toán cuối tháng)", 230, True), ("R", "Lẻ (trả ngay)", 140, False)])
        q.row([("L", "Hạn mức nợ", 120), ("I", "30.000.000", 360)])
        q.row([("L", "Ghi chú", 120), ("I", "", 360)])
        q.row([("S", "", 120), ("B", "Lưu", 90), ("b", "Hủy", 80)], h=32)
    p.group("Thông tin khách hàng", f)
    p.callout("Chủ cửa hàng cũng dùng màn hình này (UC13 có cả 2 tác nhân).", 54)
    p.finish()
    return p


def screen_W09():
    p = Page("W09", "W09 Công nợ & thu nợ", "Tra cứu công nợ (UC14) & Thu nợ cuối tháng (UC15)", NV, "Công nợ")
    p.start()
    p.tabs(["Tra cứu công nợ", "Danh sách khách đang nợ"])
    p.row([("L", "Khách", 50), ("I", "Anh Tư", 200), ("L", "Từ", 24), ("I", "01/11/2026", 110), ("L", "Đến", 30),
           ("I", "30/11/2026", 110), ("B", "Xem", 70)], h=32)
    p.row([("stat", "Nợ đầu kỳ<br><b>0</b>", 160), ("stat", "Phát sinh<br><b>9.670.000</b>", 160),
           ("stat", "Đã trừ / trả<br><b>62.000</b>", 160), ("stat", "Còn nợ<br>" + red("<b>9.608.000 đ</b>"), 180)], h=50)
    p.table([("Ngày", 100), ("Chứng từ", 150), ("Diễn giải", 110), ("Phát sinh nợ", 120), ("Giảm nợ", 100), ("Số dư", 120), ("Số ngày nợ", 100)], [
        ["02/11/2026", "PB-20261102-005", "Mua hàng", "3.400.000", "", "3.400.000", "19"],
        ["10/11/2026", "PB-20261110-021", "Mua hàng", "5.200.000", "", "8.600.000", "11"],
        ["18/11/2026", "PB-20261118-012", "Mua hàng", "1.070.000", "", "9.670.000", "3"],
        ["21/11/2026", "TH-20261121-002", "Trả hàng", "", "62.000", "9.608.000", ""],
    ])
    p.row([("b", "In bảng kê công nợ", 170), ("B", "Thu nợ khách này", 170)], h=32)

    def tn(q):
        q.row([("L", "Khách", 100), ("LB", "Anh Tư", 200), ("L", "Còn nợ", 70), ("L", red("<b>9.608.000 đ</b>"), 160)])
        q.row([("L", "Số tiền thu", 100), ("I", "9.608.000", 200), ("L", "Hình thức", 70), ("D", "Tiền mặt", 160)])
        q.row([("L", "Ngày thu", 100), ("I", "30/11/2026", 200), ("L", "Người thu", 70), ("L", "Nguyễn Văn Lan", 160)])
        q.row([("L", "Ghi chú", 100), ("I", "Thanh toán T11", 438)])
        q.row([("S", "", 100), ("B", "Lưu phiếu thu & In", 170), ("b", "Hủy", 80)], h=32)
    p.group("Thu nợ (UC15) – hộp thoại", tn, w=600)
    p.callout("UC15 include UC14: thu nợ mở từ kết quả tra cứu công nợ.", 54)
    p.callout("Thu đủ → tất toán; thu một phần → trừ dần vào các phiếu nợ cũ nhất trước.", 64)

    def ndk(q):
        q.row([("D", "Thầu Mới", 150), ("L", "Số nợ", 44), ("I", "2.000.000", 120), ("L", "Nợ từ ngày", 74), ("I", "15/01/2026", 110),
               ("I", "Chuyển từ sổ công nợ cũ", 200), ("B", "Ghi nợ đầu kỳ", 130)], h=32)
        q.row([("i", "Chỉ cho khách thầu chưa có giao dịch công nợ trên phần mềm.", 700)])
    p.group("Ghi nợ đầu kỳ (UC24 – chỉ chủ cửa hàng thấy)", ndk)
    p.callout("UC24: chuyển số nợ từ sổ cũ khi bắt đầu dùng phần mềm; ngày = ngày bắt đầu nợ để tính số ngày nợ.", 76)
    p.finish()
    return p


def screen_W10():
    p = Page("W10", "W10 Hàng hóa", "Quản lý hàng hóa (UC16) + Khai báo đơn vị & hệ số quy đổi (UC17)", CH, "Quản trị")
    p.start()
    p.row([("I", "🔍 mã / tên hàng", 300), ("L", "Nhóm", 44), ("D", "Tất cả", 130), ("B", "Tìm", 70), ("S", "", 170),
           ("b", "+ Thêm hàng", 130)], h=32)
    p.table([("Mã", 80), ("Tên hàng", 220), ("Nhóm", 110), ("ĐV cơ sở", 90), ("Tồn tối thiểu", 120), ("Trạng thái", 140), ("", 70)], [
        ["OC010", "Ốc lục giác M10x30", "Ốc vít", "con", "1.000", "Đang bán", ("b", "Sửa")],
        ["DD025", "Dây điện 2x2.5", "Dây điện", "mét", "100", "Đang bán", ("b", "Sửa")],
        ["BL999", "Bulong M24 inox", "Ốc vít", "con", "0", ("i", "Ngừng nhập"), ("b", "Sửa")],
    ])

    def info(q, w):
        def body(r):
            r.row([("L", "Mã hàng", 100), ("I", "OC010", 250)])
            r.row([("L", "Tên hàng", 100), ("I", "Ốc lục giác M10x30", 250)])
            r.row([("L", "Nhóm", 100), ("D", "Ốc vít", 250)])
            r.row([("L", "Đơn vị cơ sở", 100), ("D", "con", 250)])
            r.row([("L", "Tồn tối thiểu", 100), ("I", "1.000", 250)])
            r.row([("L", "Trạng thái", 100), ("D", "Đang bán", 250)])
        q.group("Thông tin hàng: OC010", body, w=w, x=q.x0)

    def dv(q, w):
        def body(r):
            r.table([("Đơn vị", 80), ("= ? ĐV cơ sở", 110), ("Giá bán", 110), ("Dùng khi", 110), ("", 64)], [
                ["con", "1", ("I", "1.500"), "Bán lẻ", ""],
                [("D", "kg"), ("I", "80"), ("I", "62.000"), "Bán sỉ / nhập", ("x", "Xóa")],
                [("D", "hộp"), ("I", "500"), ("I", "700.000"), "Bán sỉ", ("x", "Xóa")],
            ])
            r.row([("b", "+ Thêm đơn vị", 130)])
        q.group("Đơn vị tính & hệ số quy đổi (UC17)", body, w=w, x=q.x0)
    p.columns([(390, info), (530, dv)])
    p.row([("B", "Lưu", 90), ("b", "Hủy", 80)], h=34)
    p.callout("UC16 include UC17: mỗi mặt hàng phải khai báo đơn vị cơ sở và các đơn vị quy đổi (con / kg / mét / cuộn…).", 76)
    p.callout("Tồn tối thiểu dùng cho báo cáo R4 – hàng sắp hết.", 50)
    p.finish()
    return p


def screen_W11():
    p = Page("W11", "W11 Nhà cung cấp", "Quản lý nhà cung cấp (UC18)", CH, "Quản trị")
    p.start()
    p.row([("I", "🔍 tên nhà cung cấp", 300), ("B", "Tìm", 70), ("S", "", 410), ("b", "+ Thêm NCC", 130)], h=32)
    p.table([("Mã", 70), ("Tên nhà cung cấp", 240), ("Người liên hệ", 130), ("SĐT", 120), ("Lần nhập gần nhất", 150), ("", 70)], [
        ["NCC01", "Công ty Bulong Việt Đức", "Chị Hạnh", "0283xxx111", "21/11/2026", ("b", "Sửa")],
        ["NCC02", "Cadivi Đà Nẵng", "Anh Quang", "0236xxx222", "05/11/2026", ("b", "Sửa")],
    ])

    def f(q):
        for lb, v in [("Tên NCC", "Công ty Bulong Việt Đức"), ("Người liên hệ", "Chị Hạnh"), ("Số điện thoại", "0283xxx111"),
                      ("Địa chỉ", "KCN Tân Bình, TP.HCM"), ("Mã số thuế", "0301234567")]:
            q.row([("L", lb, 120), ("I", v, 360)])
        q.row([("S", "", 120), ("B", "Lưu", 90), ("b", "Xem lịch sử phiếu nhập", 190), ("b", "Hủy", 70)], h=32)
    p.group("Thông tin nhà cung cấp", f)
    p.finish()
    return p


def screen_W12():
    p = Page("W12", "W12 Nhân viên", "Quản lý nhân viên (UC19)", CH, "Quản trị")
    p.start()
    p.row([("S", "", 790), ("b", "+ Thêm nhân viên", 150)], h=32)
    p.table([("Mã", 70), ("Họ tên", 200), ("Tài khoản", 120), ("Vai trò", 180), ("Trạng thái", 120), ("", 70)], [
        ["NV01", "Nguyễn Văn Lan", "nv_lan", "Nhân viên bán hàng", "Hoạt động", ("b", "Sửa")],
        ["NV02", "Lê Thị Mai", "nv_mai", "Nhân viên bán hàng", "Hoạt động", ("b", "Sửa")],
        ["NV03", "Trần Văn Bình", "tk_binh", "Thủ kho", "Hoạt động", ("b", "Sửa")],
        ["NV00", "Chủ cửa hàng", "admin", "Chủ cửa hàng", "Hoạt động", ""],
    ])

    def f(q):
        q.row([("L", "Họ tên", 120), ("I", "Lê Thị Mai", 360)])
        q.row([("L", "Số điện thoại", 120), ("I", "0912xxx789", 360)])
        q.row([("L", "Tài khoản", 120), ("I", "nv_mai", 360)])
        q.row([("L", "Vai trò", 120), ("D", "Nhân viên bán hàng", 360)])
        q.row([("L", "Trạng thái", 120), ("R", "Hoạt động", 120, True), ("R", "Khóa", 100, False)])
        q.row([("S", "", 120), ("B", "Lưu", 90), ("b", "Đặt lại mật khẩu", 150), ("b", "Hủy", 70)], h=32)
    p.group("Thông tin nhân viên", f)
    p.callout("Vai trò quyết định menu hiển thị (xem W01).", 44)
    p.finish()
    return p


def screen_W13():
    p = Page("W13", "W13 Báo cáo", "Xem báo cáo (UC20 – R1…R6)", CH, "Báo cáo")
    p.start()
    p.tabs(["R1 Lãi lỗ", "R2 Công nợ", "R3 Doanh số NV", "R4 Sắp hết", "R5 Tồn lâu", "R6 Chênh lệch KK"])
    p.row([("L", "Kỳ", 30), ("D", "Tháng 11/2026", 160), ("B", "Xem", 70), ("S", "", 440), ("b", "Xuất Excel", 110), ("b", "In", 60)], h=32)
    p.row([("stat", "Doanh thu<br><b style='font-size:18px'>412.300.000</b>", 210),
           ("stat", "Giá vốn<br><b style='font-size:18px'>318.900.000</b>", 210),
           ("stat", "Hàng bị trả<br><b style='font-size:18px'>1.240.000</b>", 210),
           ("stat", "Lãi gộp<br><b style='font-size:18px'>92.160.000 đ</b>", 230)], h=60)
    p.table([("Nhóm hàng", 200), ("Doanh thu", 150), ("Giá vốn (theo lô)", 160), ("Lãi gộp", 150), ("Tỉ suất", 100)], [
        ["Ốc vít", "168.200.000", "121.500.000", "46.700.000", "27,8%"],
        ["Dây điện", "152.600.000", "128.900.000", "23.700.000", "15,5%"],
        ["Dụng cụ cầm tay", "91.500.000", "68.500.000", "23.000.000", "25,1%"],
    ])
    p.note("Giá vốn lấy theo giá nhập của từng lô đã xuất bán. Lãi = doanh thu − hàng trả − giá vốn.")
    p.sep()
    p.row([("LB", "Mẫu nội dung các tab khác", 400)])

    def r3(q, w):
        def body(r):
            r.table([("Nhân viên", 150), ("Số phiếu", 80), ("Doanh số", 120)], [
                ["Nguyễn Văn Lan", "612", "228.400.000"], ["Lê Thị Mai", "540", "183.900.000"]])
        q.group("R3 – Doanh số theo nhân viên", body, w=w, x=q.x0)

    def r4(q, w):
        def body(r):
            r.table([("Hàng", 130), ("Tồn", 70), ("Tối thiểu", 70), ("", 130)], [
                ["Dây điện 2x2.5", "80 m", "100", ("b", "Lập phiếu nhập")]])
        q.group("R4 – Hàng sắp hết", body, w=w, x=q.x0)
    p.columns([(390, r3), (430, r4)])

    def r5(q, w):
        def body(r):
            r.row([("L", "Không bán trong", 110), ("D", "365 ngày", 120)])
            r.table([("Hàng", 150), ("Tồn", 80), ("Bán cuối", 100), ("", 150)], [
                ["Bulong M24 inox", "300 con", "14/10/2025", ("b", "Ngừng nhập")]])
        q.group("R5 – Hàng tồn lâu không bán", body, w=w, x=q.x0)

    def r6(q, w):
        def body(r):
            r.table([("Đợt", 100), ("Hàng", 150), ("Lệch", 60), ("Giá trị", 100)], [
                ["KK-2026-11", "Ốc lục giác M10x30", ("N", "−50"), "−75.000"],
                ["KK-2026-11", "Long đền M10", ("L", blue("+20")), "+6.000"]])
        q.group("R6 – Chênh lệch kiểm kê", body, w=w, x=q.x0)
    p.columns([(500, r5), (424, r6)])
    p.callout("R2 Công nợ: dùng lại bảng 'Danh sách khách đang nợ' ở W09 (khách, số nợ, nợ từ ngày, số ngày nợ).", 76)
    p.finish()
    return p


def screen_W14():
    p = Page("W14", "W14 Chi tiết phiếu bán", "Chi tiết phiếu bán / Hủy phiếu bán (UC22)", CH, "Bán hàng")
    p.start()
    p.row([("H", "PHIẾU BÁN HÀNG", 400), ("S", "", 260), ("LR", "Số: <b>PB-20261121-038</b><br>Ngày: 21/11/2026 09:15", 260)], h=44)
    p.row([("L", "Khách: <b>Anh Tư</b> · NV bán: Nguyễn Văn Lan · Kho xuất: Kho chính · Thanh toán: " + red("<b>Ghi công nợ</b>"), 900)])
    p.table([("#", 40), ("Hàng", 260), ("SL", 70), ("ĐVT", 70), ("Đơn giá", 120), ("Thành tiền", 140), ("Đã trả lại", 120)], [
        ["1", "Ốc lục giác M10x30", "5", "kg", "62.000", "310.000", ""],
        ["2", "Dây điện 2x2.5", "20", "mét", "14.000", "280.000", ""],
        ["", "", "", "", ("LB", "Phải trả"), ("LB", "590.000 đ"), ""],
    ])
    p.row([("b", "In", 60), ("B", "Lập phiếu mới", 130), ("b", "Khách trả hàng", 140), ("b", "Danh sách phiếu bán", 170), ("x", "Hủy phiếu", 110)], h=34)
    p.sep()
    p.row([("i", "Sau khi hủy, khung đỏ dưới đây thay cho nút Hủy phiếu:", 700)])
    p.add(red("<b>PHIẾU ĐÃ HỦY</b> lúc 21/11/2026 16:10 bởi Phạm Minh Hùng. Lý do: Lập nhầm khách. Hàng đã được cộng lại vào kho, khoản nợ của phiếu đã được bỏ."),
          "rounded=1;arcSize=6;whiteSpace=wrap;html=1;fillColor=#FDECEA;strokeColor=#F5C6CB;align=left;spacingLeft=10;fontFamily=Helvetica;fontSize=12;",
          p.x0, p.y, p.width - 2 * PAD, 40)
    p.y += 48
    p.callout("Nút Hủy phiếu chỉ chủ cửa hàng thấy, khi phiếu chưa có phiếu trả hàng. Bấm → hỏi lý do.", 64)
    p.callout("Phiếu ghi nợ: không hủy được nếu khách đã trả phần nợ của phiếu. Phiếu hủy bị loại khỏi báo cáo.", 76)
    p.finish()
    return p


def screen_W15():
    p = Page("W15", "W15 Chi tiết phiếu nhập", "Chi tiết phiếu nhập / Sửa giá nhập / Hủy phiếu nhập (UC23)", CH, "Kho")
    p.start()
    p.row([("H", "PHIẾU NHẬP HÀNG", 400), ("S", "", 260), ("LR", "Số: <b>PN-20261106-001</b><br>Ngày: 06/11/2026", 260)], h=44)
    p.row([("L", "Nhà cung cấp: <b>Công ty Bulong Việt Đức</b> · Kho nhập: Kho chính · Thủ kho: Trần Văn Bình", 900)])
    p.table([("Hàng", 170), ("SL", 50), ("ĐVT", 50), ("Giá nhập", 230), ("Thành tiền", 100), ("Lô", 120), ("Lô còn", 90), ("Tình trạng lô", 120)], [
        ["Ốc lục giác M10x30", "50", "kg", ("I", "49.000   / kg   [Lưu] [Bỏ]"), "2.450.000", "L-OC010-2611", "4.000 con", ("L", "đã bán")],
        ["Long đền M10", "10", "kg", ("L", "40.000  " + blue("sửa")), "400.000", "L-LD010-2611", "2.000 con", ("L", "chưa dùng")],
    ], rh=32)
    p.note("Sửa giá: giá vốn các phiếu bán / trả hàng đã dùng lô được tính lại (lệch kiểm kê đã chốt giữ nguyên).")
    p.row([("b", "In", 60), ("b", "Về phiếu nhập", 130), ("x", "Hủy phiếu", 110)], h=34)

    def log(q):
        q.table([("Thời gian", 130), ("Người sửa", 130), ("Nội dung", 620)], [
            ["21/11/2026 16:10", "Phạm Minh Hùng", "Ốc lục giác M10x30 (lô L-OC010-2611): giá nhập 48.000 → 49.000 đ / kg; tính lại giá vốn 3 dòng bán"],
        ])
    p.group("Lịch sử chỉnh sửa", log)
    p.callout("Hủy phiếu nhập chỉ được khi chưa lô nào được bán / chuyển kho / kiểm kê; tồn các lô về 0.", 64)
    p.callout("Sửa giá đổi giá lô ở mọi kho (cùng mã lô) và tính lại giá vốn báo cáo lãi lỗ.", 64)
    p.finish()
    return p


INDEX = [
    ("W00", "Đăng nhập", "UC00", "Tất cả"),
    ("W01", "Trang chính", "–", "Tất cả"),
    ("W02", "Tra cứu tồn kho & báo giá", "UC01, UC02", "NV bán hàng, Thủ kho"),
    ("W03", "Lập phiếu bán", "UC03, UC04, UC05, UC06", "NV bán hàng"),
    ("W04", "Xử lý khách trả hàng", "UC07, UC08", "NV bán hàng"),
    ("W05", "Lập phiếu nhập hàng", "UC09, UC10, UC04", "Thủ kho"),
    ("W06", "Kiểm kê kho", "UC11, UC12", "Thủ kho"),
    ("W07", "Chuyển kho", "UC21, UC01, UC04", "Thủ kho"),
    ("W08", "Quản lý khách hàng", "UC13", "NV bán hàng, Chủ"),
    ("W09", "Tra cứu công nợ & thu nợ", "UC14, UC15, UC24", "NV bán hàng, Chủ"),
    ("W10", "Quản lý hàng hóa & ĐVT", "UC16, UC17", "Chủ cửa hàng"),
    ("W11", "Quản lý nhà cung cấp", "UC18", "Chủ cửa hàng"),
    ("W12", "Quản lý nhân viên", "UC19", "Chủ cửa hàng"),
    ("W13", "Báo cáo", "UC20 (R1–R6)", "Chủ cửa hàng"),
    ("W14", "Chi tiết phiếu bán (hủy)", "UC22", "Chủ cửa hàng (hủy); NV xem"),
    ("W15", "Chi tiết phiếu nhập (sửa giá, hủy)", "UC23", "Chủ cửa hàng (sửa/hủy); Thủ kho xem"),
]


def screen_index():
    p = Page("IDX", "00 Mục lục", "Mục lục màn hình ↔ use case", "", menu=False)
    p.add("Mục lục màn hình ↔ use case", "H", 40, 20, 600, 34)
    p.y = 70
    p.x0 = 40
    p.table([("Mã", 70), ("Màn hình", 260), ("Use case", 220), ("Tác nhân", 200)],
            [[("LB", a), b, c, d] for a, b, c, d in INDEX])
    p.note("Mỗi màn hình nằm ở một trang riêng (tab dưới cùng của draw.io). Ghi chú vàng bên phải giải thích quan hệ include / extend.")
    p.note("Sinh tự động bởi tools/gen_drawio_wireframe.py – sửa script rồi chạy lại thay vì sửa tay nếu muốn giữ đồng bộ.")
    return p


def main():
    pages = [screen_index()] + [f() for f in (screen_W00, screen_W01, screen_W02, screen_W03, screen_W04, screen_W05,
                                               screen_W06, screen_W07, screen_W08, screen_W09, screen_W10, screen_W11,
                                               screen_W12, screen_W13, screen_W14, screen_W15)]
    doc = ['<mxfile host="app.diagrams.net" agent="gen_drawio_wireframe.py" version="24.0.0">']
    doc += [p.xml() for p in pages]
    doc.append("</mxfile>")
    with open(OUT_DRAWIO, "w", encoding="utf-8") as f:
        f.write("\n".join(doc))
    os.makedirs(OUT_SVG, exist_ok=True)
    for p in pages:
        with open(os.path.join(OUT_SVG, f"{p.pid}.svg"), "w", encoding="utf-8") as f:
            f.write(p.svg())
    print(f"OK: {len(pages)} trang -> {OUT_DRAWIO}")


if __name__ == "__main__":
    main()
