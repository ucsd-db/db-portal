"use client";

import { useActionState } from "react";
import { submitForm, type SubmitState } from "./actions";
import AttendanceFields from "@/components/attendance-fields";
import { fmtDateTime } from "@/lib/format";
import type { Event, FormQuestion, PickupLocation, Rsvp } from "@/lib/database.types";

export default function FillForm({ formId, events, rsvpBy, questions, existingAnswers, pickups, defaultSeats, weightKg, submittedAt }: {
  formId: string; events: { prompt: string | null; event: Event }[]; rsvpBy: Record<string, Rsvp>; questions: FormQuestion[];
  existingAnswers: Record<string, unknown> | null; pickups: PickupLocation[]; defaultSeats: number | null; weightKg: number | null; submittedAt: string | null;
}) {
  const [state, action, pending] = useActionState<SubmitState, FormData>(submitForm, {});
  const a = (id: string) => existingAnswers?.[id];
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="form_id" value={formId} />

      <div className="card text-sm">
        <label className="label">⚖️ Current weight (kg) — coaches use this to balance the boat</label>
        <input name="weight_kg" type="number" step="0.1" min={30} max={200} defaultValue={weightKg ?? ""} placeholder="e.g. 65" className="input w-40" />
        <p className="text-xs text-slate-500 mt-1">Leave as-is if unchanged. Saved to your profile.</p>
      </div>

      {events.map(({ event, prompt }, i) => (
        <div key={event.id} className="card space-y-2">
          <div className="text-xs uppercase tracking-wide text-slate-400">{event.kind}</div>
          <h3 className="font-semibold">{prompt || `${i % 2 ? "🌚" : "🌝"} Will you be attending ${event.title}?`}</h3>
          <p className="text-sm text-slate-600">{fmtDateTime(event.starts_at)}{event.location_name && ` · 📍 ${event.location_name}`}</p>
          {event.notes && <p className="text-xs text-slate-500 whitespace-pre-wrap">{event.notes}</p>}
          <AttendanceFields prefix={`ev_${event.id}_`} existing={rsvpBy[event.id] ?? null} pickups={pickups} defaultSeats={defaultSeats} />
        </div>
      ))}

      {questions.map((q) => (
        <div key={q.id} className="card space-y-2 text-sm">
          <label className="font-semibold">{q.label}{q.required && <span className="text-red-500"> *</span>}</label>
          {q.help && <p className="text-xs text-slate-500">{q.help}</p>}
          {q.type === "short_text" && <input name={`q_${q.id}`} defaultValue={(a(q.id) as string) ?? ""} required={q.required} className="input" />}
          {q.type === "long_text" && <textarea name={`q_${q.id}`} defaultValue={(a(q.id) as string) ?? ""} required={q.required} rows={3} className="input" />}
          {q.type === "number" && <input name={`q_${q.id}`} type="number" step="any" defaultValue={(a(q.id) as number) ?? ""} required={q.required} className="input w-40" />}
          {q.type === "yes_no" && (
            <div className="flex gap-4">
              {(["yes", "no"] as const).map((v) => (
                <label key={v} className="flex items-center gap-1 capitalize"><input type="radio" name={`q_${q.id}`} value={v} required={q.required} defaultChecked={a(q.id) === (v === "yes")} /> {v}</label>
              ))}
            </div>
          )}
          {q.type === "single_choice" && (q.options ?? []).map((o) => (
            <label key={o} className="flex items-center gap-2"><input type="radio" name={`q_${q.id}`} value={o} required={q.required} defaultChecked={a(q.id) === o} /> {o}</label>
          ))}
          {q.type === "multi_choice" && (q.options ?? []).map((o) => (
            <label key={o} className="flex items-center gap-2"><input type="checkbox" name={`q_${q.id}`} value={o} defaultChecked={Array.isArray(a(q.id)) && (a(q.id) as string[]).includes(o)} /> {o}</label>
          ))}
        </div>
      ))}

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.saved && <p className="text-sm text-green-700">Submitted! You can resubmit any time before the form closes — latest wins.</p>}
      <button disabled={pending} className="btn-primary w-full">{pending ? "Submitting…" : submittedAt ? "Update my response" : "Submit"}</button>
      {submittedAt && !state.saved && <p className="text-center text-xs text-slate-500">You last submitted {fmtDateTime(submittedAt)}.</p>}
    </form>
  );
}
