/** Renders plain text preserving line breaks; bare URLs become links. */
export default function RichText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return (
    <div className="whitespace-pre-wrap text-sm leading-relaxed">
      {parts.map((p, i) => /^https?:\/\//.test(p)
        ? <a key={i} href={p} target="_blank" rel="noreferrer" className="text-sky-700 underline break-all">{p}</a>
        : <span key={i}>{p}</span>)}
    </div>
  );
}
