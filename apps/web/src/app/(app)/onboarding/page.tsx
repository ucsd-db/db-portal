import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import OnboardingForms from "./forms";

export default async function OnboardingPage() {
  const { membership } = await getSession();
  if (membership) redirect("/dashboard");
  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-bold mb-2">Welcome!</h1>
      <p className="text-slate-600 mb-6">Join your team with a code from your admin, or create a new team.</p>
      <OnboardingForms />
    </div>
  );
}
