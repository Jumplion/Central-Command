import { describe, expect, it } from "vitest";
import {
  decodeBase64Url,
  stripHtml,
  getHeader,
  extractBodyText,
  type GmailPayload,
} from "../gmail";

// Helper: encode a UTF-8 string to base64url
function b64url(text: string): string {
  return btoa(unescape(encodeURIComponent(text)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

describe("decodeBase64Url", () => {
  it("decodes a standard base64url-encoded UTF-8 string", () => {
    const encoded = b64url("Hello, world!");
    expect(decodeBase64Url(encoded)).toBe("Hello, world!");
  });

  it("handles base64url characters - and _ (not + and /)", () => {
    const encoded = b64url("foo+bar/baz");
    expect(decodeBase64Url(encoded)).toBe("foo+bar/baz");
  });

  it("decodes multi-line text with newlines", () => {
    const encoded = b64url("line1\nline2\nline3");
    expect(decodeBase64Url(encoded)).toBe("line1\nline2\nline3");
  });

  it("falls back to raw atob when bytes are not valid UTF-8", () => {
    // \x80 is an invalid UTF-8 start byte — decodeURIComponent will throw
    const base64OfInvalidUtf8 = btoa("\x80");
    const result = decodeBase64Url(base64OfInvalidUtf8);
    // fallback returns atob result directly
    expect(result).toBe("\x80");
  });

  it("decodes an empty string to an empty string", () => {
    expect(decodeBase64Url("")).toBe("");
  });
});

describe("stripHtml", () => {
  it("removes plain tags", () => {
    expect(stripHtml("<p>Hello</p>")).toBe("Hello");
  });

  it("strips <style> blocks entirely", () => {
    const html = "<style>body { color: red; }</style><p>Text</p>";
    const result = stripHtml(html);
    expect(result).not.toContain("color");
    expect(result).toContain("Text");
  });

  it("strips <script> blocks entirely", () => {
    const html = "<script>alert('xss')</script>Safe";
    const result = stripHtml(html);
    expect(result).not.toContain("alert");
    expect(result).toContain("Safe");
  });

  it("decodes HTML entities", () => {
    // &nbsp; → space, then the adjacent space collapses, then trim
    expect(stripHtml("&amp; &lt; &gt; &quot; &nbsp;")).toBe('& < > "');
  });

  it("collapses multiple whitespace runs to a single space", () => {
    expect(stripHtml("a   b    c")).toBe("a b c");
  });

  it("trims leading and trailing whitespace", () => {
    expect(stripHtml("  hello  ")).toBe("hello");
  });
});

describe("getHeader", () => {
  const headers = [
    { name: "From", value: "alice@example.com" },
    { name: "Subject", value: "Hello" },
    { name: "Date", value: "Mon, 1 Jan 2024" },
  ];

  it("returns the header value for a matching name", () => {
    expect(getHeader(headers, "Subject")).toBe("Hello");
  });

  it("is case-insensitive", () => {
    expect(getHeader(headers, "from")).toBe("alice@example.com");
    expect(getHeader(headers, "FROM")).toBe("alice@example.com");
  });

  it("returns empty string when the header is not found", () => {
    expect(getHeader(headers, "X-Missing")).toBe("");
  });

  it("returns empty string for an empty headers array", () => {
    expect(getHeader([], "Subject")).toBe("");
  });
});

describe("extractBodyText", () => {
  it("extracts text/plain body directly", () => {
    const payload: GmailPayload = {
      mimeType: "text/plain",
      headers: [],
      body: { data: b64url("Plain text body") },
    };
    expect(extractBodyText(payload)).toBe("Plain text body");
  });

  it("extracts and strips text/html body when no plain part exists", () => {
    const payload: GmailPayload = {
      mimeType: "text/html",
      headers: [],
      body: { data: b64url("<p>HTML body</p>") },
    };
    expect(extractBodyText(payload)).toBe("HTML body");
  });

  it("prefers text/plain part over text/html in a multipart message", () => {
    const payload: GmailPayload = {
      mimeType: "multipart/alternative",
      headers: [],
      parts: [
        {
          mimeType: "text/html",
          headers: [],
          body: { data: b64url("<p>HTML</p>") },
        },
        {
          mimeType: "text/plain",
          headers: [],
          body: { data: b64url("Plain") },
        },
      ],
    };
    expect(extractBodyText(payload)).toBe("Plain");
  });

  it("falls back to recursive extraction when no top-level text/plain part exists", () => {
    const nested: GmailPayload = {
      mimeType: "multipart/mixed",
      headers: [],
      parts: [
        {
          mimeType: "multipart/alternative",
          headers: [],
          parts: [
            {
              mimeType: "text/html",
              headers: [],
              body: { data: b64url("<p>Deep HTML</p>") },
            },
          ],
        },
      ],
    };
    expect(extractBodyText(nested)).toBe("Deep HTML");
  });

  it("returns empty string for a payload with no body and no parts", () => {
    const payload: GmailPayload = {
      mimeType: "application/octet-stream",
      headers: [],
    };
    expect(extractBodyText(payload)).toBe("");
  });

  it("applies maxLength when provided", () => {
    const payload: GmailPayload = {
      mimeType: "text/plain",
      headers: [],
      body: { data: b64url("Hello, world!") },
    };
    expect(extractBodyText(payload, 5)).toBe("Hello");
  });

  it("returns full text when maxLength is 0 (disabled)", () => {
    const payload: GmailPayload = {
      mimeType: "text/plain",
      headers: [],
      body: { data: b64url("Full text") },
    };
    expect(extractBodyText(payload, 0)).toBe("Full text");
  });

  it("handles multipart with no text parts by returning empty string", () => {
    const payload: GmailPayload = {
      mimeType: "multipart/mixed",
      headers: [],
      parts: [
        {
          mimeType: "application/pdf",
          headers: [],
          body: {},
        },
      ],
    };
    expect(extractBodyText(payload)).toBe("");
  });
});
