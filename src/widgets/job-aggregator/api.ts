import type {
  JobListing,
  CompanyFeed,
  NetFetcher,
  StampedFeedJob,
  ParsedFeedJob,
} from "./types";
import { parseLeverXML, parseRSSXML, parseGreenhouseJSON } from "./parsers";

// ─── Arbeitnow (free, no key) ─────────────────────────────────────────────────

export async function searchArbeitnow(
  fetch: NetFetcher,
  query: string,
  remote: boolean,
): Promise<JobListing[]> {
  const p = new URLSearchParams({ search: query });
  if (remote) p.set("remote", "true");
  const resp = await fetch(`https://www.arbeitnow.com/api/job-board-api?${p}`);
  if (!resp.ok) throw new Error(`Arbeitnow error ${resp.status}`);
  const data = JSON.parse(resp.body) as { data?: Record<string, unknown>[] };
  return (data.data ?? []).slice(0, 25).map(
    (j): JobListing => ({
      id: `arbeitnow-${String(j.slug ?? Math.random())}`,
      title: String(j.title ?? ""),
      company: String(j.company_name ?? ""),
      location: String(j.location ?? (j.remote ? "Remote" : "")),
      isRemote: Boolean(j.remote),
      employmentType: "",
      salaryCurrency: "",
      salaryPeriod: "",
      datePosted:
        typeof j.created_at === "number"
          ? new Date(j.created_at * 1000).toISOString().slice(0, 10)
          : "",
      applyLink: String(j.url ?? ""),
      source: "Arbeitnow",
      description: "",
    }),
  );
}

// ─── Company feed fetcher ─────────────────────────────────────────────────────

export async function fetchFeed(
  fetch: NetFetcher,
  feed: CompanyFeed,
  apiKey: string,
): Promise<StampedFeedJob[]> {
  const ts = Date.now();
  const stamp = (jobs: ParsedFeedJob[]): StampedFeedJob[] =>
    jobs.map((j) => ({ ...j, fetched_at: ts }));

  if (feed.feed_type === "lever") {
    const resp = await fetch(
      `https://api.lever.co/v0/postings/${feed.url}?mode=xml`,
    );
    if (!resp.ok) throw new Error(`Lever error ${resp.status}`);
    return stamp(parseLeverXML(resp.body, feed.name));
  }
  if (feed.feed_type === "greenhouse") {
    const resp = await fetch(
      `https://api.greenhouse.io/v1/boards/${feed.url}/jobs`,
    );
    if (!resp.ok) throw new Error(`Greenhouse error ${resp.status}`);
    return stamp(parseGreenhouseJSON(resp.body, feed.name));
  }
  if (feed.feed_type === "rss") {
    const resp = await fetch(feed.url);
    if (!resp.ok) throw new Error(`RSS error ${resp.status}`);
    // Try Lever XML first (uses <jobs> root), then generic RSS/Atom
    return stamp(
      resp.body.includes("<jobs>")
        ? parseLeverXML(resp.body, feed.name)
        : parseRSSXML(resp.body, feed.name),
    );
  }
  if (feed.feed_type === "search") {
    throw new Error(
      "JSearch querying is disabled. Search feeds are no longer supported.",
    );
  }
  throw new Error(`Unknown feed type: ${feed.feed_type}`);
}
