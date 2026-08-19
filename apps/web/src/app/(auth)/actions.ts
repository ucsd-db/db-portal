"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AuthState = { error?: string; step?: "password" | "name" };

/**
 * Email-only sign-in. Type your email and you're in — no password, no confirmation email.
 *  - Existing account → signed in. Admins who have set a password are asked for it.
 *  - Email on an admin's roster (pending_members) → account created and linked to the team.
 *  - Unknown email → asked for a name, account created, sent to onboarding (join code).
 *  - If the destination carries `?join=CODE` (shared form links), the user is joined to that team first.
 * Sessions are minted server-side with the service role (generateLink + verifyOtp), so nothing is emailed.
 */
export async function signIn(_: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = String(formData.get("next") || "/dashboard");
  if (!email) return { error: "Email is required" };
  const admin = createAdminClient();

  const { data: profile } = await admin.from("profiles").select("id").ilike("email", email).maybeSingle();
  if (profile) {
    const [{ data: adminRole }, { data: hasPassword }] = await Promise.all([
      admin.from("memberships").select("role").eq("user_id", profile.id).eq("role", "admin").limit(1).maybeSingle(),
      admin.rpc("user_has_password", { uid: profile.id }),
    ]);
    if (adminRole && hasPassword) {
      const password = String(formData.get("password") ?? "");
      if (!password) return { step: "password" };
      const supabase = await createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { step: "password", error: "Wrong password." };
      await joinFromLink(next);
      redirect(next);
    }
    return startSession(email, next);
  }

  // New account. Roster members are pre-named; everyone else tells us their name.
  const { data: pending } = await admin.from("pending_members").select("full_name").ilike("email", email).limit(1).maybeSingle();
  let fullName = pending?.full_name?.trim() ?? "";
  if (!fullName) {
    fullName = String(formData.get("full_name") ?? "").trim();
    if (!fullName) return { step: "name" };
  }
  const { error } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error) return { error: error.message };
  return startSession(email, next);
}

async function startSession(email: string, next: string): Promise<AuthState> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) return { error: error.message };
  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" });
  if (verifyError) return { error: verifyError.message };
  await joinFromLink(next);
  redirect(next);
}

/** Shared form links carry ?join=CODE so newcomers land on the team without the onboarding step. */
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
