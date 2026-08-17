"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string };

export async function signIn(_: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
  });
  if (error) return { error: error.message };
  redirect(String(formData.get("next") || "/dashboard"));
}

export async function signUp(_: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: String(formData.get("full_name")) }, emailRedirectTo: `${origin}/auth/callback` },
  });
  if (data.session) redirect("/dashboard");

  // Accounts are auto-confirmed by a DB trigger (see 0002_autoconfirm_email.sql), so even when
  // Supabase thinks a confirmation email is pending (or failed to send), a password sign-in works.
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (!signInError) redirect("/dashboard");

  if (error && !/confirmation|sending/i.test(error.message)) return { error: error.message };
  if (signInError.message.toLowerCase().includes("invalid")) return { error: "An account with this email already exists — sign in instead." };
  return { message: "Account created. Check your email to confirm, then sign in." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
