import LoginForm from "./form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return <LoginForm next={next ?? "/dashboard"} initialError={error === "auth" ? "Sign-in link was invalid or expired." : undefined} />;
}
