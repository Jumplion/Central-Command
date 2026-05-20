import type { ParsedFeedJob } from "./types";
import { stripHtml } from "./utils";

// ─── Lever XML ────────────────────────────────────────────────────────────────

export function parseLeverXML(
  xmlText: string,
  feedName: string,
): ParsedFeedJob[] {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror"))
    throw new Error("Invalid XML from Lever feed");
  const results: ParsedFeedJob[] = [];
  doc.querySelectorAll("job").forEach((job) => {
    const title = job.querySelector("title")?.textContent?.trim() ?? "";
    const hostedUrl = job.querySelector("hostedUrl")?.textContent?.trim() ?? "";
    const applyUrl =
      job.querySelector("applyUrl")?.textContent?.trim() || hostedUrl;
    const location =
      job.querySelector("categories location")?.textContent?.trim() ?? "";
    const createdAt = job.querySelector("createdAt")?.textContent?.trim();
    const datePosted = createdAt
      ? new Date(Number(createdAt)).toISOString().slice(0, 10)
      : "";
    const desc = stripHtml(
      job.querySelector("descriptionBody")?.textContent ??
        job.querySelector("description")?.textContent ??
        "",
    ).slice(0, 400);
    if (title && hostedUrl) {
      results.push({
        ext_id: hostedUrl,
        title,
        company: feedName,
        location,
        date_posted: datePosted,
        apply_link: applyUrl,
        description: desc,
      });
    }
  });
  return results;
}

// ─── RSS / Atom XML ───────────────────────────────────────────────────────────

export function parseRSSXML(
  xmlText: string,
  feedName: string,
): ParsedFeedJob[] {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("Invalid XML feed");
  const rssItems = Array.from(doc.querySelectorAll("item"));
  const atomItems = Array.from(doc.querySelectorAll("entry"));
  const nodes = rssItems.length > 0 ? rssItems : atomItems;
  const results: ParsedFeedJob[] = [];
  nodes.forEach((item) => {
    const isAtom = item.tagName === "entry";
    const title = item.querySelector("title")?.textContent?.trim() ?? "";
    const link = isAtom
      ? (item.querySelector("link")?.getAttribute("href") ?? "")
      : (item.querySelector("link")?.textContent?.trim() ??
        item.querySelector("guid")?.textContent?.trim() ??
        "");
    const desc = stripHtml(
      item.querySelector("description")?.textContent ??
        item.querySelector("summary")?.textContent ??
        "",
    ).slice(0, 400);
    const pub =
      item.querySelector("pubDate")?.textContent ??
      item.querySelector("updated")?.textContent ??
      "";
    const d = pub ? new Date(pub) : null;
    const datePosted =
      d && !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : "";
    if (title && link) {
      results.push({
        ext_id: link,
        title,
        company: item.querySelector("company")?.textContent?.trim() || feedName,
        location: item.querySelector("location")?.textContent?.trim() ?? "",
        date_posted: datePosted,
        apply_link: link,
        description: desc,
      });
    }
  });
  return results;
}

// ─── Greenhouse JSON ──────────────────────────────────────────────────────────

export function parseGreenhouseJSON(
  jsonText: string,
  feedName: string,
): ParsedFeedJob[] {
  const data = JSON.parse(jsonText) as { jobs?: Record<string, unknown>[] };
  return (data.jobs ?? [])
    .map(
      (j): ParsedFeedJob => ({
        ext_id: String(j.id ?? Math.random()),
        title: String(j.title ?? ""),
        company: feedName,
        location: (j.location as { name?: string } | null)?.name ?? "",
        date_posted: String(j.updated_at ?? "").slice(0, 10),
        apply_link: String(j.absolute_url ?? ""),
        description: "",
      }),
    )
    .filter((j) => j.title);
}
