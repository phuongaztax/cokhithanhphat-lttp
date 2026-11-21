import Link from "next/link";
import { requireUser, ACCESS } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { debtReport, lowStock, profit, salesByUser, slowMoving, stocktakeDiffs } from "@/lib/services/reports";
import { fmtDate, fmtMoney, fmtQty, today } from "@/lib/util";
import PrintButton from "@/components/PrintButton";

const TABS = [
  ["lai-lo", "R1 Lãi lỗ"], ["cong-no", "R2 Công nợ"], ["doanh-so", "R3 Doanh số NV"],
  ["sap-het", "R4 Sắp hết"], ["ton-lau", "R5 Tồn lâu"], ["kiem-ke", "R6 Chênh lệch KK"],
] as const;

// W13 – Xem báo cáo (UC20: R1..R6)
export default async function BaoCaoPage({ searchParams }: { searchParams: Promise<{ tab?: string; m?: string; d?: string }> }) {
  await requireUser(ACCESS.quanTri);
  const sp = await searchParams;
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab! : "lai-lo";
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : today().slice(0, 7);
  const days = Number(sp.d) > 0 ? Number(sp.d) : 365;
  const db = getDb();
  const usesMonth = ["lai-lo", "doanh-so", "kiem-ke"].includes(tab);

  return (
    <>
      <h1>Báo cáo</h1>
      <div className="tabs no-print">
        {TABS.map(([k, label]) => <Link key={k} href={`/bao-cao?tab=${k}&m=${month}`} className={tab === k ? "on" : ""}>{label}</Link>)}
      </div>
      <form className="row no-print" method="get">
        <input type="hidden" name="tab" value={tab} />
        {usesMonth && (<><span>Kỳ</span><input type="month" name="m" defaultValue={month} /></>)}
        {tab === "ton-lau" && (
          <><span>Không bán trong</span>
            <select name="d" defaultValue={String(days)}>{[90, 180, 365].map((d) => <option key={d} value={d}>{d} ngày</option>)}</select></>
        )}
        {(usesMonth || tab === "ton-lau") && <button className="primary">Xem</button>}
        <span className="grow" />
        <PrintButton />
      </form>

      {tab === "lai-lo" && <Profit month={month} db={db} />}
      {tab === "cong-no" && <Debt db={db} />}
      {tab === "doanh-so" && <SalesByUser month={month} db={db} />}
      {tab === "sap-het" && <LowStock db={db} />}
      {tab === "ton-lau" && <SlowMoving days={days} db={db} />}
      {tab === "kiem-ke" && <Diffs month={month} db={db} />}
    </>
  );
}

type DBP = { db: ReturnType<typeof getDb> };
const mLabel = (m: string) => `tháng ${m.slice(5)}/${m.slice(0, 4)}`;

function Profit({ month, db }: DBP & { month: string }) {
  const r = profit(db, month);
  return (
    <>
      <h2>R1 – Lãi lỗ {mLabel(month)}</h2>
      <div className="stats">
        <div className="stat"><div className="k">Doanh thu ({r.sales} phiếu)</div><div className="v">{fmtMoney(r.revenue)}</div></div>
        <div className="stat"><div className="k">Hàng bị trả lại</div><div className="v">{fmtMoney(r.returns)}</div></div>
        <div className="stat"><div className="k">Giá vốn (theo lô)</div><div className="v">{fmtMoney(r.cogs)}</div></div>
        <div className="stat"><div className="k">Lãi gộp</div><div className={`v ${r.profit >= 0 ? "green" : "red"}`}>{fmtMoney(r.profit)} đ</div></div>
      </div>
      <div className="card tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Nhóm hàng</th><th className="num">Doanh thu thuần</th><th className="num">Giá vốn</th><th className="num">Lãi gộp</th><th className="num">Tỉ suất</th></tr></thead>
          <tbody>
            {r.groups.map((g) => (
              <tr key={g.grp}><td>{g.grp}</td><td className="num">{fmtMoney(g.revenue)}</td><td className="num">{fmtMoney(g.cogs)}</td>
                <td className="num">{fmtMoney(g.profit)}</td><td className="num">{(g.margin * 100).toFixed(1)}%</td></tr>
            ))}
            {!r.groups.length && <tr><td colSpan={5} className="muted">Không có bán hàng trong kỳ</td></tr>}
          </tbody>
        </table>
        <p className="note">Giá vốn lấy theo giá nhập của từng lô đã xuất bán (FIFO). Lãi = doanh thu − hàng trả − giá vốn (đã trừ giá vốn hàng trả).</p>
      </div>
    </>
  );
}

function Debt({ db }: DBP) {
  const rows = debtReport(db);
  return (
    <>
      <h2>R2 – Công nợ khách hàng đến {fmtDate(today())}</h2>
      <div className="card tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Khách</th><th>SĐT</th><th className="num">Còn nợ</th><th>Nợ từ ngày</th><th className="num">Số ngày nợ</th><th className="num">Hạn mức</th></tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}><td><Link href={`/cong-no?kh=${d.id}`}>{d.name}</Link></td><td>{d.phone}</td><td className="num b red">{fmtMoney(d.balance)}</td>
                <td>{fmtDate(d.since)}</td><td className={`num ${d.days > 30 ? "red b" : ""}`}>{d.days}</td>
                <td className="num">{d.credit_limit ? fmtMoney(d.credit_limit) : "–"}</td></tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={2} className="right">Tổng</td><td className="num">{fmtMoney(rows.reduce((s, d) => s + d.balance, 0))}</td><td colSpan={3}></td></tr></tfoot>
        </table>
      </div>
    </>
  );
}

function SalesByUser({ month, db }: DBP & { month: string }) {
  const rows = salesByUser(db, month);
  const total = rows.reduce((s, r) => s + r.gross - r.returned, 0) || 1;
  return (
    <>
      <h2>R3 – Doanh số theo nhân viên {mLabel(month)}</h2>
      <div className="card tbl-wrap">
        <table className="tbl">
          <thead><tr><th>#</th><th>Nhân viên</th><th className="num">Số phiếu</th><th className="num">Doanh số</th><th className="num">Hàng bị trả</th><th className="num">Doanh số thuần</th><th className="num">Tỉ lệ</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}><td>{i + 1}</td><td>{r.full_name}{i === 0 && r.gross > 0 && " 🏆"}</td><td className="num">{r.n}</td>
                <td className="num">{fmtMoney(r.gross)}</td><td className="num">{fmtMoney(r.returned)}</td>
                <td className="num b">{fmtMoney(r.gross - r.returned)}</td>
                <td className="num">{(((r.gross - r.returned) / total) * 100).toFixed(1)}%</td></tr>
            ))}
          </tbody>
        </table>
        <p className="note">Dùng để tính thưởng theo doanh số. Hàng bị trả được trừ vào doanh số của nhân viên đã bán phiếu gốc.</p>
      </div>
    </>
  );
}

function LowStock({ db }: DBP) {
  const rows = lowStock(db);
  return (
    <>
      <h2>R4 – Hàng sắp hết (tồn ≤ tồn tối thiểu)</h2>
      <div className="card tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Mã</th><th>Hàng</th><th className="num">Tồn</th><th className="num">Tối thiểu</th><th>NCC gần nhất</th><th></th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}><td>{p.code}</td><td>{p.name}</td><td className="num red b">{fmtQty(p.stock)} {p.base_unit}</td><td className="num">{fmtQty(p.min_stock)}</td>
                <td>{p.supplier}</td><td><Link className="btn" href={`/kho/nhap${p.supplier_id ? `?ncc=${p.supplier_id}` : ""}`}>Lập phiếu nhập</Link></td></tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="muted">Không có mặt hàng nào dưới mức tối thiểu</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SlowMoving({ days, db }: DBP & { days: number }) {
  const rows = slowMoving(db, days);
  return (
    <>
      <h2>R5 – Hàng tồn lâu không bán (≥ {days} ngày)</h2>
      <div className="card tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Mã</th><th>Hàng</th><th className="num">Tồn</th><th>Lần bán cuối</th><th className="num">Số ngày</th><th className="num">Giá trị tồn</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}><td>{p.code}</td><td>{p.name}</td><td className="num">{fmtQty(p.stock)} {p.base_unit}</td>
                <td>{p.last_sale ? fmtDate(p.last_sale) : <span className="muted">chưa bán lần nào</span>}</td>
                <td className="num">{p.idle_days}</td><td className="num">{fmtMoney(p.value)}</td>
                <td>{p.status === "ngung_nhap" ? <span className="badge gray">Ngừng nhập</span> : <span className="badge green">Đang bán</span>}</td>
                <td>{p.status !== "ngung_nhap" && <Link href={`/quan-tri/hang-hoa?id=${p.id}`}>Đánh dấu ngừng nhập</Link>}</td></tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="muted">Không có</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Diffs({ month, db }: DBP & { month: string }) {
  const rows = stocktakeDiffs(db, month);
  return (
    <>
      <h2>R6 – Chênh lệch kiểm kê {mLabel(month)}</h2>
      <div className="card tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Đợt</th><th>Ngày chốt</th><th>Kho</th><th>Hàng</th><th className="num">Sổ sách</th><th className="num">Thực tế</th><th className="num">Lệch</th><th className="num">Giá trị</th><th>Ghi chú</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}><td>{r.code}</td><td>{fmtDate(r.closed_at)}</td><td>{r.warehouse_name}</td><td>{r.product_code} – {r.product_name}</td>
                <td className="num">{fmtQty(r.book_qty)}</td><td className="num">{fmtQty(r.actual_qty)}</td>
                <td className={`num b ${r.diff < 0 ? "red" : "blue"}`}>{r.diff > 0 ? "+" : ""}{fmtQty(r.diff)} {r.base_unit}</td>
                <td className="num">{fmtMoney(r.diff_value)}</td><td>{r.note}</td></tr>
            ))}
            {!rows.length && <tr><td colSpan={9} className="muted">Không có chênh lệch trong kỳ</td></tr>}
          </tbody>
          <tfoot><tr><td colSpan={7} className="right">Tổng giá trị lệch</td><td className="num">{fmtMoney(rows.reduce((s, r) => s + r.diff_value, 0))}</td><td></td></tr></tfoot>
        </table>
      </div>
    </>
  );
}
