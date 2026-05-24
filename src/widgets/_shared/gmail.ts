// Shared Gmail API utilities used by multiple widgets.

export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailPayload {
  mimeType: string;
  headers: GmailHeader[];
  body?: { data?: string };
  parts?: GmailPayload[];
}

export function decodeBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(""),
    );
  } catch {
    return atob(base64);
  }
}

export function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function getHeader(headers: GmailHeader[], name: string): string {
  return (
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ??
    ""
  );
}

/**
 * Extracts the best plain-text representation from a Gmail message payload,
 * recursively walking multipart messages. Prefers text/plain over text/html.
 * If `maxLength` > 0 the result is sliced to that many characters.
 */
export function extractBodyText(payload: GmailPayload, maxLength = 0): string {
  function extract(p: GmailPayload): string {
    if (p.mimeType === "text/plain" && p.body?.data) {
      return decodeBase64Url(p.body.data);
    }
    if (p.mimeType === "text/html" && p.body?.data) {
      return stripHtml(decodeBase64Url(p.body.data));
    }
    if (p.parts) {
      for (const part of p.parts) {
        if (part.mimeType === "text/plain" && part.body?.data) {
          return decodeBase64Url(part.body.data);
        }
      }
      for (const part of p.parts) {
        const text = extract(part);
        if (text) return text;
      }
    }
    return "";
  }
  const text = extract(payload);
  return maxLength > 0 ? text.slice(0, maxLength) : text;
}
