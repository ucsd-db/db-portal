"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp, type AuthState } from "../actions";

export default function SignupPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, {});
  return (
    <form action={action} className="space-y-4">
      <p className="text-center text-base -mt-2 mb-6">Create your account</p>
      <input name="full_name" required placeholder="Full name" className="input py-3" />
      <input name="email" type="email" required placeholder="Email" className="input py-3" />
      <input name="password" type="password" required minLength={8} placeholder="Password (8+ characters)" className="input py-3" />
      {state.error && <p className="text-sm" style={{ color: "var(--g-red)" }}>{state.error}</p>}
      {state.message && <p className="text-sm" style={{ color: "var(--g-green)" }}>{state.message}</p>}
      <div className="flex items-center justify-between pt-2">
        <Link href="/login" className="btn-text -ml-3">Sign in instead</Link>
        <button disabled={pending} className="btn-primary">{pending ? "Creating…" : "Next"}</button>
      </div>
    </form>
  );
}
