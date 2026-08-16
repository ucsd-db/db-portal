"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { FormQuestion, QuestionType } from "@/lib/database.types";
import { fmtDateTime } from "@/lib/format";
import { deleteForm, saveForm, type FormPayload } from "../actions";

type EventOpt = { id: string; title: string; kind: string; starts_at: string };
const TYPES: { value: QuestionType; label: string; icon: string }[] = [
  { value: "single_choice", label: "Multiple choice", icon: "◉" },
  { value: "multi_choice", label: "Checkboxes", icon: "☑" },
  { value: "yes_no", label: "Yes / No", icon: "◑" },
  { value: "short_text", label: "Short answer", icon: "―" },
  { value: "long_text", label: "Paragraph", icon: "☰" },
  { value: "number", label: "Number", icon: "#" },
];
const uid = () => Math.random().toString(36).slice(2, 9);
const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

export default function FormEditor({ id, initial, events }: { id: string; initial: FormPayload; events: EventOpt[] }) {
  const router = useRouter();
  const [f, setF] = useState<FormPayload>(initial);
  const [focus, setFocus] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof FormPayload>(k: K, v: FormPayload[K]) => setF((s) => ({ ...s, [k]: v }));

  const toggleEvent = (eid: string) => set("events", f.events.some((e) => e.event_id === eid) ? f.events.filter((e) => e.event_id !== eid) : [...f.events, { event_id: eid, prompt: null }]);
  const setPrompt = (eid: string, prompt: string) => set("events", f.events.map((e) => (e.event_id === eid ? { ...e, prompt: prompt || null } : e)));
  const addQ = () => { const q: FormQuestion = { id: uid(), type: "single_choice", label: "", required: true, options: ["Option 1"] }; set("questions", [...f.questions, q]); setFocus(q.id); };
  const updQ = (qid: string, patch: Partial<FormQuestion>) => set("questions", f.questions.map((q) => (q.id === qid ? { ...q, ...patch } : q)));
  const delQ = (qid: string) => set("questions", f.questions.filter((q) => q.id !== qid));
  const dupQ = (qid: string) => { const i = f.questions.findIndex((q) => q.id === qid); const c = { ...f.questions[i], id: uid() }; const a = [...f.questions]; a.splice(i + 1, 0, c); set("questions", a); setFocus(c.id); };
  const moveQ = (i: number, d: -1 | 1) => { const a = [...f.questions]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; set("questions", a); };

  const save = (status = f.status) => start(async () => {
    const payload = { ...f, status, questions: f.questions.filter((q) => q.label.trim()) };
    const r = await saveForm(id, payload);
    if (r.error) { setMsg(r.error); return; }
    setF(payload); setMsg(status === "open" ? "Saved — form is open to members" : "Saved"); router.refresh();
  });

  const statusChip = { draft: ["Draft", "var(--g-grey-100)", "var(--g-grey-600)"], open: ["Accepting responses", "var(--g-green-soft)", "var(--g-green)"], closed: ["Closed", "#fef7e0", "#b06000"] }[f.status];

  return (
    <div className="mx-auto max-w-[760px] space-y-3">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="chip" style={{ background: statusChip[1], color: statusChip[2], borderColor: "transparent" }}>{statusChip[0]}</span>
        <span className="flex-1" />
        <Link href={`/forms/${id}`} className="btn-text">👁 Preview</Link>
        <button type="button" onClick={() => save()} disabled={pending} className="btn-secondary">Save</button>
        {f.status !== "open" && <button type="button" onClick={() => save("open")} disabled={pending} className="btn-purple">Send</button>}
        {f.status === "open" && <button type="button" onClick={() => save("closed")} disabled={pending} className="btn-secondary">Stop accepting responses</button>}
      </div>
      {msg && <p className="text-xs text-center" style={{ color: "var(--g-green)" }}>{msg}</p>}

      {/* header card */}
      <div className="gf-header space-y-2">
        <input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Untitled form" className="input-line text-[32px] leading-tight" />
        <textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={Math.max(3, Math.min(14, f.description.split("\n").length + 1))} placeholder="Form description — meetup times, reminders, who to DM… (URLs become links)" className="input-line text-sm" />
        <div className="grid grid-cols-2 gap-4 pt-2 text-sm">
          <div><label className="label">Due</label><input type="datetime-local" value={toLocal(f.due_at)} onChange={(e) => set("due_at", e.target.value ? new Date(e.target.value).toISOString() : null)} className="input" /></div>
          <div><label className="label">Status</label>
            <select value={f.status} onChange={(e) => set("status", e.target.value as FormPayload["status"])} className="input"><option value="draft">Draft (hidden)</option><option value="open">Open (accepting responses)</option><option value="closed">Closed</option></select></div>
        </div>
      </div>

      {/* events card */}
      <div className="gf-card space-y-2">
        <div className="text-base">📅 Events on this form <span className="gf-required">*</span></div>
        <p className="text-xs" style={{ color: "var(--g-grey-600)" }}>Each checked event gets the standard “Will you be attending?” question (drive others / own ride / need a ride + pickup spot). Answers feed attendance, lineups and carpool.</p>
        {!events.length && <p className="text-sm" style={{ color: "var(--g-red)" }}>No upcoming events — <Link href="/admin/events" className="underline">create them</Link> first.</p>}
        {events.map((ev) => {
          const on = f.events.find((e) => e.event_id === ev.id);
          return (
            <div key={ev.id} className="rounded px-2 py-1" style={{ background: on ? "var(--g-purple-soft)" : undefined }}>
              <label className="gf-radio !py-1">
                <input type="checkbox" checked={!!on} onChange={() => toggleEvent(ev.id)} />
                <span>{ev.title}</span><span className="text-[10px] uppercase" style={{ color: "var(--g-grey-600)" }}>{ev.kind}</span>
                <span className="ml-auto text-xs" style={{ color: "var(--g-grey-600)" }}>{fmtDateTime(ev.starts_at)}</span>
              </label>
              {on && <input value={on.prompt ?? ""} onChange={(e) => setPrompt(ev.id, e.target.value)} placeholder={`Custom prompt (default: “Will you be attending ${ev.title}?”)`} className="input-line ml-9 w-[calc(100%-2.25rem)] text-xs" />}
            </div>
          );
        })}
      </div>

      {/* question cards */}
      {f.questions.map((q, i) => {
        const active = focus === q.id;
        const t = TYPES.find((x) => x.value === q.type)!;
        return (
          <div key={q.id} onClick={() => setFocus(q.id)} className={`gf-card ${active ? "gf-card-active" : ""} space-y-3`}>
            <div className="flex gap-3">
              <input value={q.label} onChange={(e) => updQ(q.id, { label: e.target.value })} placeholder="Question" className="input-line flex-1 text-base" style={{ background: active ? "var(--g-grey-50)" : undefined }} />
              {active && (
                <select value={q.type} onChange={(e) => updQ(q.id, { type: e.target.value as QuestionType, options: ["single_choice", "multi_choice"].includes(e.target.value) ? (q.options?.length ? q.options : ["Option 1"]) : undefined })} className="input w-48">
                  {TYPES.map((x) => <option key={x.value} value={x.value}>{x.icon} {x.label}</option>)}
                </select>
              )}
            </div>
            {active && <input value={q.help ?? ""} onChange={(e) => updQ(q.id, { help: e.target.value || undefined })} placeholder="Description (optional)" className="input-line text-xs" />}
            {!active && q.help && <p className="text-xs" style={{ color: "var(--g-grey-600)" }}>{q.help}</p>}

            {(q.type === "single_choice" || q.type === "multi_choice") && (
              <div className="space-y-1">
                {(q.options ?? []).map((o, oi) => (
                  <div key={oi} className="flex items-center gap-3">
                    <span className="w-[18px] h-[18px] rounded-full border-2 inline-block" style={{ borderColor: "var(--g-grey-300)", borderRadius: q.type === "multi_choice" ? 3 : 999 }} />
                    {active ? <input value={o} onChange={(e) => updQ(q.id, { options: q.options!.map((x, k) => (k === oi ? e.target.value : x)) })} className="input-line flex-1 !py-1" /> : <span className="text-sm py-1">{o}</span>}
                    {active && (q.options ?? []).length > 1 && <button type="button" onClick={() => updQ(q.id, { options: q.options!.filter((_, k) => k !== oi) })} className="px-2" style={{ color: "var(--g-grey-600)" }}>✕</button>}
                  </div>
                ))}
                {active && <button type="button" onClick={() => updQ(q.id, { options: [...(q.options ?? []), `Option ${(q.options?.length ?? 0) + 1}`] })} className="ml-8 text-sm" style={{ color: "var(--g-grey-600)" }}>Add option</button>}
              </div>
            )}
            {q.type === "yes_no" && <div className="text-sm space-y-1" style={{ color: "var(--g-grey-600)" }}><div>◯ Yes</div><div>◯ No</div></div>}
            {(q.type === "short_text" || q.type === "long_text" || q.type === "number") && <div className="text-sm border-b border-dotted w-1/2 pb-1" style={{ color: "var(--g-grey-600)", borderColor: "var(--g-grey-300)" }}>{t.label} text</div>}

            {active && (
              <div className="flex items-center gap-1 border-t pt-2 text-sm" style={{ borderColor: "var(--g-grey-300)" }}>
                <button type="button" onClick={() => moveQ(i, -1)} disabled={i === 0} className="btn-text disabled:opacity-30">↑</button>
                <button type="button" onClick={() => moveQ(i, 1)} disabled={i === f.questions.length - 1} className="btn-text disabled:opacity-30">↓</button>
                <button type="button" onClick={() => dupQ(q.id)} className="btn-text" title="Duplicate">⧉</button>
                <button type="button" onClick={() => delQ(q.id)} className="btn-text" title="Delete">🗑</button>
                <span className="flex-1" />
                <label className="flex items-center gap-2 text-xs"><span>Required</span><input type="checkbox" checked={!!q.required} onChange={(e) => updQ(q.id, { required: e.target.checked })} className="accent-[var(--g-purple)] w-4 h-4" /></label>
              </div>
            )}
          </div>
        );
      })}

      <div className="flex justify-center">
        <button type="button" onClick={addQ} className="rounded-full border bg-white px-5 py-2 text-sm font-medium shadow-sm" style={{ borderColor: "var(--g-grey-300)", color: "var(--g-grey-600)" }}>⊕ Add question</button>
      </div>

      <div className="flex justify-between pt-6 text-xs">
        <form action={deleteForm}><input type="hidden" name="id" value={id} /><button className="btn-danger-text">Delete form</button></form>
        <span style={{ color: "var(--g-grey-600)" }}>Members get name / weight / phone / address from their profile automatically.</span>
      </div>
    </div>
  );
}
