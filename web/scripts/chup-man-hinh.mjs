/**
 * Chụp màn hình cho tài liệu hướng dẫn sử dụng (docs/huong-dan-su-dung.md → docs/hinh/*.jpg).
 *
 * Chạy trên một CSDL MẪU RIÊNG để không đụng dữ liệu thật:
 *   npm run build
 *   DB_FILE=<thư mục tạm>/hd.db npx next start -p 3457      (cửa sổ 1)
 *   node scripts/chup-man-hinh.mjs http://localhost:3457 ../docs/hinh   (cửa sổ 2)
 *
 * Cần Microsoft Edge hoặc Chrome (đặt EDGE_PATH nếu không ở vị trí mặc định).
 * Script thao tác như người dùng thật (đăng nhập, lập phiếu…) và đánh số đỏ các vị trí cần chú ý.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = process.argv[2] ?? "http://localhost:3457";
const OUT = path.resolve(process.argv[3] ?? "../docs/hinh");
const BROWSER = process.env.EDGE_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const W = 1280;
fs.mkdirSync(OUT, { recursive: true });

const prof = fs.mkdtempSync(path.join(os.tmpdir(), "chup-"));
const browser = spawn(BROWSER, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--remote-debugging-port=9335",
  `--user-data-dir=${prof}`, `--window-size=${W},900`, "--lang=vi-VN", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ CDP tối giản
let ws, seq = 0;
const pending = new Map();
async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch("http://127.0.0.1:9335/json")).json();
      const page = list.find((t) => t.type === "page");
      if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); break; }
    } catch { /* trình duyệt chưa sẵn sàng */ }
    await sleep(250);
  }
  await new Promise((r) => ws.addEventListener("open", r));
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
}
const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });

// Hàm trợ giúp chạy trong trang
const HELPERS = `
function setV(el, v){ if(typeof el==='string') el=document.querySelector(el); const p=Object.getPrototypeOf(el);
  Object.getOwnPropertyDescriptor(p,'value').set.call(el,v); el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true})); }
function btn(t, root=document){ return [...root.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith(t)); }
function link(t, root=document){ return [...root.querySelectorAll('a')].find(a=>a.textContent.trim().startsWith(t)); }
function fs(t){ return [...document.querySelectorAll('fieldset')].find(f=>f.querySelector('legend')?.textContent.includes(t)); }
function selOpt(sel, text){ if(typeof sel==='string') sel=document.querySelector(sel); const o=[...sel.options].find(o=>o.text.includes(text)); if(o) setV(sel,o.value); return !!o; }
function mark(el, n){ if(typeof el==='string') el=document.querySelector(el); if(!el) return false;
  // vẽ khung bằng lớp phủ (không bị cắt bởi vùng cuộn, dùng được cho cả dòng bảng)
  const r=el.getBoundingClientRect(); const pad=4;
  const box=document.createElement('div'); box.className='__mk';
  Object.assign(box.style,{position:'absolute',left:(r.left+scrollX-pad)+'px',top:(r.top+scrollY-pad)+'px',width:(r.width+pad*2)+'px',
    height:(r.height+pad*2)+'px',border:'3px solid #ff3b30',borderRadius:'8px',pointerEvents:'none',zIndex:99998,boxSizing:'border-box'});
  const b=document.createElement('div'); b.className='__mk'; b.textContent=n;
  Object.assign(b.style,{position:'absolute',left:Math.max(2,r.left+scrollX-16)+'px',top:Math.max(2,r.top+scrollY-16)+'px',width:'26px',height:'26px',
    borderRadius:'50%',background:'#ff3b30',color:'#fff',font:'bold 14px system-ui',display:'flex',alignItems:'center',
    justifyContent:'center',zIndex:99999,boxShadow:'0 2px 8px rgba(0,0,0,.45)',border:'2px solid #fff',pointerEvents:'none'});
  document.body.appendChild(box); document.body.appendChild(b); return true; }
function clearMarks(){ document.querySelectorAll('.__mk').forEach(x=>x.remove()); }
`;
async function ev(expr) {
  const r = await send("Runtime.evaluate", { expression: `{${HELPERS};${expr};}`, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(`Lỗi trong trang: ${r.result.exceptionDetails.exception?.description ?? JSON.stringify(r.result.exceptionDetails)}\n  ↳ ${expr.slice(0, 160)}`);
  return r.result?.result?.value;
}
async function waitIdle() {
  await sleep(350);
  for (let i = 0; i < 50; i++) { if ((await ev("document.readyState")) === "complete") break; await sleep(150); }
  await sleep(450);
}
const go = async (url) => { await send("Page.navigate", { url: BASE + url }); await waitIdle(); };
const click = async (expr) => { await ev(`(${expr}).click()`); await sleep(2200); await waitIdle(); };
let shots = 0;
async function shot(name, maxH = 1500) {
  await ev("window.scrollTo(0,0)");
  const h = Math.min(await ev("document.documentElement.scrollHeight"), maxH);
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: h, deviceScaleFactor: 1, mobile: false });
  await sleep(250);
  const r = await send("Page.captureScreenshot", { format: "jpeg", quality: 85 });
  fs.writeFileSync(path.join(OUT, name + ".jpg"), Buffer.from(r.result.data, "base64"));
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: 900, deviceScaleFactor: 1, mobile: false });
  await ev("clearMarks()");
  shots++;
  console.log("  📷", name);
}
async function login(u, pw) {
  await send("Network.clearBrowserCookies");
  await go("/login");
  await ev(`setV('#username','${u}'); setV('#password','${pw}'); document.querySelector('form button').click()`);
  await sleep(2500); await waitIdle();
  if ((await ev("location.pathname")) !== "/") throw new Error(`Đăng nhập ${u} thất bại`);
}
const autoDialogs = (reply = "") => ev(`window.confirm=()=>true; window.prompt=()=>${JSON.stringify(reply)}; window.print=()=>{}`);

// ------------------------------------------------------------------ kịch bản
try {
  await connect();
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: 900, deviceScaleFactor: 1, mobile: false });

  console.log("Chung");
  await send("Network.clearBrowserCookies");
  await go("/login");
  await ev(`setV('#username','nv_lan'); setV('#password','123456'); mark('#username',1); mark('#password',2); mark('form button',3)`);
  await shot("01-dang-nhap", 900);
  await login("nv_lan", "123456");
  await ev(`mark('.nav',1); mark(document.querySelector('main .btn.primary').parentElement,2); mark('.stats',3); mark(fs('Cảnh báo'),4); mark(btn('Đăng xuất'),5)`);
  await shot("02-trang-chinh", 900);
  const r = await ev(`JSON.stringify([...document.querySelectorAll('.nav .group > span')].find(s=>s.textContent.includes('Bán hàng')).getBoundingClientRect())`);
  const box = JSON.parse(r);
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x + box.width / 2, y: box.y + box.height / 2 });
  await sleep(400);
  await ev(`mark([...document.querySelectorAll('.nav .menu')].find(m=>getComputedStyle(m).display!=='none'),1)`);
  await shot("03-menu", 600);
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 5, y: 600 });

  console.log("Nhân viên bán hàng");
  await go("/tra-cuu?q=OC");
  await ev(`document.querySelector('tbody tr').click()`); await sleep(400);
  await ev(`mark('form.card',1); mark(document.querySelector('tbody tr'),2); mark('td.detail-row',3); mark(btn('+ Báo giá'),4)`);
  await shot("04-tra-cuu");
  await ev(`sessionStorage.clear()`);
  await go("/tra-cuu?q=");
  await ev(`const rows=[...document.querySelectorAll('tbody tr')]; btn('+ Báo giá', rows.find(r=>r.textContent.includes('OC010'))).click()`); await sleep(300);
  await ev(`const rows=[...document.querySelectorAll('tbody tr')]; btn('+ Báo giá', rows.find(r=>r.textContent.includes('KB200'))).click()`); await sleep(300);
  await ev(`selOpt(fs('Phiếu báo giá').querySelector('select'),'Anh Tư')`); await sleep(300);
  await ev(`const t=fs('Phiếu báo giá').querySelector('tbody tr'); setV(t.querySelector('input'),'5'); setV(t.querySelector('select'),'kg')`); await sleep(300);
  await ev(`const f=fs('Phiếu báo giá'); f.scrollIntoView(); mark(f.querySelector('select'),1); mark(f.querySelector('table'),2); mark(btn('In báo giá'),3); mark(btn('Chuyển thành phiếu bán'),4)`);
  await shot("05-bao-gia", 2000);
  await click(`btn('Chuyển thành phiếu bán')`);
  // W03 – phiếu bán nhận từ báo giá, thêm 1 món nữa
  await ev(`setV('input[list]','DD025')`); await sleep(400);
  await ev(`const f=fs('Thêm hàng'); setV(f.querySelector('input[type=number]'),'20')`); await sleep(200);
  await ev(`mark(fs('Khách hàng').querySelector('.row'),1); mark(fs('Thêm hàng').querySelector('input[list]'),2); mark(fs('Thêm hàng').querySelector('input[type=number]'),3); mark(fs('Thêm hàng').querySelectorAll('select')[0],4); mark(btn('Thêm'),5)`);
  await shot("06-phieu-ban-them-hang", 900);
  await ev(`btn('Thêm').click()`); await sleep(400);
  await ev(`setV(document.querySelector('.totals input'),'4000')`); await sleep(300);
  await ev(`mark(document.querySelector('.card.tbl-wrap table'),1); mark('.totals input',2); mark(fs('Thanh toán'),3); mark(btn('Lưu & In'),4)`);
  await shot("07-phieu-ban-thanh-toan");
  await autoDialogs();
  await click(`btn('Lưu & In')`);
  const saleCode = await ev(`document.querySelector('.alert')?.textContent.match(/PB-[\\d-]+/)?.[0]`);
  await ev(`mark('.alert',1); mark(btn('In'),2); mark(document.querySelector('.actions a[href^="/tra-hang"]'),3)`);
  await shot("08-phieu-ban-da-luu");
  await go("/ban-hang/danh-sach");
  await ev(`mark(document.querySelector('tbody tr a'),1); mark(document.querySelector('tbody tr td:nth-child(5)'),2)`);
  await shot("09-danh-sach-phieu-ban", 900);

  await go("/tra-hang");
  await ev(`setV('input[name=code]','${saleCode}'); mark('form.card',1)`);
  await shot("10-tra-hang-tim-phieu", 600);
  await go("/tra-hang?code=" + saleCode);
  await ev(`const r=document.querySelector('.card.tbl-wrap tbody tr'); r.querySelector('input[type=checkbox]').click()`); await sleep(300);
  await ev(`const r=document.querySelector('.card.tbl-wrap tbody tr'); setV(r.querySelector('input[type=number]'),'1'); r.querySelectorAll('input[type=checkbox]')[1].click()`); await sleep(300);
  await ev(`setV(document.querySelector('.card.tbl-wrap input.grow'),'Mua dư')`); await sleep(200);
  await ev(`const r=document.querySelector('.card.tbl-wrap tbody tr'); mark(r.querySelector('input[type=checkbox]'),1); mark(r.querySelector('input[type=number]'),2); mark(r.querySelectorAll('label.inline')[0],3); mark('.card.tbl-wrap input.grow',4); mark(fs('Xử lý tiền'),5); mark(btn('Lưu phiếu trả'),6)`);
  await shot("11-tra-hang");
  await click(`btn('Lưu phiếu trả')`);

  await go("/khach-hang?id=new");
  await ev(`const f=fs('Thêm khách hàng'); const i=f.querySelectorAll('input'); setV(i[0],'Anh Năm (thầu điện)'); setV(i[1],'0903xxx555'); setV(i[2],'Hòa Khánh, Liên Chiểu')`);
  await ev(`const f=fs('Thêm khách hàng'); setV(f.querySelector('input[type=number]'),'20000000')`); await sleep(200);
  await ev(`mark('form.card',1); mark(link('+ Thêm khách'),2); mark(fs('Thêm khách hàng'),3); mark(btn('Lưu'),4)`);
  await shot("12-khach-hang");
  await click(`btn('Lưu')`);
  const namId = Number(await ev(`new URLSearchParams(location.search).get('id')`));

  await go("/cong-no?kh=2");
  await ev(`mark('form.card',1); mark('.stats',2); mark('.card.tbl-wrap table',3); mark(link('Thu nợ khách này'),4)`);
  await shot("13-tra-cuu-cong-no", 1100);
  await go("/cong-no?kh=2&thu=1");
  await ev(`const f=fs('Thu nợ'); f.scrollIntoView(); setV(f.querySelector('input[type=number]'),'1000000')`); await sleep(300);
  await ev(`const f=fs('Thu nợ'); mark(f.querySelector('input[type=number]'),1); mark(f.querySelector('select'),2); mark(f.querySelectorAll('input')[1],3); mark(btn('Lưu phiếu thu'),4)`);
  await ev(`window.scrollTo(0, document.body.scrollHeight)`);
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: 900, deviceScaleFactor: 1, mobile: false });
  {
    // chỉ chụp phần hộp thoại thu nợ
    const rect = JSON.parse(await ev(`const r=fs('Thu nợ').getBoundingClientRect(); JSON.stringify({x:0,y:r.top+scrollY-40,w:${W},h:r.height+80})`));
    const res = await send("Page.captureScreenshot", { format: "jpeg", quality: 85, captureBeyondViewport: true, clip: { x: 0, y: rect.y, width: rect.w, height: rect.h, scale: 1 } });
    fs.writeFileSync(path.join(OUT, "14-thu-no.jpg"), Buffer.from(res.result.data, "base64")); shots++; console.log("  📷 14-thu-no");
    await ev("clearMarks()");
  }
  await click(`btn('Lưu phiếu thu')`);
  await go("/cong-no?tab=ds");
  await ev(`mark('.tabs a:nth-child(2)',1); mark('.card.tbl-wrap table',2)`);
  await shot("15-khach-dang-no", 900);

  console.log("Thủ kho");
  await login("tk_binh", "123456");
  await go("/kho/nhap");
  await ev(`selOpt(document.querySelector('.card select'),'Cadivi')`); await sleep(200);
  await ev(`setV('input[list]','DD015')`); await sleep(400);
  await ev(`const f=fs('Thêm hàng'); setV(f.querySelector('input[type=number]'),'3')`); await sleep(200);
  await ev(`mark(document.querySelector('.card .row:nth-child(2)'),1); mark(fs('Thêm hàng').querySelector('input[list]'),2); mark(fs('Thêm hàng').querySelectorAll('input[type=number]')[0],3); mark(fs('Thêm hàng').querySelectorAll('input[type=number]')[1],4); mark(fs('Thêm hàng').querySelector('p.note'),5); mark(btn('Thêm'),6)`);
  await shot("16-phieu-nhap-them", 900);
  await ev(`btn('Thêm').click()`); await sleep(300);
  await ev(`setV('input[list]','OC011')`); await sleep(400);
  await ev(`const f=fs('Thêm hàng'); setV(f.querySelector('input[type=number]'),'5'); btn('Thêm').click()`); await sleep(400);
  await ev(`mark(document.querySelectorAll('.card.tbl-wrap table')[0],1); mark(btn('Lưu phiếu nhập'),2)`);
  await shot("17-phieu-nhap-luu", 1100);
  await click(`btn('Lưu phiếu nhập')`);
  await ev(`mark('.alert',1); mark(document.querySelectorAll('.card.tbl-wrap')[1].querySelector('tbody tr a'),2)`);
  await shot("18-phieu-nhap-da-luu", 1500);

  await go("/kho/kiem-ke");
  await ev(`const f=fs('Tạo đợt kiểm kê'); selOpt(f.querySelectorAll('select')[1],'Ốc vít')`); await sleep(200);
  await ev(`const f=fs('Tạo đợt kiểm kê'); mark(f.querySelectorAll('select')[0],1); mark(f.querySelectorAll('select')[1],2); mark(btn('Tải danh sách'),3); mark(document.querySelectorAll('.card.tbl-wrap tbody tr')[0],4)`);
  await shot("19-kiem-ke-tao-dot", 900);
  await click(`btn('Tải danh sách')`);
  await ev(`const rows=[...document.querySelectorAll('.card.tbl-wrap tbody tr')];
    rows.forEach((r,i)=>{ const book=Number(r.children[3].textContent.replace(/\\./g,'').replace(',','.')); const inp=r.querySelector('input[type=number]');
      setV(inp, String(i===0 ? book-3 : book)); if(i===0) setV(r.querySelectorAll('input')[1],'Rơi vãi 3 con'); })`); await sleep(400);
  await ev(`const r=document.querySelector('.card.tbl-wrap tbody tr'); mark(r.querySelector('input[type=number]'),1); mark(r.children[5],2); mark(r.querySelectorAll('input')[1],3); mark(btn('Lưu tạm'),4); mark(btn('Chốt kiểm kê'),5)`);
  await shot("20-kiem-ke-dem", 900);
  await autoDialogs();
  await click(`btn('Chốt kiểm kê')`);
  await ev(`mark('.alert',1); mark(document.querySelector('.card .badge'),2)`);
  await shot("21-kiem-ke-chot", 900);

  await go("/kho/chuyen-kho");
  await ev(`const s=fs('Thêm hàng').querySelector('select'); const o=[...s.options].filter(o=>o.text.includes('OC010')).at(-1); setV(s,o.value)`); await sleep(400);
  await ev(`const f=fs('Thêm hàng'); setV(f.querySelector('input[type=number]'),'2'); selOpt(f.querySelectorAll('select')[1],'kg')`); await sleep(300);
  await ev(`const f=fs('Thêm hàng'); mark(document.querySelector('.card .row:nth-child(2)'),1); mark(f.querySelector('select'),2); mark(f.querySelector('input[type=number]'),3); mark(f.querySelectorAll('select')[1],4); mark(btn('Thêm'),5)`);
  await shot("22-chuyen-kho-chon-lo", 700);
  await ev(`btn('Thêm').click()`); await sleep(400);
  await ev(`mark(document.querySelectorAll('.card.tbl-wrap table')[0],1); mark(btn('Lưu phiếu chuyển'),2)`);
  await shot("23-chuyen-kho-luu", 900);
  await click(`btn('Lưu phiếu chuyển')`);

  console.log("Chủ cửa hàng");
  await login("admin", "admin123");
  await ev(`mark('.nav',1)`);
  await shot("24-trang-chinh-chu", 900);
  await go("/quan-tri/hang-hoa?q=OC010");
  await click(`link('Sửa', document.querySelector('.card.tbl-wrap tbody tr'))`);
  await ev(`mark(document.querySelector('tr.sel'),1); mark(fs('Thông tin hàng'),2); mark(fs('Đơn vị tính').querySelector('table'),3); mark(btn('+ Thêm đơn vị'),4); mark(btn('Lưu'),5)`);
  await shot("25-hang-hoa", 1500);
  await go("/quan-tri/nha-cung-cap?id=1");
  await ev(`mark(fs('Thông tin nhà cung cấp'),1); mark(fs('Lịch sử phiếu nhập'),2); mark(document.querySelector('fieldset a[href^="/kho/nhap?ncc"]'),3)`);
  await shot("26-nha-cung-cap", 1100);
  await go("/quan-tri/nhan-vien?id=new");
  await ev(`const f=fs('Thêm nhân viên'); const i=f.querySelectorAll('input'); setV(i[0],'Võ Thị Hạnh'); setV(i[1],'0977xxx111'); setV(i[2],'nv_hanh'); setV(i[3],'hanh2026')`); await sleep(200);
  await ev(`mark(link('+ Thêm nhân viên'),1); mark(fs('Thêm nhân viên'),2); mark(fs('Thêm nhân viên').querySelector('select'),3); mark(btn('Lưu'),4)`);
  await shot("27-nhan-vien", 1100);

  await go("/bao-cao?tab=lai-lo");
  await ev(`mark('.tabs',1); mark('form.row input[type=month]',2); mark('.stats',3); mark('.card.tbl-wrap table',4)`);
  await shot("28-bao-cao-lai-lo", 900);
  await go("/bao-cao?tab=doanh-so"); await ev(`mark('.card.tbl-wrap table',1)`); await shot("29-bao-cao-doanh-so", 700);
  await go("/bao-cao?tab=sap-het"); await ev(`mark(link('Lập phiếu nhập', document.querySelector('.card')),1)`); await shot("30-bao-cao-sap-het", 900);
  await go("/bao-cao?tab=ton-lau"); await ev(`mark('form.row select',1); mark(document.querySelector('.card tbody tr'),2)`); await shot("31-bao-cao-ton-lau", 700);
  await go("/bao-cao?tab=kiem-ke"); await ev(`mark('.card.tbl-wrap table',1)`); await shot("32-bao-cao-kiem-ke", 900);
  await go("/bao-cao?tab=cong-no"); await shot("33-bao-cao-cong-no", 900);

  // UC22 – hủy phiếu bán tiền mặt
  await go("/ban-hang/danh-sach");
  const cashHref = await ev(`[...document.querySelectorAll('tbody tr')].find(r=>r.textContent.includes('Tiền mặt'))?.querySelector('a')?.getAttribute('href')`);
  await go(cashHref);
  await ev(`mark(btn('Hủy phiếu'),1)`);
  await shot("34-huy-phieu-ban", 1100);
  await autoDialogs("Lập nhầm khách");
  await click(`btn('Hủy phiếu')`);
  await ev(`mark('.alert',1)`);
  await shot("35-phieu-ban-da-huy", 1100);

  // UC23 – sửa giá / hủy phiếu nhập (phiếu thủ kho vừa lập)
  await go("/kho/nhap");
  const ph = await ev(`document.querySelectorAll('.card.tbl-wrap')[1].querySelector('tbody tr a').getAttribute('href')`);
  await go(ph);
  await ev(`mark(document.querySelector('button.link'),1); mark(btn('Hủy phiếu'),2)`);
  await shot("36-phieu-nhap-chi-tiet", 900);
  await ev(`document.querySelector('button.link').click()`); await sleep(300);
  await ev(`const i=document.querySelector('td input[type=number]'); setV(i, String(Number(i.value)+20000)); mark(i.parentElement,1)`);
  await shot("37-sua-gia-nhap", 900);
  await autoDialogs();
  await click(`btn('Lưu')`);
  await ev(`mark(fs('Lịch sử chỉnh sửa'),1)`);
  await shot("38-lich-su-chinh-sua", 1100);

  // UC24 – nợ đầu kỳ cho khách thầu mới
  await go(`/cong-no?kh=${namId}`);
  await ev(`const f=fs('Ghi nợ đầu kỳ'); f.scrollIntoView(); selOpt(f.querySelector('select'),'Anh Năm'); setV(f.querySelector('input[type=number]'),'3500000'); setV(f.querySelector('input[type=date]'),'2026-09-15')`); await sleep(300);
  await ev(`const f=fs('Ghi nợ đầu kỳ'); mark(f.querySelector('select'),1); mark(f.querySelector('input[type=number]'),2); mark(f.querySelector('input[type=date]'),3); mark(btn('Ghi nợ đầu kỳ'),4)`);
  {
    const rect = JSON.parse(await ev(`const r=fs('Ghi nợ đầu kỳ').getBoundingClientRect(); JSON.stringify({y:r.top+scrollY-40,h:r.height+80})`));
    const res = await send("Page.captureScreenshot", { format: "jpeg", quality: 85, captureBeyondViewport: true, clip: { x: 0, y: rect.y, width: W, height: rect.h, scale: 1 } });
    fs.writeFileSync(path.join(OUT, "39-no-dau-ky.jpg"), Buffer.from(res.result.data, "base64")); shots++; console.log("  📷 39-no-dau-ky");
    await ev("clearMarks()");
  }
  await autoDialogs();
  await ev(`btn('Ghi nợ đầu kỳ').click()`); await sleep(2500); await waitIdle();
  await go(`/cong-no?kh=${namId}&from=2026-09-01`);
  await ev(`mark('.card.tbl-wrap tbody tr',1); mark('.stats',2)`);
  await shot("40-no-dau-ky-so-cong-no", 900);

  console.log(`\n✓ Đã chụp ${shots} ảnh vào ${OUT}`);
} catch (e) {
  console.error("✗", e.message ?? e);
  process.exitCode = 1;
} finally {
  try { ws?.close(); } catch { /* bỏ qua */ }
  browser.kill();
}
