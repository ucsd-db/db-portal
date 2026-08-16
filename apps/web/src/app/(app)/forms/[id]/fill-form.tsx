"use client";

import { useActionState } from "react";
import { submitForm, type SubmitState } from "./actions";
import AttendanceFields from "@/components/attendance-fields";
import { fmtDateTime } from "@/lib/format";
import type { Event, FormQuestion, PickupLocation, Rsvp } from "@/lib/database.types";

const Q = ({ title, required, help, children }: { title: React.ReactNode; required?: boolean; help?: string; children: React.ReactNode }) => (
  <div className="gf-card space-y-3">
    <div className="text-base font-normal">{title}{required && <span className="gf-required"> *</span>}</div>
    {help && <p className="text-xs whitespace-pre-wrap" style={{ color: "var(--g-grey-600)" }}>{help}</p>}
    {children}
  </div>
);

export default function FillForm({ formId, events, rsvpBy, questions, existingAnswers, pickups, defaultSeats, weightKg, submittedAt }: {
  formId: string; events: { prompt: string | null; event: Event }[]; rsvpBy: Record<string, Rsvp>; questions: FormQuestion[];
  existingAnswers: Record<string, unknown> | null; pickups: PickupLocation[]; defaultSeats: number | null; weightKg: number | null; submittedAt: string | null;
}) {
  const [state, action, pending] = useActionState<SubmitState, FormData>(submitForm, {});
  const a = (id: string) => existingAnswers?.[id];
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="form_id" value={formId} />

      <Q title="🏆 What's your current weight? (kg)" help="Coaches need this to make lineups. Leave as-is if unchanged — saved to your profile.">
        <input name="weight_kg" type="number" step="0.1" min={30} max={200} defaultValue={weightKg ?? ""} placeholder="Your answer" className="input-line w-1/2" />
      </Q>

      {events.map(({ event, prompt }, i) => (
        <Q key={event.id} required title={prompt || `${i % 2 ? "🌚" : "🌝"} Will you be attending ${event.title}?`}
          help={`${fmtDateTime(event.starts_at)}${event.location_name ? ` · 📍 ${event.location_name}` : ""}${event.notes ? `\n${event.notes}` : ""}`}>
          <AttendanceFields prefix={`ev_${event.id}_`} existing={rsvpBy[event.id] ?? null} pickups={pickups} defaultSeats={defaultSeats} />
        </Q>
      ))}

      {questions.map((q) => (
        <Q key={q.id} title={q.label} required={q.required} help={q.help}>
          {q.type === "short_text" && <input name={`q_${q.id}`} defaultValue={(a(q.id) as string) ?? ""} required={q.required} placeholder="Your answer" className="input-line w-1/2" />}
          {q.type === "long_text" && <textarea name={`q_${q.id}`} defaultValue={(a(q.id) as string) ?? ""} required={q.required} rows={2} placeholder="Your answer" className="input-line" />}
          {q.type === "number" && <input name={`q_${q.id}`} type="number" step="any" defaultValue={(a(q.id) as number) ?? ""} required={q.required} placeholder="Your answer" className="input-line w-1/3" />}
          {q.type === "yes_no" && (["yes", "no"] as const).map((v) => (
            <label key={v} className="gf-radio capitalize"><input type="radio" name={`q_${q.id}`} value={v} required={q.required} defaultChecked={a(q.id) === (v === "yes")} /> {v}</label>
          ))}
          {q.type === "single_choice" && (q.options ?? []).map((o) => (
            <label key={o} className="gf-radio"><input type="radio" name={`q_${q.id}`} value={o} required={q.required} defaultChecked={a(q.id) === o} /> {o}</label>
          ))}
          {q.type === "multi_choice" && (q.options ?? []).map((o) => (
            <label key={o} className="gf-radio"><input type="checkbox" name={`q_${q.id}`} value={o} defaultChecked={Array.isArray(a(q.id)) && (a(q.id) as string[]).includes(o)} /> {o}</label>
          ))}
        </Q>
      ))}

      {state.error && <p className="text-sm" style={{ color: "var(--g-red)" }}>{state.error}</p>}
      {state.saved && <div className="gf-card text-sm">✅ Your response has been recorded. You can resubmit any time before the form closes — the latest one counts.</div>}
      <div className="flex items-center justify-between pt-1">
        <button disabled={pending} className="btn-purple">{pending ? "Submitting…" : submittedAt ? "Update response" : "Submit"}</button>
        {submittedAt && !state.saved && <span className="text-xs" style={{ color: "var(--g-grey-600)" }}>Last submitted {fmtDateTime(submittedAt)}</span>}
      </div>
    </form>
  );
}
