import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import LocalTime from "@/components/local-time";
import { fmtDateTime } from "@/lib/format";
import { toChoice, ATTENDANCE_OPTIONS } from "@/lib/attendance";
import type { FormQuestion, Profile, Rsvp } from "@/lib/database.types";
import ExportCsv from "./export-csv";
import { htmlToText } from "@/lib/html";
import FormTabs from "@/components/form-tabs";

const choiceLabel = Object.fromEntries(ATTENDANCE_OPTIONS.map((o) => [o.value, o.label.replace(/ [^\w\s]+$/u, "")]));

export default async function FormResponsesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { org } = await requireAdmin();
  const supabase = await createClient();
  const [{ data: form }, { data: links }, { data: responses }, { data: members }, { data: pickups }] = await Promise.all([
    supabase.from("forms").select("*").eq("id", id).eq("org_id", org.id).maybeSingle(),
    supabase.from("form_events").select("*, event:events(*)").eq("form_id", id).order("sort_order"),
    supabase.from("form_responses").select("*").eq("form_id", id),
    supabase.from("memberships").select("profile:profiles(*)").eq("org_id", org.id),
    supabase.from("pickup_locations").select("id, name").eq("org_id", org.id),
  ]);
  if (!form) notFound();
  const events = (links ?? []).map((l) => l.event).filter(Boolean) as { id: string; title: string; starts_at: string }[];
  const { data: rsvps } = events.length
    ? await supabase.from("rsvps").select("*").in("event_id", events.map((e) => e.id))
    : { data: [] as Rsvp[] };
  const rsvpBy = new Map<string, Rsvp>();
  for (const r of rsvps ?? []) rsvpBy.set(`${r.event_id}:${r.user_id}`, r);
  const pickupName = new Map((pickups ?? []).map((p) => [p.id, p.name]));
  const questions = ((form.questions as unknown as FormQuestion[]) ?? []);
  const profiles = (members ?? []).map((m) => m.profile as unknown as Profile).filter(Boolean).sort((a, b) => a.full_name.localeCompare(b.full_name));
  const respBy = new Map((responses ?? []).map((r) => [r.user_id, r]));
  const responded = profiles.filter((p) => respBy.has(p.id));
  const missing = profiles.filter((p) => !respBy.has(p.id));

  const rideCell = (r: Rsvp | undefined) => {
    if (!r) return "";
    const c = toChoice(r); let s = choiceLabel[c ?? ""] ?? "";
    if (r.ride === "driver") s += ` (${r.seats ?? "?"} seats)`;
    if (r.ride === "needs_ride") s += ` @ ${r.pickup_location_id ? pickupName.get(r.pickup_location_id) ?? "?" : r.pickup_address ?? "home"}`;
    if (r.note) s += ` — ${r.note}`;
    return s;
  };
  const ansCell = (uid: string, q: FormQuestion) => {
    const a = (respBy.get(uid)?.answers as Record<string, unknown> | null)?.[q.id];
    if (a == null || a === "") return "";
    if (Array.isArray(a)) return a.join(", ");
    if (typeof a === "boolean") return a ? "Yes" : "No";
    return htmlToText(String(a));
  };

  const header = ["Name", "Email", "Weight (lb)", "Phone", ...events.map((e) => e.title), ...questions.map((q) => q.label), "Submitted"];
  const rows = responded.map((p) => [p.full_name, p.email, p.weight_lb ?? "", p.phone ?? "", ...events.map((e) => rideCell(rsvpBy.get(`${e.id}:${p.id}`))), ...questions.map((q) => ansCell(p.id, q)), fmtDateTime(respBy.get(p.id)!.submitted_at)]);

  return (
    <div className="gf-page -m-4 md:-m-6 min-h-full p-4 md:p-6">
      <FormTabs id={id} responses={responded.length} joinCode={org.join_code} />
      <div className="mx-auto max-w-[1100px] space-y-3">
      <div className="gf-header flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-normal">{responded.length} responses <span className="text-sm" style={{ color: "var(--g-grey-600)" }}>of {profiles.length} members</span></h1>
          <p className="text-sm" style={{ color: "var(--g-grey-600)" }}>{form.title}{form.due_at && <> · due <LocalTime iso={form.due_at} /></>}</p>
        </div>
        <ExportCsv filename={`${form.title}.csv`} header={header} rows={rows.map((r) => r.map(String))} />
      </div>

      {events.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => {
            const rs = profiles.map((p) => rsvpBy.get(`${e.id}:${p.id}`)).filter(Boolean) as Rsvp[];
            const n = (f: (r: Rsvp) => boolean) => rs.filter(f).length;
            const seats = rs.filter((r) => r.ride === "driver").reduce((a, r) => a + (r.seats ?? 0), 0);
            return (
              <div key={e.id} className="gf-card !p-4 text-sm">
                <div className="font-medium"><Link href={`/events/${e.id}`} className="hover:underline">{e.title}</Link></div>
                <div className="text-xs text-slate-500"><LocalTime iso={e.starts_at} /></div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 text-xs">
                  <span>✅ Yes: <b>{n((r) => r.status === "yes")}</b></span><span>🤔 Maybe: {n((r) => r.status === "maybe")}</span>
                  <span>❌ No: {n((r) => r.status === "no")}</span><span>🙋 Need ride: <b>{n((r) => r.ride === "needs_ride")}</b></span>
                  <span>👑 Drivers: {n((r) => r.ride === "driver")}</span><span>💺 Seats: <b>{seats}</b></span>
                </div>
                <div className="mt-2 flex gap-3 text-xs"><Link href={`/admin/lineups?event=${e.id}`} className="underline">Lineups</Link><Link href={`/admin/carpool?event=${e.id}`} className="underline">Carpool</Link></div>
              </div>
            );
          })}
        </div>
      )}

      <div className="sheet-wrap">
        <div className="flex items-center gap-2 border-b px-3 py-2 text-xs" style={{ borderColor: "var(--g-grey-300)", background: "var(--g-green-soft)", color: "var(--g-green)" }}>
          <span className="font-medium">▦ Responses sheet</span><span style={{ color: "var(--g-grey-600)" }}>· one row per member, latest submission</span>
        </div>
        <table className="sheet">
          <thead><tr><th className="w-8 text-center">#</th>{header.map((h) => <th key={h} className="whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => <tr key={i}><td className="text-center" style={{ background: "var(--g-grey-100)", color: "var(--g-grey-600)" }}>{i + 1}</td>{r.map((c, j) => <td key={j} className="max-w-[240px] whitespace-pre-wrap">{String(c)}</td>)}</tr>)}
            {!rows.length && <tr><td colSpan={header.length + 1} className="p-3" style={{ color: "var(--g-grey-600)" }}>No responses yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="gf-card text-sm">
        <h3 className="font-medium mb-1">Haven’t responded ({missing.length})</h3>
        <p style={{ color: "var(--g-grey-600)" }}>{missing.map((p) => p.full_name || p.email).join(", ") || "Everyone has responded 🎉"}</p>
      </div>
      </div>
    </div>
  );
}
