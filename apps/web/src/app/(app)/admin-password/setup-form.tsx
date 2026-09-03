"use client";

import { useEffect } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { setPassword, type PasswordState } from "../profile/actions";

export default function SetupForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState<PasswordState, FormData>(setPassword, {});
  useEffect(() => {
    if (state.saved) router.push("/admin");
  }, [state.saved, router]);
  return (
    <form action={action} className="card mt-6 space-y-3">
      <div className="flex gap-2">
        <input name="password" type="password" minLength={8} required autoFocus placeholder="New password (8+ characters)" className="input" />
        <button disabled={pending} className="btn-primary whitespace-nowrap">{pending ? "Saving…" : "Set password"}</button>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.saved && <p className="text-sm text-green-700">Password set — opening the admin panel…</p>}
    </form>
  );
}
