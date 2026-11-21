"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ACCESS, can, getCurrentUser, login, logout, type Role, type User } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { BizError } from "@/lib/util";
import { createSale, createReturn, cancelSale, type SaleInput, type ReturnInput } from "@/lib/services/sales";
import { createPayment, createOpeningDebt } from "@/lib/services/debt";
import {
  createPurchase, createTransfer, createStocktake, saveCounts, closeStocktake, cancelPurchase, updatePurchasePrice,
  type PurchaseInput, type TransferInput,
} from "@/lib/services/warehouse";
import {
  saveProduct, saveCustomer, saveSupplier, saveUser, resetPassword,
  type ProductInput, type CustomerInput, type SupplierInput, type UserInput,
} from "@/lib/services/master";

export type ActionResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

async function guarded<T>(roles: Role[], fn: (u: User) => T): Promise<ActionResult<T>> {
  const u = await getCurrentUser();
  if (!u) return { ok: false, error: "Phiên đăng nhập đã hết, vui lòng đăng nhập lại" };
  if (!can(u, roles)) return { ok: false, error: "Bạn không có quyền thực hiện thao tác này" };
  try {
    const data = fn(u);
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (e) {
    if (e instanceof BizError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Lỗi hệ thống, vui lòng thử lại" };
  }
}

// ---------------------------------------------------------------- đăng nhập (UC00)
export type LoginState = { error: string; username: string } | null;

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const username = String(form.get("username") ?? "");
  try {
    await login(username, String(form.get("password") ?? ""));
  } catch (e) {
    // trả lại tên đăng nhập để form (bị React reset sau action) không bắt gõ lại
    return { error: e instanceof BizError ? e.message : "Lỗi hệ thống", username };
  }
  redirect("/");
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}

// ---------------------------------------------------------------- bán hàng
export async function saleAction(input: SaleInput) {
  return guarded(ACCESS.banHang, (u) => createSale(getDb(), u.id, input));
}

export async function returnAction(input: ReturnInput) {
  return guarded(ACCESS.banHang, (u) => createReturn(getDb(), u.id, input));
}

// ---------------------------------------------------------------- công nợ
export async function paymentAction(input: { customerId: number; amount: number; method: string; note?: string }) {
  return guarded(ACCESS.congNo, (u) => createPayment(getDb(), u.id, input));
}

export async function customerAction(input: CustomerInput) {
  return guarded(ACCESS.congNo, () => saveCustomer(getDb(), input));
}

// ---------------------------------------------------------------- kho
export async function purchaseAction(input: PurchaseInput) {
  return guarded(ACCESS.kho, (u) => createPurchase(getDb(), u.id, input));
}

export async function transferAction(input: TransferInput) {
  return guarded(ACCESS.kho, (u) => createTransfer(getDb(), u.id, input));
}

export async function newStocktakeAction(warehouseId: number, group: string) {
  return guarded(ACCESS.kho, (u) => createStocktake(getDb(), u.id, warehouseId, group || null));
}

export async function saveCountsAction(id: number, counts: { productId: number; actual: number | null; note?: string }[], close: boolean) {
  return guarded(ACCESS.kho, () => {
    const db = getDb();
    saveCounts(db, id, counts);
    return close ? closeStocktake(db, id) : null;
  });
}

// ---------------------------------------------------------------- quản trị
export async function productAction(input: ProductInput) {
  return guarded(ACCESS.quanTri, () => saveProduct(getDb(), input));
}

export async function supplierAction(input: SupplierInput) {
  return guarded(ACCESS.quanTri, () => saveSupplier(getDb(), input));
}

export async function userAction(input: UserInput) {
  return guarded(ACCESS.quanTri, (u) => saveUser(getDb(), input, u.id));
}

export async function resetPasswordAction(userId: number, pw: string) {
  return guarded(ACCESS.quanTri, () => resetPassword(getDb(), userId, pw));
}

// ---------------------------------------------------------------- sửa / hủy chứng từ (chủ cửa hàng)
export async function cancelSaleAction(saleId: number, reason: string) {
  return guarded(ACCESS.quanTri, (u) => cancelSale(getDb(), u.id, saleId, reason));
}

export async function cancelPurchaseAction(receiptId: number, reason: string) {
  return guarded(ACCESS.quanTri, (u) => cancelPurchase(getDb(), u.id, receiptId, reason));
}

export async function purchasePriceAction(itemId: number, price: number) {
  return guarded(ACCESS.quanTri, (u) => updatePurchasePrice(getDb(), u.id, itemId, price));
}

export async function openingDebtAction(input: { customerId: number; amount: number; date: string; note?: string }) {
  return guarded(ACCESS.quanTri, (u) => createOpeningDebt(getDb(), u.id, input));
}
