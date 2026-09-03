"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAccount, lookupEmail, normalizeEmail, safeNext, startSession } from "@/lib/email-signin";

export type AuthState = { error?: string; step?: "password" | "name"; email?: string };

/**
 * Email-only sign-in. Type your email and you're in — no password, no confirmation email.
 *  - Existing account → signed in. Admins who have set a password are asked for it.
 *  - Email on an admin's roster (pending_members) → account created and linked to the team.
 *  - Unknown email → asked for a name, account created, sent to onboarding (join code).
 *  - If the destination carries `?join=CODE`, the user is joined to that team first.
 */
export async function signIn(_: AuthState, formData: FormData): Promise<AuthState> {
  const email = normalizeEmail(formData.get("email"));
  const next = safeNext(formData.get("next"));
  if (!email) return { error: "Email is required" };

  const found = await lookupEmail(email);
  if (found.userId) {
    if (found.hasPassword) {
      const password = String(formData.get("password") ?? "");
      if (!password) return { step: "password", email };
      const supabase = await createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { step: "password", email, error: "Wrong password." };
      await joinFromLink(next);
      redirect(next);
    }
  } else {
    const fullName = found.pendingName || String(formData.get("full_name") ?? "").trim();
    if (!fullName) return { step: "name", email };
    const { error } = await createAccount(email, fullName);
    if (error) return { error };
  }

  const { error } = await startSession(email);
  if (error) return { error };
  await joinFromLink(next);
  redirect(next);
}

/** Links may carry ?join=CODE so newcomers land on the team without the onboarding step. */
async function joinFromLink(next: string) {
  const code = new URL(next, "http://x").searchParams.get("join");
  if (!code) return;
  const supabase = await createClient();
  await supabase.rpc("join_organization", { code }); // no-op if already a member; invalid codes just fall through to onboarding
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
