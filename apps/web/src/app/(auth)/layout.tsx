export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-4" style={{ background: "#fff" }}>
      <div className="w-full max-w-[450px] rounded-lg border p-10" style={{ borderColor: "var(--g-grey-300)" }}>
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🐉</div>
          <h1 className="text-2xl font-normal">Team Portal</h1>
        </div>
        {children}
      </div>
    </main>
  );
}
