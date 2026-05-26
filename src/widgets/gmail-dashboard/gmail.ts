import type { WidgetApi } from "@renderer/plugins/api";
import type {
  GmailApiMessage,
  GmailHeader,
  GmailListResponse,
  GmailPayload,
} from "../_shared/gmail";
import type { GmailRule } from "./types";
import { GMAIL_BASE } from "./constants";
import { UPSERT_EMAIL, UPDATE_EMAIL_READ_AND_SNIPPET } from "./queries";
import { namedSql } from "@renderer/plugins/sqlParams";
import { getHeader } from "../_shared/gmail";

// ─── Rule evaluation ──────────────────────────────────────────────────────

export function applyRules(
  subject: string,
  from: string,
  snippet: string,
  labelNames: string[],
  rules: GmailRule[],
): number | null {
  const lsubject = subject.toLowerCase();
  const lfrom = from.toLowerCase();
  const lsnippet = snippet.toLowerCase();

  for (const rule of rules) {
    const rawField = rule.field as string;
    const source: string =
      rawField === "subject"
        ? lsubject
        : rawField === "from"
          ? lfrom
          : rawField === "snippet"
            ? lsnippet
            : rawField === "label"
              ? labelNames.join(" ").toLowerCase()
              : "";

    const val = rule.value.toLowerCase();
    let match = false;

    switch (rule.operator) {
      case "contains":
        match = source.includes(val);
        break;
      case "not_contains":
        match = !source.includes(val);
        break;
      case "starts_with":
        match = source.startsWith(val);
        break;
      case "ends_with":
        match = source.endsWith(val);
        break;
      case "regex":
        try {
          match = new RegExp(rule.value, "i").test(source);
        } catch {
          match = false;
        }
        break;
    }

    if (match) return rule.folder_id;
  }

  return null;
}

// ─── Company / source extraction (for grouping) ───────────────────────────

const JOB_PLATFORM_DOMAINS: Record<string, string> = {
  "linkedin.com": "LinkedIn",
  "indeed.com": "Indeed",
  "ziprecruiter.com": "ZipRecruiter",
  "glassdoor.com": "Glassdoor",
  "monster.com": "Monster",
  "careerbuilder.com": "CareerBuilder",
  "dice.com": "Dice",
  "simplyhired.com": "SimplyHired",
  "wellfound.com": "Wellfound",
  "greenhouse.io": "Greenhouse",
  "lever.co": "Lever",
  "workday.com": "Workday",
  "icims.com": "iCIMS",
  "ashbyhq.com": "Ashby",
  "rippling.com": "Rippling",
  "bamboohr.com": "BambooHR",
  "smartrecruiters.com": "SmartRecruiters",
  "taleo.net": "Taleo",
  "jobvite.com": "Jobvite",
  "ladder.io": "Ladder",
  "builtinnyc.com": "Built In",
  "builtin.com": "Built In",
};

export function extractDisplayName(from: string): string {
  const m = from.match(/^([^<]+?)\s*</);
  if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  const dm = from.match(/^([^@]+)@/);
  return dm ? dm[1] : from;
}

export function extractDomain(from: string): string {
  const m = from.match(/@([\w.-]+)/);
  return m ? m[1].toLowerCase() : "";
}

export function extractSource(from: string): string {
  const domain = extractDomain(from);
  for (const [key, name] of Object.entries(JOB_PLATFORM_DOMAINS)) {
    if (domain.endsWith(key)) return name;
  }
  // Use the main part of the domain as a fallback
  const parts = domain.split(".");
  const main = parts.length >= 2 ? parts[parts.length - 2] : domain;
  return main.charAt(0).toUpperCase() + main.slice(1);
}

export function getRecencyBucket(receivedAt: string): string {
  const d = new Date(receivedAt);
  const receivedTime = d.getTime();
  if (Number.isNaN(receivedTime)) return "Unknown";

  const now = new Date();
  const diffMs = now.getTime() - receivedTime;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 1) return "Today";
  if (diffDays < 7) return "This Week";
  if (diffDays < 30) return "This Month";
  return "Older";
}

export function getGroupValue(
  email: { from_address: string; received_at: string },
  groupBy: string,
): string {
  switch (groupBy) {
    case "company":
      return extractDisplayName(email.from_address);
    case "source":
      return extractSource(email.from_address);
    case "recency":
      return getRecencyBucket(email.received_at);
    default:
      return "";
  }
}

// ─── Gmail fetch ──────────────────────────────────────────────────────────

export interface FetchOptions {
  query: string;
  maxResults: number;
  rules: GmailRule[];
}

export async function fetchAndStoreEmails(
  api: WidgetApi,
  token: string,
  opts: FetchOptions,
  onProgress?: (count: number) => void,
): Promise<number> {
  const headers = { Authorization: `Bearer ${token}` };
  const { query, maxResults, rules } = opts;

  const listRes = await api.net.fetch(
    `${GMAIL_BASE}/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}&fields=messages(id,threadId),nextPageToken`,
    { headers },
  );
  if (!listRes.ok) throw new Error(`Gmail list failed: ${listRes.status}`);

  const listData = JSON.parse(listRes.body) as GmailListResponse;
  const refs = listData.messages ?? [];

  const existing = new Set<string>(
    (
      await api.sql.all<{ gmail_id: string }>("SELECT gmail_id FROM gd_emails")
    ).map((r) => r.gmail_id),
  );

  const now = Date.now();
  let fetched = 0;

  // Create fetch tasks for all messages
  const fetchTasks = refs.map((ref) => async () => {
    const isNew = !existing.has(ref.id);

    const msgRes = await api.net.fetch(
      `${GMAIL_BASE}/messages/${ref.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
      { headers },
    );
    if (!msgRes.ok) return null;

    const msg = JSON.parse(msgRes.body) as GmailApiMessage;
    const msgHeaders = msg.payload?.headers ?? [];
    const subject = getHeader(msgHeaders, "Subject");
    const from = getHeader(msgHeaders, "From");
    const dateStr = getHeader(msgHeaders, "Date");
    const snippet = msg.snippet ?? "";
    const labelIds = msg.labelIds ?? [];
    const isRead = !labelIds.includes("UNREAD") ? 1 : 0;

    let receivedAt = dateStr;
    try {
      receivedAt = new Date(dateStr).toISOString();
    } catch {
      /* keep raw */
    }

    // Resolve label names from IDs (we store label IDs as JSON for now)
    const labelNames = labelIds.filter(
      (l) => !["UNREAD", "INBOX", "IMPORTANT", "CATEGORY_PERSONAL"].includes(l),
    );

    const folderId = isNew
      ? applyRules(subject, from, snippet, labelNames, rules)
      : null;

    return {
      ref,
      isNew,
      subject,
      from,
      labelNames,
      receivedAt,
      snippet,
      folderId,
      isRead,
    };
  });

  // Execute fetches in parallel batches (pool of 8)
  const { batchAsync } = await import("@shared/concurrency");
  const fetchedMessages = await batchAsync(fetchTasks, 8);

  // Process fetched messages sequentially (respecting onProgress callback)
  for (const msg of fetchedMessages) {
    if (!msg) continue;

    if (msg.isNew) {
      await api.sql.run(UPSERT_EMAIL, [
        msg.ref.id,
        msg.ref.threadId,
        msg.subject,
        msg.from,
        JSON.stringify(msg.labelNames),
        msg.receivedAt,
        msg.snippet,
        msg.folderId,
        msg.isRead,
        now,
      ]);
      fetched++;
      onProgress?.(fetched);
    } else {
      // Update read status and snippet for existing emails
      await api.sql.run(
        ...namedSql(UPDATE_EMAIL_READ_AND_SNIPPET, {
          is_read: msg.isRead,
          snippet: msg.snippet,
          fetched_at: now,
          gmail_id: msg.ref.id,
        }),
      );
    }
  }

  return fetched;
}

// Re-apply rules to all emails (used after rules change)
export async function reapplyAllRules(
  api: WidgetApi,
  rules: GmailRule[],
): Promise<void> {
  const emails = await api.sql.all<{
    id: number;
    subject: string;
    from_address: string;
    snippet: string;
    labels: string;
  }>(
    "SELECT id, subject, from_address, snippet, labels FROM gd_emails WHERE override_folder_id IS NULL",
  );

  const batch = emails.map((e) => {
    const labelNames = JSON.parse(e.labels || "[]") as string[];
    const folderId = applyRules(
      e.subject,
      e.from_address,
      e.snippet,
      labelNames,
      rules,
    );
    return {
      sql: `UPDATE gd_emails SET folder_id = ? WHERE id = ?`,
      params: [folderId, e.id],
    };
  });

  if (batch.length > 0) await api.sql.runBatch(batch);
}
