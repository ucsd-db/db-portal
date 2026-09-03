import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export const RATE_LIMIT_MSG = "Too many attempts — please wait a bit and try again.";

/**
 * Fixed-window limiter backed by Postgres (migration 0016) — free tier, shared
 * across serverless instances. Fails OPEN: an outage shouldn't lock the team out.
 */
export async function allowRate(key: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient().rpc("hit_rate_limit", {
      p_key: key,
      p_max: max,
      p_window: `${windowSeconds} seconds`,
    });
    if (error) {
      console.error("rate limit check failed:", error.message);
      return true;
    }
    return !!data;
  } catch (e) {
    console.error("rate limit check failed:", e);
    return true;
  }
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}
