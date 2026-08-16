"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, type AuthState } from "../actions";

export default function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, { error: initialError });
  return (
    <form action={action} className="space-y-4">
      <p className="text-center text-base -mt-2 mb-6">Sign in <span style={{ color: "var(--g-grey-600)" }}>to continue</span></p>
      <input type="hidden" name="next" value={next} />
      <input name="email" type="email" required placeholder="Email" className="input py-3" />
      <input name="password" type="password" required placeholder="Password" className="input py-3" />
      {state.error && <p className="text-sm" style={{ color: "var(--g-red)" }}>{state.error}</p>}
      <div className="flex items-center justify-between pt-2">
        <Link href="/signup" className="btn-text -ml-3">Create account</Link>
        <button disabled={pending} className="btn-primary">{pending ? "Signing in…" : "Next"}</button>
      </div>
    </form>
  );
}
