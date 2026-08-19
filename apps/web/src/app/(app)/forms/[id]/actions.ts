"use server";

import { createClient } from "@/lib/supabase/server";
import { saveResponse, type SubmitState } from "@/lib/save-response";

export type { SubmitState };

export async function submitForm(_: SubmitState, fd: FormData): Promise<SubmitState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  return saveResponse(supabase, user.id, fd);
}
