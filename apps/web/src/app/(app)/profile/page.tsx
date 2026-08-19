import { getSession } from "@/lib/session";
import ProfileForm from "./form";
import PasswordForm from "./password-form";

export default async function ProfilePage() {
  const { profile, isAdmin } = await getSession();
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-normal mb-1">My profile</h1>
      <p className="text-sm text-slate-500 mb-4">Weight and side preference feed the lineup builder; your address is only used for carpool matching (geocoded, never shown to other members).</p>
      <ProfileForm profile={profile} />
      {isAdmin && <PasswordForm />}
    </div>
  );
}
