import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Email-only accounts. Nothing is emailed: sessions are minted server-side with the service role
 * (generateLink + verifyOtp) and land in the browser's cookies, so the browser is remembered.
 */

export type EmailLookup = {
  userId: string | null;
  /** Admin who has set a password — must sign in with it. */
  adminWithPassword: boolean;
  /** Name from an admin's roster (pending_members), if the email is on one. */
  pendingName: string;
};

export const normalizeEmail = (v: unknown) => String(v ?? "").trim().toLowerCase();

export async function lookupEmail(email: string): Promise<EmailLookup> {
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id").ilike("email", email).maybeSingle();
  if (profile) {
    const [{ data: adminRole }, { data: hasPassword }] = await Promise.all([
      admin.from("memberships").select("role").eq("user_id", profile.id).eq("role", "admin").limit(1).maybeSingle(),
      admin.rpc("user_has_password", { uid: profile.id }),
    ]);
    return { userId: profile.id, adminWithPassword: !!adminRole && !!hasPassword, pendingName: "" };
  }
  const { data: pending } = await admin.from("pending_members").select("full_name").ilike("email", email).limit(1).maybeSingle();
  return { userId: null, adminWithPassword: false, pendingName: pending?.full_name?.trim() ?? "" };
}

/** Creates the auth user (profile + roster claim happen via DB triggers). */
export async function createAccount(email: string, fullName: string): Promise<{ userId?: string; error?: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error) return { error: error.message };
  return { userId: data.user.id };
}

/** Signs the browser in as `email` (cookies set on the current response). Returns the now-authenticated client. */
export async function startSession(email: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) return { supabase: null, error: error.message };
  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" });
  if (verifyError) return { supabase: null, error: verifyError.message };
  return { supabase, error: undefined };
}
