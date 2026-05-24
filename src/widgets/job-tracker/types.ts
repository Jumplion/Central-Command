export type Status =
  | "Applied"
  | "Phone"
  | "Onsite"
  | "Offer"
  | "Rejected"
  | "Ghosted"
  | "Viewed";

export const STATUSES: Status[] = [
  "Applied",
  "Viewed",
  "Phone",
  "Onsite",
  "Offer",
  "Rejected",
  "Ghosted",
];

export const STATUS_COLOR: Record<Status, string> = {
  Applied: "#6ea8ff",
  Viewed: "#06b6d4",
  Phone: "#a78bfa",
  Onsite: "#f59e0b",
  Offer: "#34d399",
  Rejected: "#ff6e6e",
  Ghosted: "#6b7280",
};

export interface Application {
  id: number;
  company: string;
  role: string;
  status: Status;
  applied_at: string;
  location: string;
  source: string;
  link: string;
  notes: string;
  req_number: string;
  last_updated: number;
}

export type AppFormData = Omit<Application, "id" | "last_updated">;

export interface ParsedJobEmail {
  id: number;
  gmail_id: string;
  thread_id: string;
  subject: string;
  from_address: string;
  received_at: string;
  snippet: string;
  parsed_company: string;
  parsed_role: string;
  parsed_status: string;
  parsed_req_number: string;
  application_id: number | null;
  dismissed: number;
  fetched_at: number;
}

export type EmailSuggestion =
  | { kind: "add"; prefill: AppFormData }
  | { kind: "update"; app: Application; newStatus: Status };

export interface JtEmailRule {
  id: number;
  status: string;
  field: "subject" | "body" | "from";
  operator: "contains" | "not_contains" | "starts_with" | "ends_with" | "regex";
  value: string;
  priority: number;
  created_at: string;
}

export interface JtAtsDomain {
  id: number;
  domain: string;
  company: string;
  created_at: string;
}

export interface JtQueryRule {
  id: number;
  label: string;
  value: string;
  enabled: number;
  created_at: string;
}

export interface JtEmailConfig {
  id: 1;
  query: string;
  days_back: number;
  max_results: number;
}
