"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp, type AuthState } from "../actions";

export default function SignupPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, {});
  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-slate-500 mb-4">Create an account</p>
      <input name="full_name" required placeholder="Full name" className="input" />
      <input name="email" type="email" required placeholder="Email" className="input" />
      <input name="password" type="password" required minLength={8} placeholder="Password (8+ chars)" className="input" />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.message && <p className="text-sm text-green-700">{state.message}</p>}
      <button disabled={pending} className="btn-primary w-full">{pending ? "Creating…" : "Create account"}</button>
      <p className="text-sm text-slate-500">
        Have an account? <Link href="/login" className="underline">Sign in</Link>
      </p>
    </form>
  );
}
