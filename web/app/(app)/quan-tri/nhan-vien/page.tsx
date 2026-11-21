import Link from "next/link";
import { requireUser, ACCESS } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listUsers } from "@/lib/services/master";
import { ROLE_LABEL } from "@/lib/util";
import UserForm from "./UserForm";

// W12 – Quản lý nhân viên (UC19)
export default async function NhanVienPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  await requireUser(ACCESS.quanTri);
  const sp = await searchParams;
  const rows = listUsers(getDb());
  const sel = sp.id && sp.id !== "new" ? rows.find((u) => u.id === Number(sp.id)) : null;
  return (
    <>
      <h1>Nhân viên</h1>
      <div className="row"><span className="grow" /><Link className="btn" href="?id=new">+ Thêm nhân viên</Link></div>
      <div className="card tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Mã</th><th>Họ tên</th><th>Tài khoản</th><th>Vai trò</th><th>SĐT</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className={sel?.id === u.id ? "sel" : ""}>
                <td>{u.code}</td><td>{u.full_name}</td><td>{u.username}</td><td>{ROLE_LABEL[u.role]}</td><td>{u.phone}</td>
                <td>{u.active ? <span className="badge green">Hoạt động</span> : <span className="badge gray">Khóa</span>}</td>
                <td><Link href={`?id=${u.id}`}>Sửa</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(sel || sp.id === "new") && (
        <UserForm key={sp.id} initial={sel ? {
          id: sel.id, full_name: sel.full_name, username: sel.username, phone: sel.phone ?? "",
          role: sel.role as "ban_hang" | "thu_kho" | "chu", active: !!sel.active,
        } : null} />
      )}
    </>
  );
}
