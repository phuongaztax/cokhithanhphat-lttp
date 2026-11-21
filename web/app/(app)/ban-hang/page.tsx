import { requireUser, ACCESS } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { productCatalog, warehouses } from "@/lib/services/inventory";
import { customersMini } from "@/lib/services/master";
import SaleForm from "./SaleForm";

// W03 – Lập phiếu bán (UC03 + UC04 + UC05/UC06)
export default async function BanHangPage() {
  const user = await requireUser(ACCESS.banHang);
  const db = getDb();
  return (
    <>
      <h1>Lập phiếu bán</h1>
      <SaleForm catalog={productCatalog(db)} customers={customersMini(db)} warehouses={warehouses(db)} userName={user.full_name} />
    </>
  );
}
