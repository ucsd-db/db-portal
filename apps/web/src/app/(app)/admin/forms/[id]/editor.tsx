"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FormQuestion, QuestionType } from "@/lib/database.types";
import { fmtDateTime } from "@/lib/format";
import { saveForm, type FormPayload } from "../actions";

type EventOpt = { id: string; title: string; kind: string; starts_at: string };
const TYPES: { value: QuestionType; label: string }[] = [
  { value: "single_choice", label: "Multiple choice (pick one)" },
  { value: "multi_choice", label: "Checkboxes (pick many)" },
  { value: "yes_no", label: "Yes / No" },
  { value: "short_text", label: "Short answer" },
  { value: "long_text", label: "Paragraph" },
  { value: "number", label: "Number" },
];
const uid = () => Math.random().toString(36).slice(2, 9);
const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

export default function FormEditor({ id, initial, events }: { id: string; initial: FormPayload; events: EventOpt[] }) {
  const router = useRouter();
  const [f, setF] = useState<FormPayload>(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof FormPayload>(k: K, v: FormPayload[K]) => setF((s) => ({ ...s, [k]: v }));

  const toggleEvent = (eid: string) => set("events", f.events.some((e) => e.event_id === eid) ? f.events.filter((e) => e.event_id !== eid) : [...f.events, { event_id: eid, prompt: null }]);
  const setPrompt = (eid: string, prompt: string) => set("events", f.events.map((e) => (e.event_id === eid ? { ...e, prompt: prompt || null } : e)));

  const addQ = () => set("questions", [...f.questions, { id: uid(), type: "single_choice", label: "", required: true, options: ["Yes", "No"] }]);
  const updQ = (qid: string, patch: Partial<FormQuestion>) => set("questions", f.questions.map((q) => (q.id === qid ? { ...q, ...patch } : q)));
  const delQ = (qid: string) => set("questions", f.questions.filter((q) => q.id !== qid));
  const moveQ = (i: number, d: -1 | 1) => { const a = [...f.questions]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; set("questions", a); };

  const save = (status = f.status) => start(async () => {
    const payload = { ...f, status, questions: f.questions.filter((q) => q.label.trim()) };
    const r = await saveForm(id, payload);
    if (r.error) { setMsg(r.error); return; }
    setF(payload); setMsg(status === "open" ? "Saved & open to members" : "Saved"); router.refresh();
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <section className="card space-y-3">
          <input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Form title (e.g. 🌷 Spring Week 8 Practice Form)" className="input text-lg font-semibold" />
          <textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={8} placeholder={"Description shown at the top. Emojis welcome 🐉\n\nMeetup times, reminders, who to DM, etc. Lines starting with http become links."} className="input font-mono text-sm" />
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><label className="label">Due</label><input type="datetime-local" value={toLocal(f.due_at)} onChange={(e) => set("due_at", e.target.value ? new Date(e.target.value).toISOString() : null)} className="input" /></div>
            <div><label className="label">Status</label>
              <select value={f.status} onChange={(e) => set("status", e.target.value as FormPayload["status"])} className="input"><option value="draft">Draft (hidden)</option><option value="open">Open (accepting responses)</option><option value="closed">Closed (read-only)</option></select></div>
          </div>
        </section>

        <section className="card space-y-2">
          <h2 className="font-semibold">Events on this form</h2>
          <p className="text-xs text-slate-500">Each checked event gets the standard “Will you be attending?” question (with driving / need-a-ride / pickup spot). Answers feed attendance, lineups and carpool.</p>
          {!events.length && <p className="text-sm text-amber-700">No upcoming events. Create them under Admin → Events first.</p>}
          <ul className="space-y-1">
            {events.map((ev) => {
              const on = f.events.find((e) => e.event_id === ev.id);
              return (
                <li key={ev.id} className={`rounded-md border px-3 py-2 text-sm ${on ? "border-sky-400 bg-sky-50" : "border-slate-200"}`}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!on} onChange={() => toggleEvent(ev.id)} />
                    <span className="font-medium">{ev.title}</span><span className="text-xs uppercase text-slate-400">{ev.kind}</span>
                    <span className="text-xs text-slate-500 ml-auto">{fmtDateTime(ev.starts_at)}</span>
                  </label>
                  {on && <input value={on.prompt ?? ""} onChange={(e) => setPrompt(ev.id, e.target.value)} placeholder={`Custom prompt (default: “Will you be attending ${ev.title}?”)`} className="input mt-2 text-xs" />}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card space-y-3">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Custom questions</h2><button type="button" onClick={addQ} className="btn-secondary py-1">+ Add question</button></div>
          {!f.questions.length && <p className="text-xs text-slate-500">e.g. “Do you want Costco pizza?”, “Do you have a PFD?”, “Questions/comments/concerns?”</p>}
          {f.questions.map((q, i) => (
            <div key={q.id} className="rounded-md border border-slate-200 p-3 space-y-2 text-sm">
              <div className="flex gap-2">
                <input value={q.label} onChange={(e) => updQ(q.id, { label: e.target.value })} placeholder="Question" className="input flex-1" />
                <select value={q.type} onChange={(e) => updQ(q.id, { type: e.target.value as QuestionType, options: ["single_choice", "multi_choice"].includes(e.target.value) ? (q.options?.length ? q.options : ["Option 1"]) : undefined })} className="input w-52">
                  {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <input value={q.help ?? ""} onChange={(e) => updQ(q.id, { help: e.target.value || undefined })} placeholder="Help text (optional)" className="input text-xs" />
              {(q.type === "single_choice" || q.type === "multi_choice") && (
                <div className="space-y-1">
                  {(q.options ?? []).map((o, oi) => (
                    <div key={oi} className="flex gap-1">
                      <input value={o} onChange={(e) => updQ(q.id, { options: q.options!.map((x, k) => (k === oi ? e.target.value : x)) })} className="input py-1" />
                      <button type="button" onClick={() => updQ(q.id, { options: q.options!.filter((_, k) => k !== oi) })} className="text-slate-400 hover:text-red-600 px-2">✕</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => updQ(q.id, { options: [...(q.options ?? []), ""] })} className="text-xs underline">+ option</button>
                </div>
              )}
              <div className="flex items-center gap-3 text-xs">
                <label className="flex items-center gap-1"><input type="checkbox" checked={!!q.required} onChange={(e) => updQ(q.id, { required: e.target.checked })} /> Required</label>
                <span className="flex-1" />
                <button type="button" onClick={() => moveQ(i, -1)} disabled={i === 0} className="disabled:opacity-30">↑</button>
                <button type="button" onClick={() => moveQ(i, 1)} disabled={i === f.questions.length - 1} className="disabled:opacity-30">↓</button>
                <button type="button" onClick={() => delQ(q.id)} className="text-red-600">Delete</button>
              </div>
            </div>
          ))}
        </section>
      </div>

      <aside className="card space-y-3 self-start text-sm sticky top-4">
        <h3 className="font-semibold">Publish</h3>
        <p className="text-xs text-slate-500">Members automatically get name, weight, phone and address from their profile — no need to ask again. They can update their weight while filling the form.</p>
        <button type="button" onClick={() => save()} disabled={pending} className="btn-secondary w-full">Save</button>
        {f.status !== "open" && <button type="button" onClick={() => save("open")} disabled={pending} className="btn-primary w-full">Save & open</button>}
        {f.status === "open" && <button type="button" onClick={() => save("closed")} disabled={pending} className="btn-secondary w-full">Close form</button>}
        {msg && <p className="text-xs text-green-700">{msg}</p>}
      </aside>
    </div>
  );
}
