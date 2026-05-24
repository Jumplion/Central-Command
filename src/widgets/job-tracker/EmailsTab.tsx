import { useState, useEffect, useCallback } from "react";
import type { WidgetApi } from "@renderer/plugins/api";
import type {
  Application,
  AppFormData,
  EmailSuggestion,
  JtAtsDomain,
  JtEmailConfig,
  JtEmailRule,
  ParsedJobEmail,
  Status,
} from "./types";
import { STATUSES, STATUS_COLOR } from "./types";
import { AppForm, StatusBadge } from "./components";
import { fetchJobEmails, buildSuggestion } from "./gmail";
import {
  INSERT_APPLICATION,
  UPDATE_APPLICATION_STATUS,
  DISMISS_EMAIL_JOB,
  SELECT_ALL_EMAIL_RULES,
  SELECT_ALL_ATS_DOMAINS,
  SELECT_EMAIL_CONFIG,
  UPSERT_EMAIL_CONFIG,
  INSERT_EMAIL_RULE,
  INSERT_ATS_DOMAIN,
} from "./queries";
import { namedSql } from "@renderer/plugins/sqlParams";
import { NotConnected } from "../_shared/NotConnected";
import { buttonDefault, buttonTiny, inp } from "../_shared/styles";
import { EmailConfigEditor } from "./EmailConfigEditor";
import {
  DEFAULT_EMAIL_RULES,
  DEFAULT_ATS_DOMAINS,
  DEFAULT_GMAIL_QUERY,
} from "./schema";

// ─── Auth state machine ───────────────────────────────────────────────────

type AuthState =
  | "loading" // initial connection check
  | "no-creds" // not connected — user needs to connect via App Settings
  | "connecting" // OAuth browser flow in progress
  | "connected" // valid token available
  | "error"; // unexpected failure (shown with a retry button)

// ─── Styles ───────────────────────────────────────────────────────────────

const row: React.CSSProperties = {
  borderTop: "1px solid var(--border)",
  cursor: "pointer",
  transition: "background-color 0.15s",
};

const dimText: React.CSSProperties = { color: "var(--text-dim)", fontSize: 12 };

// ─── EmailRow ─────────────────────────────────────────────────────────────

function EmailRow({
  email,
  apps,
  onAdd,
  onUpdate,
  onDismiss,
  onOpenGmail,
  defaultExpanded,
}: {
  email: ParsedJobEmail;
  apps: Application[];
  onAdd: (data: AppFormData) => Promise<void>;
  onUpdate: (app: Application, newStatus: Status) => Promise<void>;
  onDismiss: (id: number) => Promise<void>;
  onOpenGmail: (threadId: string) => void;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  const suggestion: EmailSuggestion = buildSuggestion(email, apps);

  // Editable fields for suggestion panel
  const [editedCompany, setEditedCompany] = useState(email.parsed_company);
  const [editedRole, setEditedRole] = useState(email.parsed_role);
  const [editedStatus, setEditedStatus] = useState<Status>(
    (email.parsed_status as Status) || "Applied",
  );
  const [editedReqNumber, setEditedReqNumber] = useState(
    email.parsed_req_number,
  );
  const [linkedApp, setLinkedApp] = useState<Application | null>(
    suggestion.kind === "update" ? suggestion.app : null,
  );
  const [saving, setSaving] = useState(false);

  const dismissed = email.dismissed === 1;

  const fromDisplay = (() => {
    const m = email.from_address.match(/^([^<]+?)\s*</);
    if (m) return m[1].trim();
    const dm = email.from_address.match(/@([\w.-]+)/);
    if (dm) return dm[1];
    return email.from_address;
  })();

  const dateDisplay = (() => {
    try {
      return new Date(email.received_at).toLocaleDateString();
    } catch {
      return email.received_at.slice(0, 10);
    }
  })();

  const handleAddToTracker = async () => {
    setSaving(true);
    try {
      const data: AppFormData = {
        company: editedCompany,
        role: editedRole,
        status: editedStatus,
        applied_at: email.received_at.slice(0, 10),
        location: "",
        source: "Gmail",
        link: `https://mail.google.com/mail/u/0/#inbox/${email.thread_id}`,
        notes: "",
        req_number: editedReqNumber,
      };
      await onAdd(data);
      await onDismiss(email.id);
      setExpanded(false);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!linkedApp) return;
    setSaving(true);
    try {
      await onUpdate(linkedApp, editedStatus);
      await onDismiss(email.id);
      setExpanded(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ opacity: dismissed ? 0.45 : 1 }}>
      {/* Row summary */}
      <div
        style={{
          ...row,
          display: "grid",
          gridTemplateColumns: "1fr 2fr auto auto",
          alignItems: "center",
          gap: 8,
          padding: "6px 8px",
          backgroundColor: expanded ? "rgba(110,168,255,0.07)" : undefined,
        }}
        onClick={() => setExpanded((e) => !e)}
        onMouseEnter={(e) => {
          if (!expanded)
            e.currentTarget.style.backgroundColor = "rgba(110,168,255,0.05)";
        }}
        onMouseLeave={(e) => {
          if (!expanded) e.currentTarget.style.backgroundColor = "";
        }}
      >
        <span
          style={{
            ...dimText,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {fromDisplay}
        </span>
        <span
          style={{
            fontSize: 12,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {email.subject}
        </span>
        <StatusBadge status={(email.parsed_status as Status) || "Applied"} />
        <span style={{ ...dimText, whiteSpace: "nowrap" }}>{dateDisplay}</span>
      </div>

      {/* Expanded suggestion panel */}
      {expanded && (
        <div
          style={{
            background: "var(--panel-2)",
            border: "1px solid var(--border)",
            borderTop: "none",
            borderRadius: "0 0 6px 6px",
            padding: 10,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Parsed fields (editable) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr 1fr",
              gap: 6,
            }}
          >
            <div>
              <div style={{ ...dimText, marginBottom: 2 }}>Company</div>
              <input
                style={{ ...inp, width: "100%", boxSizing: "border-box" }}
                value={editedCompany}
                onChange={(e) => setEditedCompany(e.target.value)}
              />
            </div>
            <div>
              <div style={{ ...dimText, marginBottom: 2 }}>Role</div>
              <input
                style={{ ...inp, width: "100%", boxSizing: "border-box" }}
                value={editedRole}
                onChange={(e) => setEditedRole(e.target.value)}
              />
            </div>
            <div>
              <div style={{ ...dimText, marginBottom: 2 }}>Status</div>
              <select
                style={{ ...inp, width: "100%", boxSizing: "border-box" }}
                value={editedStatus}
                onChange={(e) => setEditedStatus(e.target.value as Status)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ ...dimText, marginBottom: 2 }}>Req #</div>
              <input
                style={{ ...inp, width: "100%", boxSizing: "border-box" }}
                value={editedReqNumber}
                onChange={(e) => setEditedReqNumber(e.target.value)}
                placeholder="—"
              />
            </div>
          </div>

          {/* Snippet */}
          {email.snippet && (
            <div style={{ ...dimText, fontStyle: "italic", lineHeight: 1.4 }}>
              &ldquo;{email.snippet}&rdquo;
            </div>
          )}

          {/* Update suggestion: link to existing app */}
          {suggestion.kind === "update" && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span style={dimText}>Link to existing entry:</span>
              <select
                style={{ ...inp, flexShrink: 0 }}
                value={linkedApp?.id ?? ""}
                onChange={(e) => {
                  const found = apps.find(
                    (a) => a.id === Number(e.target.value),
                  );
                  setLinkedApp(found ?? null);
                }}
              >
                <option value="">— none —</option>
                {apps.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.company} — {a.role} ({a.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {suggestion.kind === "add" || !linkedApp ? (
              <button
                className="primary"
                style={buttonDefault}
                onClick={handleAddToTracker}
                disabled={saving || !editedCompany.trim() || !editedRole.trim()}
              >
                {saving ? "Adding…" : "+ Add to Tracker"}
              </button>
            ) : (
              <button
                className="primary"
                style={{
                  ...buttonDefault,
                  background: STATUS_COLOR[editedStatus] + "33",
                  borderColor: STATUS_COLOR[editedStatus] + "88",
                  color: STATUS_COLOR[editedStatus],
                }}
                onClick={handleUpdateStatus}
                disabled={saving}
              >
                {saving ? "Updating…" : `↑ Update to ${editedStatus}`}
              </button>
            )}
            <button
              className="ghost"
              style={buttonDefault}
              onClick={() => onOpenGmail(email.thread_id)}
            >
              Open in Gmail ↗
            </button>
            {!dismissed && (
              <button
                className="ghost danger"
                style={{ ...buttonDefault, marginLeft: "auto" }}
                onClick={() => void onDismiss(email.id)}
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EmailsTab ────────────────────────────────────────────────────────────

export function EmailsTab({
  api,
  apps,
  onAppAdded,
  onAppUpdated,
}: {
  api: WidgetApi;
  apps: Application[];
  onAppAdded: () => void;
  onAppUpdated: () => void;
}) {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [authError, setAuthError] = useState("");
  const [emails, setEmails] = useState<ParsedJobEmail[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [showDismissed, setShowDismissed] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // ── Dynamic email config ───────────────────────────────────────────────
  const [emailRules, setEmailRules] = useState<JtEmailRule[]>([]);
  const [atsDomains, setAtsDomains] = useState<JtAtsDomain[]>([]);
  const [emailConfig, setEmailConfig] = useState<JtEmailConfig>({
    id: 1,
    query: DEFAULT_GMAIL_QUERY,
    days_back: 180,
    max_results: 50,
  });

  const loadConfig = useCallback(async () => {
    const [rules, domains, config] = await Promise.all([
      api.sql.all<JtEmailRule>(SELECT_ALL_EMAIL_RULES),
      api.sql.all<JtAtsDomain>(SELECT_ALL_ATS_DOMAINS),
      api.sql.get<JtEmailConfig>(SELECT_EMAIL_CONFIG),
    ]);
    setEmailRules(rules);
    setAtsDomains(domains);
    if (config) setEmailConfig(config);
  }, [api]);

  const seedDefaultsIfEmpty = useCallback(async () => {
    const [ruleCount, domainCount, config] = await Promise.all([
      api.sql.get<{ n: number }>("SELECT COUNT(*) AS n FROM jt_email_rules"),
      api.sql.get<{ n: number }>("SELECT COUNT(*) AS n FROM jt_ats_domains"),
      api.sql.get<JtEmailConfig>(SELECT_EMAIL_CONFIG),
    ]);
    if ((ruleCount?.n ?? 0) === 0) {
      for (const [s, field, op, val, prio] of DEFAULT_EMAIL_RULES) {
        await api.sql.run(
          ...namedSql(INSERT_EMAIL_RULE, {
            status: s,
            field,
            operator: op,
            value: val,
            priority: prio,
          }),
        );
      }
    }
    if ((domainCount?.n ?? 0) === 0) {
      for (const [domain, company] of DEFAULT_ATS_DOMAINS) {
        await api.sql.run(...namedSql(INSERT_ATS_DOMAIN, { domain, company }));
      }
    }
    if (!config) {
      await api.sql.run(
        ...namedSql(UPSERT_EMAIL_CONFIG, {
          query: DEFAULT_GMAIL_QUERY,
          days_back: 180,
          max_results: 50,
        }),
      );
    }
    await loadConfig();
  }, [api, loadConfig]);

  // ── Auth initialization ──────────────────────────────────────────────

  useEffect(() => {
    const check = async () => {
      try {
        const connected = await api.google.shared.isConnected("gmail");
        await seedDefaultsIfEmpty();
        if (connected) {
          setAuthState("connected");
          await loadEmails();
          return;
        }
        const hasCreds = await api.google.shared.hasCreds("gmail");
        if (hasCreds) {
          // Tokens expired but credentials exist — reconnect automatically
          setAuthState("connecting");
          const started = await api.google.shared.reconnect("gmail");
          if (started) {
            setAuthState("connected");
            await loadEmails();
          } else {
            setAuthState("no-creds");
          }
        } else {
          setAuthState("no-creds");
        }
      } catch (err) {
        setAuthError(String(err));
        setAuthState("error");
      }
    };
    void check();
  }, []);

  // ── Load stored emails from DB ────────────────────────────────────────

  const loadEmails = useCallback(async () => {
    const rows = await api.sql.all<ParsedJobEmail>(
      "SELECT * FROM email_jobs ORDER BY received_at DESC",
    );
    setEmails(rows);
  }, [api]);

  // ── Connect ───────────────────────────────────────────────────────────

  const handleConnect = async (clientId: string, clientSecret: string) => {
    setAuthState("connecting");
    setAuthError("");
    try {
      await api.google.shared.connect({
        clientId,
        clientSecret,
        service: "gmail",
      });
      setAuthState("connected");
      await loadEmails();
    } catch (err) {
      setAuthError(String(err));
      setAuthState("no-creds");
    }
  };

  // ── Scan ──────────────────────────────────────────────────────────────

  const handleScan = async () => {
    setScanning(true);
    setScanError("");
    try {
      const token = await api.google.shared.getToken();
      if (!token) {
        setAuthState("no-creds");
        return;
      }
      const fetched = await fetchJobEmails(api, token, {
        query: emailConfig.query,
        daysBack: emailConfig.days_back,
        maxResults: emailConfig.max_results,
        rules: emailRules,
        atsDomains,
      });
      setEmails(fetched);
    } catch (err) {
      setScanError(String(err));
    } finally {
      setScanning(false);
    }
  };

  // ── App actions ───────────────────────────────────────────────────────

  const handleAdd = async (data: AppFormData) => {
    await api.sql.run(
      ...namedSql(INSERT_APPLICATION, { ...data, last_updated: Date.now() }),
    );
    onAppAdded();
  };

  const handleUpdate = async (app: Application, newStatus: Status) => {
    await api.sql.run(UPDATE_APPLICATION_STATUS, [
      newStatus,
      Date.now(),
      app.id,
    ]);
    onAppUpdated();
  };

  const handleDismiss = async (emailId: number) => {
    await api.sql.run(DISMISS_EMAIL_JOB, [emailId]);
    setEmails((prev) =>
      prev.map((e) => (e.id === emailId ? { ...e, dismissed: 1 } : e)),
    );
  };

  const handleOpenGmail = (threadId: string) => {
    void api.shell.openExternal(
      `https://mail.google.com/mail/u/0/#inbox/${threadId}`,
    );
  };

  const handleDisconnect = async () => {
    await api.google.shared.disconnect();
    setEmails([]);
    setAuthState("no-creds");
  };

  // ── Render ────────────────────────────────────────────────────────────

  if (authState === "loading") {
    return (
      <div style={{ padding: 16, color: "var(--text-dim)", fontSize: 12 }}>
        Checking Google connection…
      </div>
    );
  }

  if (authState === "connecting") {
    return (
      <div
        style={{
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600 }}>
          Connecting to Google…
        </div>
        <div style={{ ...dimText, lineHeight: 1.5 }}>
          A browser window has opened for authorization. Complete the sign-in
          there and return here.
        </div>
      </div>
    );
  }

  if (authState === "no-creds" || authState === "error") {
    return (
      <div>
        {authError && (
          <div
            style={{
              padding: "8px 12px",
              background: "#ff6e6e22",
              borderBottom: "1px solid #ff6e6e44",
              fontSize: 12,
              color: "#ff6e6e",
            }}
          >
            {authError}
          </div>
        )}
        <NotConnected />
      </div>
    );
  }

  // Config view
  if (showConfig) {
    return (
      <EmailConfigEditor
        rules={emailRules}
        atsDomains={atsDomains}
        query={emailConfig.query}
        daysBack={emailConfig.days_back}
        maxResults={emailConfig.max_results}
        api={api}
        onRulesChanged={() => void loadConfig()}
        onAtsChanged={() => void loadConfig()}
        onQueryChanged={(q, d, m) => {
          setEmailConfig((prev) => ({
            ...prev,
            query: q,
            days_back: d,
            max_results: m,
          }));
          void loadConfig();
        }}
        onClose={() => setShowConfig(false)}
      />
    );
  }

  // Connected state
  const visibleEmails = showDismissed
    ? emails
    : emails.filter((e) => e.dismissed === 0);
  const dismissedCount = emails.filter((e) => e.dismissed === 1).length;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          padding: "0 0 8px",
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <button
          className="primary"
          style={buttonDefault}
          onClick={() => void handleScan()}
          disabled={scanning}
        >
          {scanning ? "Scanning…" : "⟳ Scan Gmail"}
        </button>
        {dismissedCount > 0 && (
          <button
            className="ghost"
            style={{
              fontSize: 11,
              padding: "3px 8px",
              color: showDismissed ? "var(--accent)" : "var(--text-dim)",
            }}
            onClick={() => setShowDismissed((s) => !s)}
          >
            {showDismissed
              ? `Hide dismissed (${dismissedCount})`
              : `Show dismissed (${dismissedCount})`}
          </button>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button
            className="ghost"
            style={buttonTiny}
            onClick={() => setShowConfig(true)}
            title="Configure email rules, query, and ATS domains"
          >
            ⚙ Configure
          </button>
          <button
            className="ghost"
            style={{
              fontSize: 11,
              padding: "3px 8px",
              color: "var(--text-dim)",
            }}
            onClick={() => void handleDisconnect()}
          >
            Disconnect
          </button>
        </div>
      </div>

      {scanError && (
        <div
          style={{
            fontSize: 12,
            color: "#ff6e6e",
            padding: "4px 0",
            flexShrink: 0,
          }}
        >
          {scanError}
        </div>
      )}

      {/* Email list */}
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        {emails.length === 0 ? (
          <div style={{ ...dimText, padding: "16px 0", textAlign: "center" }}>
            {scanning
              ? "Fetching emails…"
              : "No emails found — click Scan Gmail to start."}
          </div>
        ) : visibleEmails.length === 0 ? (
          <div style={{ ...dimText, padding: "16px 0", textAlign: "center" }}>
            All emails dismissed.{" "}
            <button
              className="ghost"
              style={{ fontSize: 12 }}
              onClick={() => setShowDismissed(true)}
            >
              Show dismissed
            </button>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 2fr auto auto",
                gap: 8,
                padding: "0 8px 4px",
                color: "var(--text-dim)",
                fontSize: 11,
                borderBottom: "1px solid var(--border)",
                flexShrink: 0,
              }}
            >
              <span>From</span>
              <span>Subject</span>
              <span>Status</span>
              <span>Date</span>
            </div>
            {visibleEmails.map((email) => (
              <EmailRow
                key={email.id}
                email={email}
                apps={apps}
                onAdd={handleAdd}
                onUpdate={handleUpdate}
                onDismiss={handleDismiss}
                onOpenGmail={handleOpenGmail}
              />
            ))}
          </>
        )}
      </div>

      {/* Inline AppForm (not used directly here — EmailRow handles it) */}
    </div>
  );
}

// Unused re-export to keep AppForm available if needed in the same chunk
export { AppForm };
