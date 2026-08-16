import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { removeMember, setMemberRole } from "../actions";
import type { Membership, Profile } from "@/lib/database.types";

export default async function AdminMembersPage() {
  const { org, userId } = await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("memberships").select("*, profile:profiles(*)").eq("org_id", org.id).order("created_at");
  const members = (data ?? []) as (Membership & { profile: Profile })[];
  return (
    <div>
      <h1 className="text-2xl font-normal mb-1">Members <span className="text-slate-400 font-normal">({members.length})</span></h1>
      <p className="text-sm text-slate-500 mb-4">Join code: <span className="font-mono">{org.join_code}</span></p>
      <div className="sheet-wrap">
        <div className="flex items-center gap-2 border-b px-3 py-2 text-xs" style={{ borderColor: "var(--g-grey-300)", background: "var(--g-green-soft)", color: "var(--g-green)" }}><span className="font-medium">▦ Roster</span></div>
        <table className="sheet !text-sm">
          <thead>
            <tr><th className="w-8 text-center">#</th><th>Name</th><th>Email</th><th>Wt (kg)</th><th>Gender</th><th>Side</th><th>Roles</th><th>Drives</th><th>Role</th><th></th></tr>
          </thead>
          <tbody>
            {members.map((m, i) => (
              <tr key={m.user_id}>
                <td className="text-center" style={{ background: "var(--g-grey-100)", color: "var(--g-grey-600)" }}>{i + 1}</td>
                <td className="font-medium">{m.profile.full_name || "—"}</td>
                <td className="text-slate-500">{m.profile.email}</td>
                <td>{m.profile.weight_kg ?? "—"}</td>
                <td>{m.profile.gender ?? "—"}</td>
                <td>{m.profile.side_preference ?? "—"}</td>
                <td>{[m.profile.can_steer && "steer", m.profile.can_drum && "drum"].filter(Boolean).join(", ") || "—"}</td>
                <td>{m.profile.can_drive ? `🚗 ${m.profile.car_seats ?? "?"}` : "—"}{m.profile.lat ? "" : m.profile.address ? " (unlocated)" : ""}</td>
                <td>
                  {m.user_id === userId ? <span className="text-slate-500">{m.role} (you)</span> : (
                    <form action={setMemberRole}>
                      <input type="hidden" name="user_id" value={m.user_id} />
                      <select name="role" defaultValue={m.role} className="input py-1" onChange={undefined}>
                        <option value="member">member</option><option value="admin">admin</option>
                      </select>
                      <button className="ml-1 text-xs underline">Set</button>
                    </form>
                  )}
                </td>
                <td>
                  {m.user_id !== userId && (
                    <form action={removeMember}><input type="hidden" name="user_id" value={m.user_id} />
                      <button className="text-xs text-red-600 underline">Remove</button></form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
