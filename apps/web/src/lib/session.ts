import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Membership, Organization, Profile } from "@/lib/database.types";

export type Session = {
  userId: string;
  profile: Profile;
  membership: (Membership & { organization: Organization }) | null;
  isAdmin: boolean;
};

/** Loads user + profile + first org membership. Redirects to /login if signed out. */
export const getSession = cache(async (): Promise<Session> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("memberships")
      .select("*, organization:organizations(*)")
      .eq("user_id", user.id)
      .order("created_at")
      .limit(1)
      .maybeSingle(),
  ]);
  if (!profile) redirect("/login");

  const m = membership as (Membership & { organization: Organization }) | null;
  return { userId: user.id, profile, membership: m, isAdmin: m?.role === "admin" };
});

/** Like getSession, but requires an org; sends to onboarding otherwise. */
export async function requireOrg() {
  const s = await getSession();
  if (!s.membership) redirect("/onboarding");
  return { ...s, membership: s.membership, org: s.membership.organization };
}

export async function requireAdmin() {
  const s = await requireOrg();
  if (!s.isAdmin) redirect("/dashboard");
  return s;
}
