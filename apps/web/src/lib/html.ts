import sanitizeHtml from "sanitize-html";

/** Server-safe sanitizer for editor HTML (forms, announcements). */
export function cleanHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "b", "strong", "i", "em", "u", "s", "a", "ul", "ol", "li", "h2", "h3", "blockquote", "hr", "code", "pre", "img"],
    allowedAttributes: { a: ["href", "target", "rel"], img: ["src", "alt", "title", "width", "loading", "referrerpolicy"] },
    allowedSchemesByTag: { img: ["https"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    transformTags: { a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }), img: sanitizeHtml.simpleTransform("img", { loading: "lazy", referrerpolicy: "no-referrer" }) },
  });
}

/** True when the stored value is editor HTML (vs. legacy plain text). */
export const isHtml = (s: string) => /^\s*</.test(s);

/** Flatten editor HTML to readable plain text (for CSV / sheet cells). */
export function htmlToText(html: string): string {
  if (!isHtml(html)) return html;
  return sanitizeHtml(html
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• "), { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n").trim();
}
