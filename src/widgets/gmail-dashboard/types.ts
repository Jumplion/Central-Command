export interface GmailFolder {
  id: number;
  name: string;
  parent_id: number | null;
  sort_order: number;
  icon: string | null;
  created_at: string;
}

export interface GmailRule {
  id: number;
  folder_id: number;
  field: "subject" | "from" | "label" | "snippet";
  operator: "contains" | "starts_with" | "ends_with" | "regex" | "not_contains";
  value: string;
  priority: number;
  created_at: string;
}

export interface GmailEmail {
  id: number;
  gmail_id: string;
  thread_id: string;
  subject: string;
  from_address: string;
  labels: string; // JSON array string
  received_at: string;
  snippet: string;
  folder_id: number | null;
  override_folder_id: number | null;
  is_read: number;
  fetched_at: number;
}

// Computed effective folder: override takes priority over rule-assigned
export type EmailWithFolder = GmailEmail & {
  effective_folder_id: number | null;
};

export type GroupBy = "none" | "company" | "source" | "recency";

export interface FolderTreeNode extends GmailFolder {
  children: FolderTreeNode[];
  emailCount: number;
  unreadCount: number;
}

// Raw Gmail API types
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

export interface GmailApiMessage {
  id: string;
  threadId: string;
  snippet: string;
  labelIds?: string[];
  payload: GmailPayload;
}

export interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
}
