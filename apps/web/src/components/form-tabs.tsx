"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Google Forms style "Questions | Responses" tab bar for the admin form editor. */
export default function FormTabs({ id, responses }: { id: string; responses?: number }) {
  const path = usePathname();
  const tabs = [
    { href: `/admin/forms/${id}`, label: "Questions" },
    { href: `/admin/forms/${id}/responses`, label: `Responses${responses != null ? ` ${responses}` : ""}` },
  ];
  return (
    <div className="flex justify-center gap-2 border-b bg-white -mx-4 md:-mx-6 -mt-4 md:-mt-6 mb-4 px-4" style={{ borderColor: "var(--g-grey-300)" }}>
      {tabs.map((t) => {
        const active = path === t.href;
        return (
          <Link key={t.href} href={t.href} className="px-4 py-3 text-sm font-medium border-b-[3px] -mb-px transition"
            style={{ borderColor: active ? "var(--g-purple)" : "transparent", color: active ? "var(--g-purple)" : "var(--g-grey-600)" }}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
