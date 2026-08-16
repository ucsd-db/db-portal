import { notFound } from "next/navigation";
import Link from "next/link";
import { requireOrg } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/format";
import type { Event, FormQuestion, Rsvp } from "@/lib/database.types";
import FillForm from "./fill-form";
import RichText from "@/components/rich-text";

export default async function FormFillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { org, userId, profile, isAdmin } = await requireOrg();
  const supabase = await createClient();
  const [{ data: form }, { data: links }, { data: response }, { data: pickups }] = await Promise.all([
    supabase.from("forms").select("*").eq("id", id).eq("org_id", org.id).maybeSingle(),
    supabase.from("form_events").select("*, event:events(*)").eq("form_id", id).order("sort_order"),
    supabase.from("form_responses").select("*").eq("form_id", id).eq("user_id", userId).maybeSingle(),
    supabase.from("pickup_locations").select("*").eq("org_id", org.id).eq("active", true).order("sort_order"),
  ]);
  if (!form) notFound();
  const events = (links ?? []).map((l) => ({ prompt: l.prompt, event: l.event as unknown as Event })).filter((x) => x.event);
  const { data: rsvps } = events.length
    ? await supabase.from("rsvps").select("*").eq("user_id", userId).in("event_id", events.map((e) => e.event.id))
    : { data: [] as Rsvp[] };
  const rsvpBy = new Map((rsvps ?? []).map((r) => [r.event_id, r]));
  const overdue = form.due_at ? new Date(form.due_at) < new Date() : false;

  return (
    <div className="max-w-2xl space-y-4">
      {form.status === "draft" && isAdmin && <p className="rounded bg-amber-50 p-2 text-xs text-amber-700">Preview — this form is a draft and hidden from members.</p>}
      <div className="card">
        <h1 className="text-2xl font-bold">{form.title}</h1>
        {form.due_at && <p className={`text-sm mt-1 ${overdue ? "text-red-600" : "text-slate-600"}`}>‼ Due {fmtDateTime(form.due_at)}{overdue && " — past due"}</p>}
        {form.description && <div className="mt-3"><RichText text={form.description} /></div>}
      </div>

      <div className="card text-sm">
        <div className="flex items-center justify-between"><h2 className="font-semibold">Your info (from your profile)</h2><Link href="/profile" className="text-xs underline">Edit profile</Link></div>
        <div className="mt-1 grid grid-cols-2 gap-x-4 text-slate-700">
          <span>👤 {profile.full_name || "(no name)"}</span><span>📞 {profile.phone || "(no phone)"}</span>
          <span>⚖️ {profile.weight_kg ? `${profile.weight_kg} kg` : "(no weight)"}</span><span>🏠 {profile.address || "(no address)"}</span>
        </div>
        {(!profile.weight_kg || !profile.address) && <p className="mt-2 text-xs text-amber-700">Coaches need your weight for lineups and your address for rides — please fill them in.</p>}
      </div>

      {form.status === "open"
        ? <FillForm formId={id} events={events} rsvpBy={Object.fromEntries(rsvpBy)} questions={(form.questions as unknown as FormQuestion[]) ?? []}
            existingAnswers={(response?.answers as Record<string, unknown> | null) ?? null} pickups={pickups ?? []} defaultSeats={profile.car_seats} weightKg={profile.weight_kg}
            submittedAt={response?.submitted_at ?? null} />
        : <div className="card text-sm text-slate-600">
            {form.status === "closed" ? "This form is closed." : "This form isn’t open yet."}
            {response && <span> You responded {fmtDateTime(response.submitted_at)}.</span>}
          </div>}
    </div>
  );
}
