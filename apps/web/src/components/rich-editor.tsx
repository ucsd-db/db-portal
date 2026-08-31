"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import Icon from "@/components/icon";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Total image storage the team allows itself (well inside Supabase's 1 GB free tier). */
const BUCKET_CAP = 200 * 1024 * 1024;
const mb = (n: number) => (n / 1048576).toFixed(1);

/** If this upload would blow the cap, ask to evict the oldest images first (confirm-gated). */
async function ensureRoom(supabase: ReturnType<typeof createClient>, incoming: number) {
  const { data: files } = await supabase.storage.from("images").list("", { limit: 1000, sortBy: { column: "created_at", order: "asc" } });
  if (!files?.length) return;
  const sized = files.map((f) => ({ name: f.name, size: (f.metadata as { size?: number } | null)?.size ?? 0 }));
  let total = sized.reduce((a, f) => a + f.size, 0);
  if (total + incoming <= BUCKET_CAP) return;
  const used = total;
  const doomed: string[] = [];
  for (const f of sized) {
    if (total + incoming <= BUCKET_CAP) break;
    doomed.push(f.name); total -= f.size;
  }
  const ok = window.confirm(
    `Image storage is full (${mb(used)} of ${mb(BUCKET_CAP)} MB used).\n` +
    `Delete the ${doomed.length} oldest image${doomed.length === 1 ? "" : "s"} to make room?\n` +
    `Old announcements/forms that still show them will lose those images.`);
  if (!ok) throw new Error("Upload canceled — image storage is full.");
  const { error } = await supabase.storage.from("images").remove(doomed);
  if (error) throw new Error(`Couldn’t free up space: ${error.message}`);
}

/** Uploads an image to the public Supabase Storage bucket and returns its permanent URL. */
async function uploadImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("That file isn’t an image.");
  if (file.size > 4 * 1024 * 1024) throw new Error("Image is over 4 MB — please resize it first.");
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${crypto.randomUUID()}.${ext}`;
  const supabase = createClient();
  await ensureRoom(supabase, file.size);
  const { error } = await supabase.storage.from("images").upload(path, file, { contentType: file.type });
  if (error) throw new Error(/not authenticated|jwt|denied|security/i.test(error.message) ? "Sign in to attach images." : error.message);
  return supabase.storage.from("images").getPublicUrl(path).data.publicUrl;
}

/**
 * Small WYSIWYG editor (Tiptap). Emits HTML. Pasting from Google Docs keeps bold/underline/lists/links.
 * Images are uploaded to our own storage (external hotlinks expire); paste/drop of image files works too.
 * Value is uncontrolled after mount except when `value` is reset to "" (form reset).
 */
export default function RichEditor({ value, onChange, placeholder, minRows = 6, className = "" }: {
  value: string; onChange: (html: string) => void; placeholder?: string; minRows?: number; className?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: true, defaultProtocol: "https" } }), Image.configure({ inline: false, allowBase64: false })],
    content: value,
    editorProps: {
      attributes: { class: "rich focus:outline-none px-3 py-2 text-sm", style: `min-height:${minRows * 1.5}rem` },
      // Pasting or dropping an image file uploads it instead of embedding a dying blob/hotlink.
      handlePaste: (_view, e) => insertFiles(e.clipboardData?.files),
      handleDrop: (_view, e) => insertFiles((e as DragEvent).dataTransfer?.files),
    },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? "" : editor.getHTML()),
  });

  const insertFiles = (files?: FileList | null): boolean => {
    const imgs = [...(files ?? [])].filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return false;
    setUploading(true);
    Promise.all(imgs.map(uploadImage))
      .then((urls) => urls.forEach((src) => editor?.chain().focus().setImage({ src }).run()))
      .catch((err: Error) => window.alert(err.message))
      .finally(() => setUploading(false));
    return true;
  };

  // allow parent to clear (e.g. after successful post)
  useEffect(() => { if (editor && value === "" && !editor.isEmpty) editor.commands.clearContent(); }, [value, editor]);

  if (!editor) return <div className={`rounded border bg-white ${className}`} style={{ borderColor: "var(--g-grey-300)", minHeight: `${minRows * 1.5 + 2.5}rem` }} />;

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    if (!url.trim()) { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };



  return (
    <div className={`rounded border bg-white ${className}`} style={{ borderColor: "var(--g-grey-300)" }}>
      <div className="flex flex-wrap items-center gap-0.5 border-b px-1 py-1" style={{ borderColor: "var(--g-grey-300)", background: "var(--g-grey-50)" }}>
        <B title="Bold (⌘B)" active={editor.isActive("bold")} on={() => editor.chain().focus().toggleBold().run()}><b>B</b></B>
        <B title="Italic (⌘I)" active={editor.isActive("italic")} on={() => editor.chain().focus().toggleItalic().run()}><i>I</i></B>
        <B title="Underline (⌘U)" active={editor.isActive("underline")} on={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></B>
        <B title="Strikethrough" active={editor.isActive("strike")} on={() => editor.chain().focus().toggleStrike().run()}><s>S</s></B>
        <span className="mx-1 h-5 w-px" style={{ background: "var(--g-grey-300)" }} />
        <B title="Heading" active={editor.isActive("heading", { level: 2 })} on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><span className="font-medium">H</span></B>
        <B title="Bulleted list" active={editor.isActive("bulletList")} on={() => editor.chain().focus().toggleBulletList().run()}>•≡</B>
        <B title="Numbered list" active={editor.isActive("orderedList")} on={() => editor.chain().focus().toggleOrderedList().run()}>1≡</B>
        <B title="Quote" active={editor.isActive("blockquote")} on={() => editor.chain().focus().toggleBlockquote().run()}>❝</B>
        <B title="Divider" on={() => editor.chain().focus().setHorizontalRule().run()}>―</B>
        <span className="mx-1 h-5 w-px" style={{ background: "var(--g-grey-300)" }} />
        <B title="Link" active={editor.isActive("link")} on={setLink}><Icon name="link" /></B>
        <B title="Insert image (uploads a copy — links to Discord/Google Photos expire)" on={() => fileRef.current?.click()}>{uploading ? "…" : "🖼"}</B>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => { insertFiles(e.target.files); e.target.value = ""; }} />
        <B title="Clear formatting" on={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>Tx</B>
      </div>
      <div className="relative">
        {editor.isEmpty && placeholder && <div className="pointer-events-none absolute left-3 top-2 text-sm whitespace-pre-wrap" style={{ color: "var(--g-grey-600)" }}>{placeholder}</div>}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function B({ on, active, title, children }: { on: () => void; active?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button type="button" title={title} onMouseDown={(e) => { e.preventDefault(); on(); }}
      className="h-7 min-w-7 rounded px-1.5 text-sm" style={{ background: active ? "var(--g-blue-tint)" : undefined, color: active ? "var(--g-blue)" : "var(--g-grey-600)" }}>{children}</button>
  );
}
