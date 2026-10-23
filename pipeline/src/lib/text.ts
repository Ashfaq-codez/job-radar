import sanitizeHtml from "sanitize-html";

// Keep the posting's structure (headings, lists, emphasis, links) but drop scripts, styles and inline attributes
export function cleanHtml(html: string): string {
  return sanitizeHtml(decodeEntities(html), {
    allowedTags: ["h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr", "ul", "ol", "li",
      "strong", "b", "em", "i", "u", "a", "blockquote", "code", "pre", "table", "thead", "tbody", "tr", "th", "td"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: { a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }) },
    exclusiveFilter: (frame) => ["p", "li", "strong", "b"].includes(frame.tag) && !frame.text.trim(),
  }).trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

export function htmlToText(html: string): string {
  const withoutTags = decodeEntities(html).replace(/<[^>]+>/g, " ");
  return decodeEntities(withoutTags).replace(/\s+/g, " ").trim();
}