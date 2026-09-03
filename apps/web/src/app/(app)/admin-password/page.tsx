import { redirect } from "next/navigation";
import { adminHasPassword, requireOrg } from "@/lib/session";
import SetupForm from "./setup-form";

/** Gate page: admins without a password land here (from requireAdmin) until they set one. */
export default async function AdminPasswordPage() {
  const s = await requireOrg();
  if (!s.isAdmin) redirect("/dashboard");
  if (await adminHasPassword(s.userId)) redirect("/admin");
  return (
    <div className="mx-auto max-w-md pt-10">
      <h1 className="text-2xl font-normal">Set an admin password</h1>
      <p className="mt-2 text-sm text-slate-500">
        Members sign in with just their email — which anyone who knows the address could type. Admin
        accounts can see and edit the whole team, so they need a real password. Set one to unlock the
        admin panel; you’ll be asked for it on future sign-ins.
      </p>
      <SetupForm />
    </div>
  );
}
