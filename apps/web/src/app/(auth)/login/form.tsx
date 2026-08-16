"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, type AuthState } from "../actions";

export default function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, { error: initialError });
  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-slate-500 mb-4">Sign in to your account</p>
      <input type="hidden" name="next" value={next} />
      <input name="email" type="email" required placeholder="Email" className="input" />
      <input name="password" type="password" required placeholder="Password" className="input" />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="btn-primary w-full">{pending ? "Signing in…" : "Sign in"}</button>
      <p className="text-sm text-slate-500">
        No account? <Link href="/signup" className="underline">Sign up</Link>
      </p>
    </form>
  );
}
