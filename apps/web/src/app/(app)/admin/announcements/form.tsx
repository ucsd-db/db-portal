"use client";

import { useActionState, useEffect, useRef } from "react";
import { createAnnouncement, type AdminState } from "../actions";

export default function AnnouncementForm() {
  const [state, action, pending] = useActionState<AdminState, FormData>(createAnnouncement, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="card space-y-3">
      <input name="title" required placeholder="Title" className="input" />
      <textarea name="body" rows={6} placeholder="Message…" className="input" />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="pinned" /> Pin to top</label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">Posted.</p>}
      <button disabled={pending} className="btn-primary">Post</button>
    </form>
  );
}
