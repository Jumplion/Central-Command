/**
 * Gmail fetching and parsing logic for the Job Tracker "Emails" tab.
 *
 * All Gmail API calls go through `api.net.fetch` (Electron's net stack) with
 * a caller-supplied access token. Parsing is purely heuristic — the user
 * always reviews suggestions before any tracker entry is created or updated.
 */

import type { WidgetApi } from "@renderer/plugins/api";
import type {
  Application,
  AppFormData,
  EmailSuggestion,
  JtAtsDomain,
  JtEmailRule,
  ParsedJobEmail,
  Status,
} from "./types";
import { STATUSES } from "./types";
import {
  type GmailHeader,
  type GmailPayload,
  type GmailApiMessage,
  type GmailListResponse,
  getHeader,
  extractBodyText,
} from "../_shared/gmail";

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

// ─── Rule-based status detection ─────────────────────────────────────────

function ruleMatches(
  source: string,
  operator: JtEmailRule["operator"],
  value: string,
): boolean {
  const s = source.toLowerCase();
  const v = value.toLowerCase();
  switch (operator) {
    case "contains":
      return s.includes(v);
    case "not_contains":
      return !s.includes(v);
    case "starts_with":
      return s.startsWith(v);
    case "ends_with":
      return s.endsWith(v);
    case "regex": {
      try {
        return new RegExp(value, "i").test(source);
      } catch {
        return false;
      }
    }
  }
}

// ─── Parsing ──────────────────────────────────────────────────────────────

/**
 * Detect job-related status using dynamic rules (sorted by priority DESC).
 * Falls back to "Applied" if no rule matches.
 */
export function parseJobStatus(
  subject: string,
  body: string,
  rules: JtEmailRule[],
): Status {
  for (const rule of rules) {
    const source =
      rule.field === "subject" ? subject : rule.field === "from" ? "" : body;
    if (ruleMatches(source, rule.operator, rule.value)) {
      const s = rule.status as Status;
      if ((STATUSES as string[]).includes(s)) return s;
    }
  }
  return "Applied";
}

/** Extract a company name from subject, body, and sender address. */
export function parseCompany(
  subject: string,
  from: string,
  body: string,
  atsDomains: JtAtsDomain[],
): string {
  const text = subject + "\n" + body;

  // From display name: "Acme Corp <noreply@greenhouse.io>" → "Acme Corp"
  const displayMatch = from.match(/^([^<]+?)\s*</);
  const displayName = displayMatch ? displayMatch[1].trim() : "";

  // Sender domain
  const domainMatch = from.match(/@([\w.-]+)/);
  const domain = domainMatch ? domainMatch[1].toLowerCase() : "";

  // Check dynamic ATS domain map
  const atsEntry = atsDomains.find((d) => domain.endsWith(d.domain));
  const isATS = !!atsEntry;
  if (atsEntry?.company) return atsEntry.company;

  // Body / subject patterns
  const patterns = [
    /(?:your application (?:to|with|at)|applying (?:to|at|with))\s+([A-Z][A-Za-z0-9&., '-]{1,60}?)(?:\s+(?:has|is|was|has been|team|for\b)|[,!.\n]|$)/m,
    /(?:team at|joining|opportunity at|role at|position at)\s+([A-Z][A-Za-z0-9&., '-]{1,60}?)(?:\s+(?:is|as|for\b|team)|[,!.\n]|$)/m,
    /([A-Z][A-Za-z0-9&., '-]{1,60}?)\s+(?:Talent Acquisition|Recruiting|HR|People Team|Careers)/m,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].trim().replace(/[,.]$/, "");
  }

  if (isATS && displayName) return displayName;

  // Use the display name as fallback (strip email-address-only senders)
  if (displayName && !displayName.includes("@")) return displayName;

  // Last resort: capitalize the main domain part
  const mainDomain = domain.split(".").slice(-2, -1)[0] ?? "";
  return mainDomain
    ? mainDomain.charAt(0).toUpperCase() + mainDomain.slice(1)
    : "";
}

/** Extract a job title/role from subject and body. */
export function parseRole(subject: string, body: string): string {
  const text = subject + "\n" + body;

  const patterns = [
    /(?:Position|Role|Job Title|Title|Opening)\s*:\s*([^\n,]{3,80})/i,
    /(?:for the|for a|for an)\s+([A-Z][A-Za-z0-9 /+#()-]{2,60}?)\s+(?:position|role|opportunity|opening)/i,
    /([A-Z][A-Za-z0-9 /+#()-]{2,60}?)\s+at\s+[A-Z]/,
    /applying (?:for|to)(?: the| a| an)?\s+([A-Z][A-Za-z0-9 /+#()-]{2,60}?)(?:\s+position|\s+role|\s+opening|[,.\n!])/i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const role = m[1].trim().replace(/[,.]$/, "");
      // Filter out false positives (too short, all-caps abbreviations, etc.)
      if (role.length >= 3 && role.length <= 80) return role;
    }
  }
  return "";
}

// ─── Fuzzy matching ───────────────────────────────────────────────────────

const NOISE_RE =
  /\b(inc|llc|ltd|corp|co|company|technologies|tech|group|labs|ai)\b\.?/gi;

function normalizeCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(NOISE_RE, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// ─── Fetch options ────────────────────────────────────────────────────────

export interface FetchJobEmailsOptions {
  query: string;
  daysBack: number;
  maxResults: number;
  rules: JtEmailRule[];
  atsDomains: JtAtsDomain[];
}

// ─── Public API ───────────────────────────────────────────────────────────

/** Extract a requisition / job-ID number from subject and body text. */
export function parseReqNumber(subject: string, body: string): string {
  const text = subject + "\n" + body;
  const patterns = [
    /(?:requisition|req(?:uisition)?|job|position|opening)\s*(?:#|id\b|no\.?\s*|number\b)\s*(?:[:#]?\s*)?([A-Za-z0-9_-]*[0-9][A-Za-z0-9_-]{2,29})/i,
    /(?:ref(?:erence)?)\s*(?:#|id\b|no\.?\s*|number\b)\s*(?:[:#]?\s*)?([A-Za-z0-9_-]*[0-9][A-Za-z0-9_-]{2,29})/i,
    /\bJR[-_]?([0-9]{4,10})\b/i,
    /\bREQ[-_]?([0-9]{4,10})\b/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return "";
}
/**
 * Fetch job-related emails from Gmail, upsert them into the `email_jobs` table,
 * and return all currently stored emails ordered newest first.
 */
export async function fetchJobEmails(
  api: WidgetApi,
  token: string,
  opts: FetchJobEmailsOptions,
): Promise<ParsedJobEmail[]> {
  const { query, daysBack, maxResults, rules, atsDomains } = opts;
  const headers = { Authorization: `Bearer ${token}` };

  const fullQuery = `(${query}) newer_than:${daysBack}d`;

  // 1. List matching messages
  const listRes = await api.net.fetch(
    `${GMAIL_BASE}/messages?q=${encodeURIComponent(fullQuery)}&maxResults=${maxResults}&fields=messages(id,threadId),nextPageToken`,
    { headers },
  );
  if (!listRes.ok) throw new Error(`Gmail list failed: ${listRes.status}`);

  const listData = JSON.parse(listRes.body) as GmailListResponse;
  const messageRefs = listData.messages ?? [];

  // 2. Fetch each message detail (skip ones already in DB)
  const existing = new Set<string>(
    (
      await api.sql.all<{ gmail_id: string }>("SELECT gmail_id FROM email_jobs")
    ).map((r) => r.gmail_id),
  );

  const now = Date.now();

  for (const ref of messageRefs) {
    if (existing.has(ref.id)) continue;

    const msgRes = await api.net.fetch(
      `${GMAIL_BASE}/messages/${ref.id}?format=full&fields=id,threadId,snippet,payload(headers,mimeType,body,parts(mimeType,body,headers,parts(mimeType,body)))`,
      { headers },
    );
    if (!msgRes.ok) continue;

    const msg = JSON.parse(msgRes.body) as GmailApiMessage;
    const msgHeaders = msg.payload?.headers ?? [];
    const subject = getHeader(msgHeaders, "Subject");
    const from = getHeader(msgHeaders, "From");
    const dateStr = getHeader(msgHeaders, "Date");
    const snippet = msg.snippet ?? "";

    // Parse received_at as ISO string
    let receivedAt = dateStr;
    try {
      receivedAt = new Date(dateStr).toISOString();
    } catch {
      /* keep raw */
    }

    const bodyText = extractBodyText(msg.payload, 3000);
    const parsed_company = parseCompany(subject, from, bodyText, atsDomains);
    const parsed_role = parseRole(subject, bodyText);
    const parsed_status = parseJobStatus(subject, bodyText, rules);
    const parsed_req_number = parseReqNumber(subject, bodyText);

    await api.sql.run(
      `INSERT OR IGNORE INTO email_jobs
        (gmail_id, thread_id, subject, from_address, received_at, snippet,
         parsed_company, parsed_role, parsed_status, parsed_req_number, fetched_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        ref.id,
        ref.threadId,
        subject,
        from,
        receivedAt,
        snippet,
        parsed_company,
        parsed_role,
        parsed_status,
        parsed_req_number,
        now,
      ],
    );
  }

  // 3. Return all stored emails ordered newest first
  return api.sql.all<ParsedJobEmail>(
    "SELECT * FROM email_jobs ORDER BY received_at DESC",
  );
}

/**
 * Given a parsed email and existing applications, build an `EmailSuggestion`:
 * - If there's a matching application → suggest updating its status.
 * - Otherwise → suggest adding a new application with pre-filled data.
 */
export function buildSuggestion(
  email: ParsedJobEmail,
  apps: Application[],
): EmailSuggestion {
  const normEmail = normalizeCompany(email.parsed_company);

  const companyMatches = normEmail
    ? apps.filter((a) => normalizeCompany(a.company) === normEmail)
    : [];

  if (companyMatches.length > 0) {
    const normRole = email.parsed_role.toLowerCase().trim();
    const roleMatch = normRole
      ? companyMatches.find(
          (a) =>
            a.role.toLowerCase().includes(normRole) ||
            normRole.includes(a.role.toLowerCase()),
        )
      : null;
    const best = roleMatch ?? companyMatches[0];
    const newStatus = email.parsed_status as Status;
    return { kind: "update", app: best, newStatus };
  }

  const prefill: AppFormData = {
    company: email.parsed_company,
    role: email.parsed_role,
    status: (email.parsed_status as Status) || "Applied",
    applied_at: email.received_at.slice(0, 10),
    location: "",
    source: "Gmail",
    link: `https://mail.google.com/mail/u/0/#inbox/${email.thread_id}`,
    notes: "",
    req_number: email.parsed_req_number,
  };
  return { kind: "add", prefill };
}
