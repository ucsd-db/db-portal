"use client";

/** A form that asks for confirmation before submitting its server action. */
export default function ConfirmForm({ action, message, children, className }: {
  action: (fd: FormData) => void | Promise<void>; message: string; children: React.ReactNode; className?: string;
}) {
  return (
    <form action={action} className={className} onSubmit={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      {children}
    </form>
  );
}
