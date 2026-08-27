"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Icon from "@/components/icon";
import { deleteForm } from "./actions";

/** ⋮ menu on a form card: Edit / Delete. */
export default function FormMenu({ id, title }: { id: string; title: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div ref={ref} className="absolute right-1 top-1 z-10">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Form options" aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 hover:bg-white" style={{ color: "var(--g-grey-600)" }}>
        <Icon name="dots" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-36 rounded-lg border bg-white py-1 text-sm shadow-lg" style={{ borderColor: "var(--g-grey-300)" }}>
          <Link href={`/admin/forms/${id}`} className="flex items-center gap-2 px-4 py-2 hover:bg-[var(--g-grey-50)]"><Icon name="pen" /> Edit</Link>
          <form action={deleteForm} onSubmit={(e) => { if (!confirm(`Delete "${title}" and all its responses? This can't be undone.`)) e.preventDefault(); }}>
            <input type="hidden" name="id" value={id} />
            <button className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-[var(--g-grey-50)]" style={{ color: "var(--g-red)" }}><Icon name="trash" /> Delete</button>
          </form>
        </div>
      )}
    </div>
  );
}
