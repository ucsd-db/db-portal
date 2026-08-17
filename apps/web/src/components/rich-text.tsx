import { cleanHtml, isHtml } from "@/lib/html";

/** Renders stored rich text (sanitized HTML) — or legacy plain text with linkified URLs. */
export default function RichText({ text, className = "" }: { text: string; className?: string }) {
  if (isHtml(text)) {
    return <div className={`rich text-sm leading-relaxed ${className}`} dangerouslySetInnerHTML={{ __html: cleanHtml(text) }} />;
  }
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return (
    <div className={`whitespace-pre-wrap text-sm leading-relaxed ${className}`}>
      {parts.map((p, i) => /^https?:\/\//.test(p)
        ? <a key={i} href={p} target="_blank" rel="noreferrer" className="text-sky-700 underline break-all">{p}</a>
        : <span key={i}>{p}</span>)}
    </div>
  );
}
