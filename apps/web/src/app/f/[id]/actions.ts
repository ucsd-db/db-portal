"use server";

import { redirect } from "next/navigation";
import { createAccount, lookupEmail, normalizeEmail, startSession } from "@/lib/email-signin";
import { saveResponse, type SubmitState } from "@/lib/save-response";

/**
 * Submit from a shared (anonymous) form link. Creates / links the account for the typed email,
 * signs the browser in, joins the team via the link's join code, then saves the response.
 */
export async function submitPublicForm(_: SubmitState, fd: FormData): Promise<SubmitState> {
  const email = normalizeEmail(fd.get("email"));
  const code = String(fd.get("join") ?? "");
  const formId = String(fd.get("form_id"));
  if (!email) return { error: "Please enter your email." };

  const found = await lookupEmail(email);
  let userId = found.userId;
  if (userId && found.adminWithPassword) return { error: "This is an admin account — please sign in with your password first." };
  if (!userId) {
    const fullName = found.pendingName || String(fd.get("full_name") ?? "").trim();
    if (!fullName) return { error: "Looks like you’re new — please enter your name so we can create your account." };
    const created = await createAccount(email, fullName);
    if (created.error) return { error: created.error };
    userId = created.userId!;
  }

  const { supabase, error } = await startSession(email);
  if (error || !supabase) return { error: error ?? "Could not sign you in." };
  const { error: joinError } = await supabase.rpc("join_organization", { code });
  if (joinError) return { error: "This link's team code is no longer valid." };

  const result = await saveResponse(supabase, userId, fd);
  if (result.error) return result;
  redirect(`/forms/${formId}?saved=1`);
}
