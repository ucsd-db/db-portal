"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const memberNav = [
  { href: "/dashboard", label: "Board", icon: "📌" },
  { href: "/forms", label: "Forms", icon: "📝" },
  { href: "/events", label: "Events", icon: "📅" },
  { href: "/profile", label: "My profile", icon: "👤" },
];
const adminNav = [
  { href: "/admin/announcements", label: "Announcements", icon: "📣" },
  { href: "/admin/forms", label: "Forms", icon: "🧾" },
  { href: "/admin/events", label: "Events", icon: "🗓️" },
  { href: "/admin/members", label: "Members", icon: "👥" },
  { href: "/admin/lineups", label: "Lineups", icon: "🛶" },
  { href: "/admin/carpool", label: "Carpool", icon: "🚗" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️" },
];

export default function NavRail({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  const item = (n: { href: string; label: string; icon: string }) => {
    const active = path === n.href || path.startsWith(n.href + "/");
    return (
      <Link key={n.href} href={n.href} className={`nav-item ${active ? "nav-item-active" : ""}`}>
        <span className="w-5 text-center">{n.icon}</span><span className="hidden md:inline">{n.label}</span>
      </Link>
    );
  };
  return (
    <aside className="w-14 md:w-60 shrink-0 py-3 pr-3 flex flex-col gap-0.5">
      {memberNav.map(item)}
      {isAdmin && (
        <>
          <div className="mt-4 mb-1 hidden md:block pl-6 text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--g-grey-600)" }}>Admin</div>
          <div className="mt-4 md:hidden border-t mx-3" style={{ borderColor: "var(--g-grey-300)" }} />
          {adminNav.map(item)}
        </>
      )}
    </aside>
  );
}
