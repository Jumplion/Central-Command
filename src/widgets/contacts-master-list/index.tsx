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
import { PEOPLE_API_BASE, PEOPLE_API_UPDATE_BASE, PERSON_FIELDS, PAGE_SIZE, UPDATE_PERSON_FIELDS } from "./constants";
import { parseContact, contactMatchesQuery } from "./helpers";
import { ContactRow } from "./components";
import type { Contact, ContactEdit, RawPerson } from "./types";

// ─── Main widget ───────────────────────────────────────────────────────────

function ContactsMasterList({ api, setTitle }: WidgetProps) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await api.google.shared.getToken();
      if (!token) {
        setConnected(false);
        return;
      }

      const all: Contact[] = [];
      let pageToken: string | undefined;

      do {
        const params = new URLSearchParams({
          personFields: PERSON_FIELDS,
          pageSize: PAGE_SIZE,
        });
        if (pageToken) params.set("pageToken", pageToken);

        const res = await api.net.fetch(
          `${PEOPLE_API_BASE}?${params.toString()}`,
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

  const saveContact = useCallback(
    async (contact: Contact, edit: ContactEdit) => {
      setSavingId(contact.id);
      setError(null);
      try {
        const token = await api.google.shared.getToken();
        if (!token) {
          setConnected(false);
          return;
        }

        const body = JSON.stringify({
          etag: contact.etag,
          names: [{ givenName: edit.givenName, familyName: edit.familyName }],
          emailAddresses: edit.emails.map((e) => ({ value: e.value, type: e.type })),
          phoneNumbers: edit.phones.map((p) => ({ value: p.value, type: p.type })),
          organizations: edit.orgName
            ? [{ name: edit.orgName, title: edit.orgTitle }]
            : [],
          biographies: edit.note ? [{ value: edit.note }] : [],
        });

        const res = await api.net.fetch(
          `${PEOPLE_API_UPDATE_BASE}/${contact.id}:updateContact?updatePersonFields=${UPDATE_PERSON_FIELDS}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body,
          },
        );

        if (!res.ok) {
          if (res.status === 401) {
            setConnected(false);
            setError("Session expired — reconnect Google in App Settings.");
          } else {
            throw new Error(`Update failed: ${res.status}`);
          }
          return;
        }

        const updated = JSON.parse(res.body) as RawPerson;
        const updatedContact = parseContact(updated);
        setContacts((prev) => {
          const next = prev.map((c) =>
            c.id === contact.id ? updatedContact : c,
          );
          next.sort((a, b) => a.displayName.localeCompare(b.displayName));
          return next;
        });
        setEditingId(null);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSavingId(null);
      }
    },
    [api],
  );

  useEffect(() => {
    api.google.shared
      .isConnected()
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

  if (connected === null) {
    return (
      <div style={{ padding: 12, ...dimText, fontSize: 12 }}>Loading…</div>
    );
  }

  if (!connected) {
    return <NotConnected />;
  }

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
        <div
          style={{
            fontSize: 11,
            color: "var(--danger)",
            flexShrink: 0,
            padding: "4px 0",
          }}
        >
          {error}
        </div>
      )}

      {/* Count hint when filtering */}
      {!loading && contacts.length > 0 && query && (
        <div style={{ ...smallDimText, flexShrink: 0, padding: "3px 0" }}>
          {filtered.length} of {contacts.length}
        </div>
      )}

      {/* List */}
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        {loading && contacts.length === 0 ? (
          <div style={{ padding: 12, ...dimText, fontSize: 12 }}>
            Loading contacts…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "24px 0", textAlign: "center", ...mutedText }}>
            {query ? "No contacts match your search." : "No contacts found."}
          </div>
        ) : (
          filtered.map((c) => (
            <ContactRow
              key={c.id}
              contact={c}
              expanded={expandedId === c.id}
              onToggle={() => {
                if (editingId === c.id) return;
                setExpandedId((prev) => (prev === c.id ? null : c.id));
              }}
              editing={editingId === c.id}
              onEdit={() => {
                setExpandedId(c.id);
                setEditingId(c.id);
              }}
              onSave={(edit) => saveContact(c, edit)}
              onCancelEdit={() => setEditingId(null)}
              saving={savingId === c.id}
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
