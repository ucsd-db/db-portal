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
    <div className="gf-page -m-4 md:-m-6 min-h-full p-4 md:p-8">
      <div className="mx-auto max-w-[640px] space-y-3">
        {form.status === "draft" && isAdmin && <p className="rounded bg-white/70 p-2 text-xs text-center" style={{ color: "var(--g-grey-600)" }}>Preview — this form is a draft and hidden from members. <Link href={`/admin/forms/${id}`} className="underline">Back to editor</Link></p>}
        <div className="gf-header">
          <h1 className="text-[32px] leading-tight font-normal">{form.title}</h1>
          {form.description && <div className="mt-3" style={{ color: "var(--g-grey-900)" }}><RichText text={form.description} /></div>}
          <div className="mt-4 pt-3 border-t text-sm flex flex-wrap gap-x-4 gap-y-1" style={{ borderColor: "var(--g-grey-300)" }}>
            {form.due_at && <span className={overdue ? "font-medium" : ""} style={{ color: overdue ? "var(--g-red)" : "var(--g-grey-600)" }}>‼ Due {fmtDateTime(form.due_at)}{overdue && " — past due"}</span>}
            <span style={{ color: "var(--g-grey-600)" }}>{profile.email}</span>
            <span className="gf-required">* Indicates required question</span>
          </div>
        </div>

        <div className="gf-card text-sm">
          <div className="flex items-center justify-between"><div className="font-medium text-base">Your info</div><Link href="/profile" className="btn-text -mr-3">Edit profile</Link></div>
          <p className="text-xs mb-2" style={{ color: "var(--g-grey-600)" }}>Pulled from your profile so we don’t ask every week.</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span>👤 {profile.full_name || "(no name)"}</span><span>📞 {profile.phone || "(no phone)"}</span>
            <span>⚖️ {profile.weight_kg ? `${profile.weight_kg} kg` : "(no weight)"}</span><span>🏠 {profile.address || "(no address)"}</span>
          </div>
          {(!profile.weight_kg || !profile.address) && <p className="mt-2 text-xs" style={{ color: "var(--g-red)" }}>Coaches need your weight for lineups and your address for rides — please add them.</p>}
        </div>

        {form.status === "open"
          ? <FillForm formId={id} events={events} rsvpBy={Object.fromEntries(rsvpBy)} questions={(form.questions as unknown as FormQuestion[]) ?? []}
              existingAnswers={(response?.answers as Record<string, unknown> | null) ?? null} pickups={pickups ?? []} defaultSeats={profile.car_seats} weightKg={profile.weight_kg}
              submittedAt={response?.submitted_at ?? null} />
          : <div className="gf-card text-sm" style={{ color: "var(--g-grey-600)" }}>
              {form.status === "closed" ? "This form is no longer accepting responses." : "This form isn’t open yet."}
              {response && <span> You responded {fmtDateTime(response.submitted_at)}.</span>}
            </div>}
        <p className="text-center text-xs pt-4" style={{ color: "var(--g-grey-600)" }}>{org.name} · Team Portal</p>
      </div>
    </div>
  );
}
