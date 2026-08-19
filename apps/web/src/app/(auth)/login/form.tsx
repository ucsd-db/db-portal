"use client";

import { useActionState } from "react";
import { signIn, type AuthState } from "../actions";

export default function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, { error: initialError });
  const grey = { color: "var(--g-grey-600)" };
  return (
    <form action={action} className="space-y-4">
      <p className="text-center text-base -mt-2 mb-6">Enter your email <span style={grey}>to continue</span></p>
      <input type="hidden" name="next" value={next} />
      <input name="email" type="email" required placeholder="Email" className="input py-3" readOnly={!!state.step} />
      {state.step === "password" && <>
        <p className="text-sm" style={grey}>This is an admin account — enter your password.</p>
        <input name="password" type="password" required autoFocus placeholder="Password" className="input py-3" />
      </>}
      {state.step === "name" && <>
        <p className="text-sm" style={grey}>Looks like you’re new here — what’s your name?</p>
        <input name="full_name" required autoFocus placeholder="Full name" className="input py-3" />
      </>}
      {state.error && <p className="text-sm" style={{ color: "var(--g-red)" }}>{state.error}</p>}
      <div className="flex items-center justify-end pt-2">
        <button disabled={pending} className="btn-primary">{pending ? "Signing in…" : "Next"}</button>
      </div>
    </form>
  );
}
