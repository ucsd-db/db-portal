export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow">
        <h1 className="text-xl font-bold mb-1">🐉 Team Portal</h1>
        {children}
      </div>
    </main>
  );
}
