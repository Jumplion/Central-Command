import { useState, useEffect, useCallback, useMemo } from "react";
import type { Widget, WidgetProps } from "@renderer/plugins/registry";
import {
  buttonSmall,
  dimText,
  inp,
  mutedText,
  smallDimText,
} from "../_shared/styles";
import { NotConnected } from "../_shared/NotConnected";

// ─── Types ─────────────────────────────────────────────────────────────────

interface PersonName {
  displayName?: string;
  givenName?: string;
  familyName?: string;
}

interface EmailAddress {
  value?: string;
  type?: string;
  formattedType?: string;
}

interface PhoneNumber {
  value?: string;
  type?: string;
  formattedType?: string;
}

interface Organization {
  name?: string;
  title?: string;
  department?: string;
}

interface Address {
  formattedValue?: string;
  type?: string;
  formattedType?: string;
}

interface Birthday {
  date?: { year?: number; month?: number; day?: number };
  text?: string;
}

interface Photo {
  url?: string;
  default?: boolean;
}

interface Url {
  value?: string;
  type?: string;
  formattedType?: string;
}

interface Biography {
  value?: string;
}

interface RawPerson {
  resourceName: string;
  etag?: string;
  names?: PersonName[];
  emailAddresses?: EmailAddress[];
  phoneNumbers?: PhoneNumber[];
  organizations?: Organization[];
  addresses?: Address[];
  birthdays?: Birthday[];
  photos?: Photo[];
  urls?: Url[];
  biographies?: Biography[];
}

interface Contact {
  id: string;
  displayName: string;
  givenName: string;
  familyName: string;
  emails: EmailAddress[];
  phones: PhoneNumber[];
  organizations: Organization[];
  addresses: Address[];
  birthdays: Birthday[];
  photoUrl: string | null;
  urls: Url[];
  note: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function parseContact(p: RawPerson): Contact {
  const photo = p.photos?.find((ph) => !ph.default) ?? p.photos?.[0];
  return {
    id: p.resourceName,
    displayName: p.names?.[0]?.displayName ?? "(no name)",
    givenName: p.names?.[0]?.givenName ?? "",
    familyName: p.names?.[0]?.familyName ?? "",
    emails: p.emailAddresses ?? [],
    phones: p.phoneNumbers ?? [],
    organizations: p.organizations ?? [],
    addresses: p.addresses ?? [],
    birthdays: p.birthdays ?? [],
    photoUrl: photo?.url ?? null,
    urls: p.urls ?? [],
    note: p.biographies?.[0]?.value ?? "",
  };
}

function formatBirthday(b: Birthday): string {
  if (b.text) return b.text;
  if (!b.date) return "";
  const { year, month, day } = b.date;
  const parts: string[] = [];
  if (month) parts.push(String(month).padStart(2, "0"));
  if (day) parts.push(String(day).padStart(2, "0"));
  const base = parts.join("/");
  return year ? `${year}/${base}` : base;
}

function initials(c: Contact): string {
  if (c.givenName && c.familyName)
    return (c.givenName[0] + c.familyName[0]).toUpperCase();
  if (c.displayName && c.displayName !== "(no name)")
    return c.displayName.slice(0, 2).toUpperCase();
  return "?";
}

function contactMatchesQuery(c: Contact, q: string): boolean {
  const lower = q.toLowerCase();
  if (c.displayName.toLowerCase().includes(lower)) return true;
  if (c.emails.some((e) => e.value?.toLowerCase().includes(lower))) return true;
  if (c.phones.some((p) => p.value?.toLowerCase().includes(lower))) return true;
  if (
    c.organizations.some(
      (o) =>
        o.name?.toLowerCase().includes(lower) ||
        o.title?.toLowerCase().includes(lower),
    )
  )
    return true;
  return false;
}

const PERSON_FIELDS =
  "names,emailAddresses,phoneNumbers,organizations,addresses,birthdays,photos,urls,biographies";

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
    <div style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 11 }}>
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

function ContactRow({
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
    <div
      style={{ borderBottom: "1px solid var(--border)" }}
    >
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
          {contact.note && (
            <DetailRow label="Note" value={contact.note} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main widget ───────────────────────────────────────────────────────────

function ContactsMasterList({ api, setTitle }: WidgetProps) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await api.google.shared.getToken("contacts");
      if (!token) {
        setConnected(false);
        return;
      }

      const all: Contact[] = [];
      let pageToken: string | undefined;

      do {
        const params = new URLSearchParams({ personFields: PERSON_FIELDS, pageSize: "1000" });
        if (pageToken) params.set("pageToken", pageToken);

        const res = await api.net.fetch(
          `https://people.googleapis.com/v1/people/me/connections?${params.toString()}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (!res.ok) {
          if (res.status === 401) {
            setConnected(false);
            setError("Session expired — reconnect Google in App Settings.");
          } else {
            throw new Error(`People API error: ${res.status}`);
          }
          return;
        }

        const data = JSON.parse(res.body) as {
          connections?: RawPerson[];
          nextPageToken?: string;
        };

        for (const p of data.connections ?? []) {
          all.push(parseContact(p));
        }

        pageToken = data.nextPageToken;
      } while (pageToken);

      all.sort((a, b) => a.displayName.localeCompare(b.displayName));
      setContacts(all);
      setTitle?.(`Contacts (${all.length})`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api, setTitle]);

  useEffect(() => {
    api.google.shared
      .isConnected("contacts")
      .then((c) => setConnected(c))
      .catch(() => setConnected(false));
  }, [api]);

  useEffect(() => {
    if (connected) void loadContacts();
  }, [connected, loadContacts]);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return contacts;
    return contacts.filter((c) => contactMatchesQuery(c, q));
  }, [contacts, query]);

  // ── Connection loading ──────────────────────────────────────────────────
  if (connected === null) {
    return <div style={{ padding: 12, ...dimText, fontSize: 12 }}>Loading…</div>;
  }

  if (!connected) {
    return <NotConnected />;
  }

  // ── Connected ────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          flexShrink: 0,
          padding: "0 0 6px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <input
          type="search"
          placeholder="Search contacts…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setExpandedId(null);
          }}
          style={{ ...inp, flex: 1, minWidth: 0 }}
        />
        <button
          className="ghost"
          style={buttonSmall}
          onClick={() => void loadContacts()}
          disabled={loading}
          title="Refresh contacts"
        >
          {loading ? "…" : "↻"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ fontSize: 11, color: "var(--danger)", flexShrink: 0, padding: "4px 0" }}>
          {error}
        </div>
      )}

      {/* Count hint */}
      {!loading && contacts.length > 0 && query && (
        <div style={{ ...smallDimText, flexShrink: 0, padding: "3px 0" }}>
          {filtered.length} of {contacts.length}
        </div>
      )}

      {/* List */}
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        {loading && contacts.length === 0 ? (
          <div style={{ padding: 12, ...dimText, fontSize: 12 }}>Loading contacts…</div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              padding: "24px 0",
              textAlign: "center",
              ...mutedText,
            }}
          >
            {query ? "No contacts match your search." : "No contacts found."}
          </div>
        ) : (
          filtered.map((c) => (
            <ContactRow
              key={c.id}
              contact={c}
              expanded={expandedId === c.id}
              onToggle={() => setExpandedId((prev) => (prev === c.id ? null : c.id))}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Widget export ─────────────────────────────────────────────────────────

const widget: Widget = {
  manifest: {
    id: "contacts-master-list",
    name: "Contacts Master List",
    description:
      "Browse, search, and explore your Google Contacts. Requires a Google Cloud OAuth app with the Contacts scope.",
    version: "0.1.0",
    icon: "👥",
    defaultSize: { w: 5, h: 9 },
    minSize: { w: 3, h: 5 },
    permissions: { google: true },
  },
  Component: ContactsMasterList,
};

export default widget;
