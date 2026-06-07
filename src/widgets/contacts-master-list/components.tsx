import { useState } from "react";
import type { Contact, ContactEdit } from "./types";
import { formatBirthday, initials } from "./helpers";
import { inp, buttonSmall } from "../_shared/styles";

// ─── Avatar ────────────────────────────────────────────────────────────────

function Avatar({ contact }: { contact: Contact }) {
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

function DetailRow({
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

// ─── EditContactForm ───────────────────────────────────────────────────────

function EditContactForm({
  contact,
  onSave,
  onCancel,
  saving,
}: {
  contact: Contact;
  onSave: (edit: ContactEdit) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const [givenName, setGivenName] = useState(contact.givenName);
  const [familyName, setFamilyName] = useState(contact.familyName);
  const [emails, setEmails] = useState(
    contact.emails.length > 0
      ? contact.emails.map((e) => ({
          value: e.value ?? "",
          type: e.type ?? "other",
        }))
      : [{ value: "", type: "other" }],
  );
  const [phones, setPhones] = useState(
    contact.phones.length > 0
      ? contact.phones.map((p) => ({
          value: p.value ?? "",
          type: p.type ?? "mobile",
        }))
      : [{ value: "", type: "mobile" }],
  );
  const [orgName, setOrgName] = useState(contact.organizations[0]?.name ?? "");
  const [orgTitle, setOrgTitle] = useState(
    contact.organizations[0]?.title ?? "",
  );
  const [note, setNote] = useState(contact.note);

  const fieldStyle = { ...inp, fontSize: 11, padding: "3px 6px" } as const;
  const labelStyle = {
    fontSize: 10,
    color: "var(--text-dim)",
    marginBottom: 2,
  } as const;

  const handleSave = () => {
    void onSave({
      givenName,
      familyName,
      emails,
      phones,
      orgName,
      orgTitle,
      note,
    });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "6px 0",
      }}
    >
      <div style={{ display: "flex", gap: 6 }}>
        <input
          style={{ ...fieldStyle, flex: 1 }}
          placeholder="First name"
          value={givenName}
          onChange={(e) => setGivenName(e.target.value)}
          disabled={saving}
        />
        <input
          style={{ ...fieldStyle, flex: 1 }}
          placeholder="Last name"
          value={familyName}
          onChange={(e) => setFamilyName(e.target.value)}
          disabled={saving}
        />
      </div>

      <div>
        <div style={labelStyle}>Emails</div>
        {emails.map((email, i) => (
          <div key={i} style={{ display: "flex", gap: 4, marginBottom: 3 }}>
            <input
              style={{ ...fieldStyle, flex: 1 }}
              placeholder="email@example.com"
              value={email.value}
              onChange={(e) => {
                const next = [...emails];
                next[i] = { ...next[i], value: e.target.value };
                setEmails(next);
              }}
              disabled={saving}
            />
            <select
              style={{ ...fieldStyle, width: 72 }}
              value={email.type}
              onChange={(e) => {
                const next = [...emails];
                next[i] = { ...next[i], type: e.target.value };
                setEmails(next);
              }}
              disabled={saving}
            >
              <option value="home">Home</option>
              <option value="work">Work</option>
              <option value="other">Other</option>
            </select>
            <button
              className="ghost"
              style={{ ...buttonSmall, padding: "0 6px" }}
              onClick={() => setEmails(emails.filter((_, j) => j !== i))}
              disabled={saving}
            >
              ×
            </button>
          </div>
        ))}
        <button
          className="ghost"
          style={{ ...buttonSmall, fontSize: 10 }}
          onClick={() => setEmails([...emails, { value: "", type: "other" }])}
          disabled={saving}
        >
          + Email
        </button>
      </div>

      <div>
        <div style={labelStyle}>Phones</div>
        {phones.map((phone, i) => (
          <div key={i} style={{ display: "flex", gap: 4, marginBottom: 3 }}>
            <input
              style={{ ...fieldStyle, flex: 1 }}
              placeholder="+1 555 000 0000"
              value={phone.value}
              onChange={(e) => {
                const next = [...phones];
                next[i] = { ...next[i], value: e.target.value };
                setPhones(next);
              }}
              disabled={saving}
            />
            <select
              style={{ ...fieldStyle, width: 72 }}
              value={phone.type}
              onChange={(e) => {
                const next = [...phones];
                next[i] = { ...next[i], type: e.target.value };
                setPhones(next);
              }}
              disabled={saving}
            >
              <option value="mobile">Mobile</option>
              <option value="home">Home</option>
              <option value="work">Work</option>
              <option value="other">Other</option>
            </select>
            <button
              className="ghost"
              style={{ ...buttonSmall, padding: "0 6px" }}
              onClick={() => setPhones(phones.filter((_, j) => j !== i))}
              disabled={saving}
            >
              ×
            </button>
          </div>
        ))}
        <button
          className="ghost"
          style={{ ...buttonSmall, fontSize: 10 }}
          onClick={() => setPhones([...phones, { value: "", type: "mobile" }])}
          disabled={saving}
        >
          + Phone
        </button>
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <input
          style={{ ...fieldStyle, flex: 1 }}
          placeholder="Company"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          disabled={saving}
        />
        <input
          style={{ ...fieldStyle, flex: 1 }}
          placeholder="Title"
          value={orgTitle}
          onChange={(e) => setOrgTitle(e.target.value)}
          disabled={saving}
        />
      </div>

      <textarea
        style={{
          ...fieldStyle,
          height: 48,
          resize: "vertical",
          fontFamily: "inherit",
          width: "100%",
          boxSizing: "border-box",
        }}
        placeholder="Note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        disabled={saving}
      />

      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button
          className="ghost"
          style={buttonSmall}
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          style={{
            ...buttonSmall,
            background: "var(--accent)",
            color: "var(--accent-fg, #fff)",
            border: "none",
            borderRadius: 4,
            cursor: saving ? "default" : "pointer",
          }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ─── ContactRow ────────────────────────────────────────────────────────────

export function ContactRow({
  contact,
  expanded,
  onToggle,
  editing,
  onEdit,
  onSave,
  onCancelEdit,
  saving,
}: {
  contact: Contact;
  expanded: boolean;
  onToggle: () => void;
  editing: boolean;
  onEdit: () => void;
  onSave: (edit: ContactEdit) => Promise<void>;
  onCancelEdit: () => void;
  saving: boolean;
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
      {expanded && !editing && (
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
          <div
            style={{
              marginTop: 4,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button className="ghost" style={buttonSmall} onClick={onEdit}>
              Edit
            </button>
          </div>
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div style={{ padding: "4px 12px 10px 12px" }}>
          <EditContactForm
            contact={contact}
            onSave={onSave}
            onCancel={onCancelEdit}
            saving={saving}
          />
        </div>
      )}
    </div>
  );
}
