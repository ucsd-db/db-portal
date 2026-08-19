"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "@/components/icon";

const memberNav: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Board", icon: "board" },
  { href: "/forms", label: "Forms", icon: "form" },
  { href: "/events", label: "Events", icon: "calendar" },
  { href: "/profile", label: "My profile", icon: "user" },
];
const adminNav: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin/announcements", label: "Announcements", icon: "announce" },
  { href: "/admin/forms", label: "Forms", icon: "file" },
  { href: "/admin/events", label: "Events", icon: "calendar" },
  { href: "/admin/members", label: "Members", icon: "users" },
  { href: "/admin/lineups", label: "Lineups", icon: "boat" },
  { href: "/admin/carpool", label: "Carpool", icon: "car" },
  { href: "/admin/settings", label: "Settings", icon: "gear" },
];

export default function NavRail({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  const item = (n: { href: string; label: string; icon: IconName }) => {
    const active = path === n.href || path.startsWith(n.href + "/");
    return (
      <Link key={n.href} href={n.href} className={`nav-item ${active ? "nav-item-active" : ""}`}>
        <span className="w-5 text-center"><Icon name={n.icon} /></span><span className="hidden md:inline">{n.label}</span>
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
