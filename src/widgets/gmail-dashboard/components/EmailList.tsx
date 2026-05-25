import { useState, useMemo } from "react";
import type { GmailEmail, GmailFolder, GroupBy } from "../types";
import { extractDisplayName, getGroupValue } from "../gmail";
import { dimText, buttonTiny } from "../../_shared/styles";

// ─── Single email row ─────────────────────────────────────────────────────

function EmailRow({
  email,
  folders,
  onOpenGmail,
  onMove,
}: {
  email: GmailEmail;
  folders: GmailFolder[];
  onOpenGmail: (threadId: string) => void;
  onMove: (emailId: number, folderId: number | null) => void;
}) {
  const [showMove, setShowMove] = useState(false);
  const isUnread = email.is_read === 0;
  const hasOverride = email.override_folder_id != null;

  const dateDisplay = (() => {
    try {
      const d = new Date(email.received_at);
      const now = new Date();
      if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
      return d.toLocaleDateString([], { month: "short", day: "numeric" });
    } catch {
      return email.received_at.slice(0, 10);
    }
  })();

  const senderDisplay = extractDisplayName(email.from_address);

  return (
    <div
      style={{
        borderBottom: "1px solid var(--border)",
        padding: "6px 8px",
        fontSize: 12,
        cursor: "pointer",
        transition: "background 0.1s",
        background: isUnread ? "rgba(110,168,255,0.04)" : "transparent",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "rgba(255,255,255,0.04)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = isUnread
          ? "rgba(110,168,255,0.04)"
          : "transparent")
      }
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(100px,1fr) minmax(0,2fr) auto auto",
          gap: 8,
          alignItems: "center",
        }}
        onClick={() => onOpenGmail(email.thread_id)}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontWeight: isUnread ? 600 : 400,
            color: isUnread ? "var(--text)" : "var(--text-dim)",
          }}
        >
          {senderDisplay}
        </span>
        <div
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ fontWeight: isUnread ? 600 : 400 }}>
            {email.subject || "(no subject)"}
          </span>
          {email.snippet && (
            <span style={{ color: "var(--text-dim)", marginLeft: 6 }}>
              — {email.snippet.slice(0, 80)}
            </span>
          )}
        </div>
        <span style={{ ...dimText, fontSize: 11, whiteSpace: "nowrap" }}>
          {dateDisplay}
        </span>
        <button
          className="ghost"
          style={{
            ...buttonTiny,
            color: hasOverride ? "var(--accent)" : "var(--text-dim)",
            padding: "1px 4px",
          }}
          onClick={(e) => {
            e.stopPropagation();
            setShowMove((s) => !s);
          }}
          title="Move to folder"
        >
          ⋯
        </button>
      </div>

      {showMove && (
        <div
          style={{
            marginTop: 4,
            display: "flex",
            gap: 6,
            alignItems: "center",
            flexWrap: "wrap",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <span style={{ ...dimText, fontSize: 11 }}>Move to:</span>
          <select
            style={{ fontSize: 11, padding: "2px 4px" }}
            defaultValue=""
            onChange={(e) => {
              const val = e.target.value;
              onMove(email.id, val === "" ? null : Number(val));
              setShowMove(false);
            }}
          >
            <option value="">— auto (rule-assigned) —</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.icon ? `${f.icon} ` : ""}
                {f.name}
              </option>
            ))}
          </select>
          {hasOverride && (
            <button
              className="ghost"
              style={{ ...buttonTiny, color: "var(--text-dim)" }}
              onClick={() => {
                onMove(email.id, null);
                setShowMove(false);
              }}
            >
              Reset
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Grouped email section ────────────────────────────────────────────────

function EmailGroup({
  label,
  emails,
  folders,
  onOpenGmail,
  onMove,
}: {
  label: string;
  emails: GmailEmail[];
  folders: GmailFolder[];
  onOpenGmail: (threadId: string) => void;
  onMove: (emailId: number, folderId: number | null) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const unread = emails.filter((e) => e.is_read === 0).length;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 8px",
          background: "var(--panel-2)",
          borderBottom: "1px solid var(--border)",
          cursor: "pointer",
          userSelect: "none",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-dim)",
        }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <span style={{ fontSize: 9, opacity: 0.6 }}>
          {collapsed ? "▶" : "▼"}
        </span>
        <span style={{ flex: 1 }}>{label}</span>
        {unread > 0 && (
          <span
            style={{
              background: "var(--accent)",
              color: "#fff",
              borderRadius: 8,
              padding: "0 5px",
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            {unread}
          </span>
        )}
        <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>
          {emails.length}
        </span>
      </div>
      {!collapsed &&
        emails.map((email) => (
          <EmailRow
            key={email.id}
            email={email}
            folders={folders}
            onOpenGmail={onOpenGmail}
            onMove={onMove}
          />
        ))}
    </div>
  );
}

// ─── EmailList ────────────────────────────────────────────────────────────

interface EmailListProps {
  emails: GmailEmail[];
  folders: GmailFolder[];
  groupBy: GroupBy;
  onOpenGmail: (threadId: string) => void;
  onMove: (emailId: number, folderId: number | null) => void;
}

export function EmailList({
  emails,
  folders,
  groupBy,
  onOpenGmail,
  onMove,
}: EmailListProps) {
  const groups = useMemo(() => {
    if (groupBy === "none") {
      return [{ label: "", emails }];
    }

    const map = new Map<string, GmailEmail[]>();
    for (const email of emails) {
      const key = getGroupValue(email, groupBy) || "Other";
      const arr = map.get(key) ?? [];
      arr.push(email);
      map.set(key, arr);
    }

    // Sort groups: recency has a fixed order, others alphabetical
    const recencyOrder = [
      "Today",
      "This Week",
      "This Month",
      "Older",
      "Unknown",
    ];
    const entries = [...map.entries()];
    if (groupBy === "recency") {
      entries.sort(
        ([a], [b]) => recencyOrder.indexOf(a) - recencyOrder.indexOf(b),
      );
    } else {
      entries.sort(([a], [b]) => a.localeCompare(b));
    }

    return entries.map(([label, grpEmails]) => ({ label, emails: grpEmails }));
  }, [emails, groupBy]);

  if (emails.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-dim)",
          fontSize: 12,
        }}
      >
        No emails in this folder
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
      {groupBy === "none"
        ? emails.map((email) => (
            <EmailRow
              key={email.id}
              email={email}
              folders={folders}
              onOpenGmail={onOpenGmail}
              onMove={onMove}
            />
          ))
        : groups.map(({ label, emails: grpEmails }) => (
            <EmailGroup
              key={label}
              label={label}
              emails={grpEmails}
              folders={folders}
              onOpenGmail={onOpenGmail}
              onMove={onMove}
            />
          ))}
    </div>
  );
}
