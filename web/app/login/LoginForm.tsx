"use client";

import { useActionState } from "react";
import { loginAction } from "../actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action}>
      {state && <div className="alert err">{state.error}</div>}
      <label htmlFor="username">Tên đăng nhập</label>
      <input id="username" name="username" autoComplete="username" required autoFocus={!state}
        defaultValue={state?.username ?? ""} key={state ? "u-" + state.username : "u"} />
      <label htmlFor="password">Mật khẩu</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus={!!state} />
      <button className="primary" disabled={pending}>{pending ? "Đang đăng nhập…" : "Đăng nhập"}</button>
    </form>
  );
}
