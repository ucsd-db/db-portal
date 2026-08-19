"use client";

import { useActionState } from "react";
import { setPassword, type PasswordState } from "./actions";

export default function PasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(setPassword, {});
  return (
    <form action={action} className="card space-y-3 mt-4">
      <h2 className="font-semibold">Admin password</h2>
      <p className="text-sm text-slate-500">Members sign in with just their email. As an admin, set a password and you’ll be asked for it when signing in — so nobody can get into the admin panel by typing your email.</p>
      <div className="flex gap-2">
        <input name="password" type="password" minLength={8} required placeholder="New password (8+ characters)" className="input" />
        <button disabled={pending} className="btn-secondary whitespace-nowrap">{pending ? "Saving…" : "Set password"}</button>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.saved && <p className="text-sm text-green-700">Password set.</p>}
    </form>
  );
}
