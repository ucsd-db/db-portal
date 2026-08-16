"use client";

export default function ExportCsv({ filename, header, rows }: { filename: string; header: string[]; rows: string[][] }) {
  const download = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    a.click(); URL.revokeObjectURL(url);
  };
  return <button type="button" onClick={download} className="btn-secondary">Export CSV</button>;
}
