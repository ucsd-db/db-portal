import sanitizeHtml from "sanitize-html";

/** Server-safe sanitizer for editor HTML (forms, announcements). */
export function cleanHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "b", "strong", "i", "em", "u", "s", "a", "ul", "ol", "li", "h2", "h3", "blockquote", "hr", "code", "pre"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    transformTags: { a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }) },
  });
}

/** True when the stored value is editor HTML (vs. legacy plain text). */
export const isHtml = (s: string) => /^\s*</.test(s);
