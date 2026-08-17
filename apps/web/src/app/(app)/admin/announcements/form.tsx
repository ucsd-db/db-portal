"use client";

import { useActionState, useState } from "react";
import { createAnnouncement, type AdminState } from "../actions";
import RichEditor from "@/components/rich-editor";

/** Remounts the inner form (fresh editor + inputs) after each successful post. */
export default function AnnouncementForm() {
  const [gen, setGen] = useState(0);
  const [justPosted, setJustPosted] = useState(false);
  return <Inner key={gen} justPosted={justPosted} onPosted={() => { setGen((g) => g + 1); setJustPosted(true); }} />;
}

function Inner({ onPosted, justPosted }: { onPosted: () => void; justPosted: boolean }) {
  const [body, setBody] = useState("");
  const [state, action, pending] = useActionState<AdminState, FormData>(async (prev, fd) => {
    const r = await createAnnouncement(prev, fd);
    if (r.ok) onPosted();
    return r;
  }, {});
  return (
    <form action={action} className="card space-y-3">
      <input name="title" required placeholder="Title" className="input" />
      <input type="hidden" name="body" value={body} />
      <RichEditor value={body} onChange={setBody} minRows={6} placeholder="Message… (bold, bullets, links; paste from Google Docs)" />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="pinned" /> Pin to top</label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {justPosted && !state.error && <p className="text-sm text-green-700">Posted.</p>}
      <button disabled={pending} className="btn-primary">Post</button>
    </form>
  );
}
