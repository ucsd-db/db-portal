import Link from "next/link";
import { getSession } from "@/lib/session";
import { signOut } from "@/app/(auth)/actions";

const memberNav = [
  { href: "/dashboard", label: "Board" },
  { href: "/forms", label: "Forms" },
  { href: "/events", label: "Events" },
  { href: "/profile", label: "My profile" },
];
const adminNav = [
  { href: "/admin/announcements", label: "Announcements" },
  { href: "/admin/forms", label: "Forms" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/lineups", label: "Lineups" },
  { href: "/admin/carpool", label: "Carpool" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, membership, isAdmin } = await getSession();
  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <aside className="border-b md:border-b-0 md:border-r border-slate-200 bg-white p-4 flex flex-col gap-4">
        <div>
          <div className="text-lg font-bold">🐉 {membership?.organization.name ?? "Team Portal"}</div>
          <div className="text-xs text-slate-500">{profile.full_name || profile.email}{isAdmin && " · admin"}</div>
        </div>
        {membership && (
          <nav className="flex md:flex-col gap-1 flex-wrap text-sm">
            {memberNav.map((n) => (
              <Link key={n.href} href={n.href} className="rounded px-2 py-1.5 hover:bg-slate-100">{n.label}</Link>
            ))}
            {isAdmin && (
              <>
                <div className="mt-3 px-2 text-[11px] uppercase tracking-wide text-slate-400">Admin</div>
                {adminNav.map((n) => (
                  <Link key={n.href} href={n.href} className="rounded px-2 py-1.5 hover:bg-slate-100">{n.label}</Link>
                ))}
              </>
            )}
          </nav>
        )}
        <form action={signOut} className="md:mt-auto">
          <button className="text-sm text-slate-500 hover:underline">Sign out</button>
        </form>
      </aside>
      <main className="p-4 md:p-8 max-w-5xl w-full">{children}</main>
    </div>
  );
}
