import { useState } from "react";
import type { Contact } from "./types";
import { formatBirthday, initials } from "./helpers";

// ─── Avatar ────────────────────────────────────────────────────────────────

export function Avatar({ contact }: { contact: Contact }) {
  const [imgFailed, setImgFailed] = useState(false);

  if (contact.photoUrl && !imgFailed) {
    return (
      <img
        src={contact.photoUrl}
        alt=""
        onError={() => setImgFailed(true)}
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: "var(--accent)",
        color: "var(--accent-fg, #fff)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        fontWeight: 700,
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {initials(contact)}
    </div>
  );
}

// ─── DetailRow ─────────────────────────────────────────────────────────────

export function DetailRow({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div
      style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 11 }}
    >
      <span style={{ color: "var(--text-dim)", minWidth: 64, flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ color: "var(--text)" }}>
        {value}
        {sub && (
          <span style={{ color: "var(--text-dim)", marginLeft: 4 }}>{sub}</span>
        )}
      </span>
    </div>
  );
}

// ─── ContactRow ────────────────────────────────────────────────────────────

export function ContactRow({
  contact,
  expanded,
  onToggle,
}: {
  contact: Contact;
  expanded: boolean;
  onToggle: () => void;
}) {
  const primaryEmail = contact.emails[0]?.value;
  const primaryPhone = contact.phones[0]?.value;
  const primaryOrg = contact.organizations[0];
  const subtitle = primaryOrg?.name ?? primaryEmail ?? primaryPhone ?? "";

  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      {/* Summary row */}
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "7px 6px",
          cursor: "pointer",
        }}
      >
        <Avatar contact={contact} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {contact.displayName}
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: 11,
                color: "var(--text-dim)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
        <span
          style={{
            fontSize: 10,
            color: "var(--text-dim)",
            flexShrink: 0,
            transition: "transform 0.15s",
            transform: expanded ? "rotate(90deg)" : "none",
          }}
        >
          ▶
        </span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          style={{
            padding: "4px 12px 10px 48px",
            display: "flex",
            flexDirection: "column",
            gap: 5,
          }}
        >
          {contact.emails.map((e, i) => (
            <DetailRow
              key={i}
              label={e.formattedType ?? e.type ?? "Email"}
              value={e.value ?? ""}
            />
          ))}
          {contact.phones.map((p, i) => (
            <DetailRow
              key={i}
              label={p.formattedType ?? p.type ?? "Phone"}
              value={p.value ?? ""}
            />
          ))}
          {contact.organizations.map((o, i) => (
            <DetailRow
              key={i}
              label="Company"
              value={o.name ?? ""}
              sub={[o.title, o.department].filter(Boolean).join(" · ")}
            />
          ))}
          {contact.addresses.map((a, i) => (
            <DetailRow
              key={i}
              label={a.formattedType ?? a.type ?? "Address"}
              value={a.formattedValue ?? ""}
            />
          ))}
          {contact.birthdays.map((b, i) => (
            <DetailRow key={i} label="Birthday" value={formatBirthday(b)} />
          ))}
          {contact.urls.map((u, i) => (
            <DetailRow
              key={i}
              label={u.formattedType ?? u.type ?? "URL"}
              value={u.value ?? ""}
            />
          ))}
          {contact.note && <DetailRow label="Note" value={contact.note} />}
        </div>
      )}
    </div>
  );
}
