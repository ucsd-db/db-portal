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
      <h1 className="text-2xl font-bold mb-1">Members <span className="text-slate-400 font-normal">({members.length})</span></h1>
      <p className="text-sm text-slate-500 mb-4">Join code: <span className="font-mono">{org.join_code}</span></p>
      <div className="overflow-x-auto card p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Wt (kg)</th><th className="p-3">Gender</th><th className="p-3">Side</th><th className="p-3">Roles</th><th className="p-3">Drives</th><th className="p-3">Role</th><th className="p-3"></th></tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.user_id} className="border-t border-slate-100">
                <td className="p-3 font-medium">{m.profile.full_name || "—"}</td>
                <td className="p-3 text-slate-500">{m.profile.email}</td>
                <td className="p-3">{m.profile.weight_kg ?? "—"}</td>
                <td className="p-3">{m.profile.gender ?? "—"}</td>
                <td className="p-3">{m.profile.side_preference ?? "—"}</td>
                <td className="p-3">{[m.profile.can_steer && "steer", m.profile.can_drum && "drum"].filter(Boolean).join(", ") || "—"}</td>
                <td className="p-3">{m.profile.can_drive ? `🚗 ${m.profile.car_seats ?? "?"}` : "—"}{m.profile.lat ? "" : m.profile.address ? " (unlocated)" : ""}</td>
                <td className="p-3">
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
                <td className="p-3">
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
