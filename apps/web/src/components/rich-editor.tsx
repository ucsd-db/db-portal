"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import Icon from "@/components/icon";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { useEffect } from "react";

/**
 * Small WYSIWYG editor (Tiptap). Emits HTML. Pasting from Google Docs keeps bold/underline/lists/links.
 * Value is uncontrolled after mount except when `value` is reset to "" (form reset).
 */
export default function RichEditor({ value, onChange, placeholder, minRows = 6, className = "" }: {
  value: string; onChange: (html: string) => void; placeholder?: string; minRows?: number; className?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: true, defaultProtocol: "https" } }), Image.configure({ inline: false, allowBase64: false })],
    content: value,
    editorProps: { attributes: { class: "rich focus:outline-none px-3 py-2 text-sm", style: `min-height:${minRows * 1.5}rem` } },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? "" : editor.getHTML()),
  });

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

  const addImage = () => {
    const url = window.prompt("Image URL (https://…)\nTip: right-click any image online → “Copy image address”. Discord, Imgur, Google Photos links all work.");
    if (!url) return;
    const u = url.trim();
    if (!/^https:\/\//i.test(u)) { window.alert("Please use a link starting with https://"); return; }
    editor.chain().focus().setImage({ src: u }).run();
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
        <B title="Image from URL" on={addImage}>🖼</B>
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
