import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import LocalTime from "@/components/local-time";
import { deleteAnnouncement, togglePin } from "../actions";
import AnnouncementForm from "./form";

export default async function AdminAnnouncementsPage() {
  const { org } = await requireAdmin();
  const supabase = await createClient();
  const { data: items } = await supabase.from("announcements").select("*").eq("org_id", org.id)
    .order("pinned", { ascending: false }).order("created_at", { ascending: false });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <h1 className="text-2xl font-normal mb-3">New announcement</h1>
        <AnnouncementForm />
      </section>
      <section>
        <h2 className="text-lg font-medium mb-3">Posted</h2>
        <ul className="space-y-2">
          {items?.map((a) => (
            <li key={a.id} className="card text-sm">
              <div className="flex justify-between gap-2">
                <div className="font-medium">{a.pinned && "📌 "}{a.title}</div>
                <div className="flex gap-2 shrink-0">
                  <form action={togglePin}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="pinned" value={String(!a.pinned)} />
                    <button className="text-xs underline">{a.pinned ? "Unpin" : "Pin"}</button></form>
                  <form action={deleteAnnouncement}><input type="hidden" name="id" value={a.id} />
                    <button className="text-xs text-red-600 underline">Delete</button></form>
                </div>
              </div>
              <div className="text-xs text-slate-400"><LocalTime iso={a.created_at} /></div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
