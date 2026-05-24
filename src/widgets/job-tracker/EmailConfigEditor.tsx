import { useState } from "react";
import type { WidgetApi } from "@renderer/plugins/api";
import type { JtAtsDomain, JtEmailRule, Status } from "./types";
import { STATUSES } from "./types";
import {
  buttonDefault,
  buttonSmall,
  buttonTiny,
  dimText,
  inp,
} from "../_shared/styles";
import {
  INSERT_EMAIL_RULE,
  UPDATE_EMAIL_RULE,
  DELETE_EMAIL_RULE,
  INSERT_ATS_DOMAIN,
  UPDATE_ATS_DOMAIN,
  DELETE_ATS_DOMAIN,
  UPSERT_EMAIL_CONFIG,
} from "./queries";
import { namedSql } from "@renderer/plugins/sqlParams";
import {
  DEFAULT_EMAIL_RULES,
  DEFAULT_ATS_DOMAINS,
  DEFAULT_GMAIL_QUERY,
} from "./schema";

// ─── Constants ────────────────────────────────────────────────────────────

type RuleField = JtEmailRule["field"];
type RuleOperator = JtEmailRule["operator"];

const FIELDS: { value: RuleField; label: string }[] = [
  { value: "subject", label: "Subject" },
  { value: "body", label: "Body" },
  { value: "from", label: "From" },
];

const OPERATORS: { value: RuleOperator; label: string }[] = [
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "starts_with", label: "starts with" },
  { value: "ends_with", label: "ends with" },
  { value: "regex", label: "matches regex" },
];

type Tab = "rules" | "query" | "ats";

// ─── RuleRow ──────────────────────────────────────────────────────────────

function RuleRow({
  rule,
  api,
  onChanged,
}: {
  rule: JtEmailRule;
  api: WidgetApi;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [field, setField] = useState<RuleField>(rule.field);
  const [operator, setOperator] = useState<RuleOperator>(rule.operator);
  const [value, setValue] = useState(rule.value);
  const [status, setStatus] = useState(rule.status);
  const [priority, setPriority] = useState(rule.priority);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await api.sql.run(
        ...namedSql(UPDATE_EMAIL_RULE, {
          status,
          field,
          operator,
          value: value.trim(),
          priority,
          id: rule.id,
        }),
      );
      setEditing(false);
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    await api.sql.run(DELETE_EMAIL_RULE, [rule.id]);
    onChanged();
  };

  if (!editing) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          gap: 8,
          alignItems: "center",
          padding: "4px 0",
          borderBottom: "1px solid var(--border)",
          fontSize: 12,
        }}
      >
        <span
          style={{ ...dimText, fontSize: 10, minWidth: 20, textAlign: "right" }}
        >
          {rule.priority}
        </span>
        <span>
          <span style={{ color: "var(--text-dim)" }}>{rule.field} </span>
          <span style={{ fontStyle: "italic" }}>{rule.operator} </span>
          <span style={{ fontWeight: 600 }}>&ldquo;{rule.value}&rdquo;</span>
          <span style={{ color: "var(--text-dim)" }}> → {rule.status}</span>
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            className="ghost"
            style={buttonTiny}
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
          <button
            className="ghost danger"
            style={buttonTiny}
            onClick={() => void handleDelete()}
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--panel-2)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: 8,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        fontSize: 12,
        margin: "4px 0",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 60px",
          gap: 6,
        }}
      >
        <div>
          <div style={{ ...dimText, fontSize: 10, marginBottom: 2 }}>Field</div>
          <select
            style={{ ...inp, width: "100%", boxSizing: "border-box" }}
            value={field}
            onChange={(e) => setField(e.target.value as RuleField)}
          >
            {FIELDS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ ...dimText, fontSize: 10, marginBottom: 2 }}>
            Operator
          </div>
          <select
            style={{ ...inp, width: "100%", boxSizing: "border-box" }}
            value={operator}
            onChange={(e) => setOperator(e.target.value as RuleOperator)}
          >
            {OPERATORS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ ...dimText, fontSize: 10, marginBottom: 2 }}>Value</div>
          <input
            style={{ ...inp, width: "100%", boxSizing: "border-box" }}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. interview"
          />
        </div>
        <div>
          <div style={{ ...dimText, fontSize: 10, marginBottom: 2 }}>
            Priority
          </div>
          <input
            type="number"
            style={{ ...inp, width: "100%", boxSizing: "border-box" }}
            value={priority}
            min={0}
            max={999}
            onChange={(e) => setPriority(Number(e.target.value))}
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ ...dimText, fontSize: 11 }}>→ Status:</span>
        <select
          style={{ ...inp, flex: 1 }}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          className="primary"
          style={buttonSmall}
          onClick={() => void handleSave()}
          disabled={saving || !value.trim()}
        >
          {saving ? "…" : "Save"}
        </button>
        <button
          className="ghost"
          style={buttonSmall}
          onClick={() => setEditing(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function AddRuleForm({
  api,
  onAdded,
}: {
  api: WidgetApi;
  onAdded: () => void;
}) {
  const [field, setField] = useState<RuleField>("subject");
  const [operator, setOperator] = useState<RuleOperator>("contains");
  const [value, setValue] = useState("");
  const [status, setStatus] = useState(STATUSES[0]);
  const [priority, setPriority] = useState(50);
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await api.sql.run(
        ...namedSql(INSERT_EMAIL_RULE, {
          status,
          field,
          operator,
          value: value.trim(),
          priority,
        }),
      );
      setValue("");
      onAdded();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        background: "var(--panel-2)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: 8,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        fontSize: 12,
        marginTop: 8,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 11, color: "var(--text-dim)" }}>
        Add rule
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 60px",
          gap: 6,
        }}
      >
        <select
          style={{ ...inp, width: "100%", boxSizing: "border-box" }}
          value={field}
          onChange={(e) => setField(e.target.value as RuleField)}
        >
          {FIELDS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          style={{ ...inp, width: "100%", boxSizing: "border-box" }}
          value={operator}
          onChange={(e) => setOperator(e.target.value as RuleOperator)}
        >
          {OPERATORS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          style={{ ...inp, width: "100%", boxSizing: "border-box" }}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="value to match"
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleAdd();
          }}
        />
        <input
          type="number"
          style={{ ...inp, width: "100%", boxSizing: "border-box" }}
          value={priority}
          min={0}
          max={999}
          title="Priority (higher = evaluated first)"
          onChange={(e) => setPriority(Number(e.target.value))}
        />
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ ...dimText, fontSize: 11 }}>→ Status:</span>
        <select
          style={{ ...inp, flex: 1 }}
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          className="primary"
          style={buttonDefault}
          onClick={() => void handleAdd()}
          disabled={saving || !value.trim()}
        >
          {saving ? "…" : "+ Add Rule"}
        </button>
      </div>
    </div>
  );
}

// ─── Rules panel ──────────────────────────────────────────────────────────

function RulesPanel({
  rules,
  api,
  onChanged,
}: {
  rules: JtEmailRule[];
  api: WidgetApi;
  onChanged: () => void;
}) {
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    try {
      await api.sql.exec("DELETE FROM jt_email_rules");
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
      onChanged();
    } finally {
      setResetting(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <span style={{ ...dimText, fontSize: 11, lineHeight: 1.5 }}>
          Rules detect email status. Higher priority = evaluated first. First
          match wins.
        </span>
        <button
          className="ghost"
          style={buttonTiny}
          onClick={() => void handleReset()}
          disabled={resetting}
          title="Restore default rules"
        >
          {resetting ? "…" : "Reset defaults"}
        </button>
      </div>
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        {rules.length === 0 ? (
          <div style={{ ...dimText, fontSize: 12, padding: "8px 0" }}>
            No rules yet. Add one below.
          </div>
        ) : (
          rules.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              api={api}
              onChanged={onChanged}
            />
          ))
        )}
        <AddRuleForm api={api} onAdded={onChanged} />
      </div>
    </div>
  );
}

// ─── ATS domains panel ────────────────────────────────────────────────────

function AtsDomainRow({
  domain,
  api,
  onChanged,
}: {
  domain: JtAtsDomain;
  api: WidgetApi;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [domainVal, setDomainVal] = useState(domain.domain);
  const [company, setCompany] = useState(domain.company);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!domainVal.trim()) return;
    setSaving(true);
    try {
      await api.sql.run(
        ...namedSql(UPDATE_ATS_DOMAIN, {
          domain: domainVal.trim().toLowerCase(),
          company: company.trim(),
          id: domain.id,
        }),
      );
      setEditing(false);
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    await api.sql.run(DELETE_ATS_DOMAIN, [domain.id]);
    onChanged();
  };

  if (!editing) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr auto",
          gap: 8,
          alignItems: "center",
          padding: "4px 0",
          borderBottom: "1px solid var(--border)",
          fontSize: 12,
        }}
      >
        <span style={{ color: "var(--text-dim)" }}>@{domain.domain}</span>
        <span>
          {domain.company || (
            <em style={{ color: "var(--text-dim)" }}>use display name</em>
          )}
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            className="ghost"
            style={buttonTiny}
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
          <button
            className="ghost danger"
            style={buttonTiny}
            onClick={() => void handleDelete()}
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--panel-2)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: 8,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        fontSize: 12,
        margin: "4px 0",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <div>
          <div style={{ ...dimText, fontSize: 10, marginBottom: 2 }}>
            Domain
          </div>
          <input
            style={{ ...inp, width: "100%", boxSizing: "border-box" }}
            value={domainVal}
            onChange={(e) => setDomainVal(e.target.value)}
            placeholder="e.g. greenhouse.io"
          />
        </div>
        <div>
          <div style={{ ...dimText, fontSize: 10, marginBottom: 2 }}>
            Company override{" "}
            <span style={{ color: "var(--text-dim)" }}>
              (blank = use sender display name)
            </span>
          </div>
          <input
            style={{ ...inp, width: "100%", boxSizing: "border-box" }}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="leave blank to use display name"
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          className="primary"
          style={buttonSmall}
          onClick={() => void handleSave()}
          disabled={saving || !domainVal.trim()}
        >
          {saving ? "…" : "Save"}
        </button>
        <button
          className="ghost"
          style={buttonSmall}
          onClick={() => setEditing(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function AddAtsDomainForm({
  api,
  onAdded,
}: {
  api: WidgetApi;
  onAdded: () => void;
}) {
  const [domain, setDomain] = useState("");
  const [company, setCompany] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!domain.trim()) return;
    setSaving(true);
    try {
      await api.sql.run(
        ...namedSql(INSERT_ATS_DOMAIN, {
          domain: domain.trim().toLowerCase(),
          company: company.trim(),
        }),
      );
      setDomain("");
      setCompany("");
      onAdded();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        background: "var(--panel-2)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: 8,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        fontSize: 12,
        marginTop: 8,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 11, color: "var(--text-dim)" }}>
        Add ATS domain
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <input
          style={{ ...inp, width: "100%", boxSizing: "border-box" }}
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="e.g. myats.com"
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleAdd();
          }}
        />
        <input
          style={{ ...inp, width: "100%", boxSizing: "border-box" }}
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="company override (optional)"
        />
      </div>
      <div>
        <button
          className="primary"
          style={buttonDefault}
          onClick={() => void handleAdd()}
          disabled={saving || !domain.trim()}
        >
          {saving ? "…" : "+ Add Domain"}
        </button>
      </div>
    </div>
  );
}

function AtsDomainsPanel({
  atsDomains,
  api,
  onChanged,
}: {
  atsDomains: JtAtsDomain[];
  api: WidgetApi;
  onChanged: () => void;
}) {
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    try {
      await api.sql.exec("DELETE FROM jt_ats_domains");
      for (const [domain, company] of DEFAULT_ATS_DOMAINS) {
        await api.sql.run(...namedSql(INSERT_ATS_DOMAIN, { domain, company }));
      }
      onChanged();
    } finally {
      setResetting(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <span style={{ ...dimText, fontSize: 11, lineHeight: 1.5 }}>
          Emails from ATS domains use the sender display name as company. Set a
          company override to force a specific name.
        </span>
        <button
          className="ghost"
          style={{ ...buttonTiny, flexShrink: 0, marginLeft: 8 }}
          onClick={() => void handleReset()}
          disabled={resetting}
          title="Restore default ATS domains"
        >
          {resetting ? "…" : "Reset defaults"}
        </button>
      </div>
      <div style={{ ...dimText, fontSize: 11, marginBottom: 4 }}>
        <strong>Domain</strong>{" "}
        <span style={{ marginLeft: 80 }}>
          <strong>Company override</strong>
        </span>
      </div>
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        {atsDomains.map((d) => (
          <AtsDomainRow key={d.id} domain={d} api={api} onChanged={onChanged} />
        ))}
        <AddAtsDomainForm api={api} onAdded={onChanged} />
      </div>
    </div>
  );
}

// ─── Query panel ──────────────────────────────────────────────────────────

function QueryPanel({
  query,
  daysBack,
  maxResults,
  api,
  onChanged,
}: {
  query: string;
  daysBack: number;
  maxResults: number;
  api: WidgetApi;
  onChanged: (q: string, d: number, m: number) => void;
}) {
  const [queryVal, setQueryVal] = useState(query);
  const [days, setDays] = useState(daysBack);
  const [max, setMax] = useState(maxResults);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!queryVal.trim()) return;
    setSaving(true);
    try {
      await api.sql.run(
        ...namedSql(UPSERT_EMAIL_CONFIG, {
          query: queryVal.trim(),
          days_back: days,
          max_results: max,
        }),
      );
      onChanged(queryVal.trim(), days, max);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setQueryVal(DEFAULT_GMAIL_QUERY);
    setDays(180);
    setMax(50);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ ...dimText, fontSize: 11 }}>
          Gmail search query used to find job-related emails. The widget appends{" "}
          <code>newer_than:{days}d</code> automatically.
        </span>
        <button
          className="ghost"
          style={{ ...buttonTiny, flexShrink: 0, marginLeft: 8 }}
          onClick={handleReset}
          title="Restore default query"
        >
          Reset defaults
        </button>
      </div>
      <div>
        <div style={{ ...dimText, fontSize: 10, marginBottom: 4 }}>
          Search query (Gmail search syntax)
        </div>
        <textarea
          style={{
            ...inp,
            width: "100%",
            boxSizing: "border-box",
            minHeight: 100,
            fontFamily: "monospace",
            resize: "vertical",
          }}
          value={queryVal}
          onChange={(e) => setQueryVal(e.target.value)}
          spellCheck={false}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <div style={{ ...dimText, fontSize: 10, marginBottom: 4 }}>
            Look back (days)
          </div>
          <input
            type="number"
            style={{ ...inp, width: "100%", boxSizing: "border-box" }}
            value={days}
            min={1}
            max={3650}
            onChange={(e) => setDays(Number(e.target.value))}
          />
        </div>
        <div>
          <div style={{ ...dimText, fontSize: 10, marginBottom: 4 }}>
            Max emails per scan
          </div>
          <input
            type="number"
            style={{ ...inp, width: "100%", boxSizing: "border-box" }}
            value={max}
            min={1}
            max={500}
            onChange={(e) => setMax(Number(e.target.value))}
          />
        </div>
      </div>
      <div>
        <button
          className="primary"
          style={buttonDefault}
          onClick={() => void handleSave()}
          disabled={saving || !queryVal.trim()}
        >
          {saving ? "Saving…" : "Save Query Settings"}
        </button>
      </div>
    </div>
  );
}

// ─── EmailConfigEditor ────────────────────────────────────────────────────

export interface EmailConfigEditorProps {
  rules: JtEmailRule[];
  atsDomains: JtAtsDomain[];
  query: string;
  daysBack: number;
  maxResults: number;
  api: WidgetApi;
  onRulesChanged: () => void;
  onAtsChanged: () => void;
  onQueryChanged: (q: string, d: number, m: number) => void;
  onClose: () => void;
}

export function EmailConfigEditor({
  rules,
  atsDomains,
  query,
  daysBack,
  maxResults,
  api,
  onRulesChanged,
  onAtsChanged,
  onQueryChanged,
  onClose,
}: EmailConfigEditorProps) {
  const [tab, setTab] = useState<Tab>("rules");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
          flexShrink: 0,
        }}
      >
        <button className="ghost" style={buttonSmall} onClick={onClose}>
          ← Back
        </button>
        <span style={{ fontWeight: 600, fontSize: 13 }}>Email Settings</span>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            border: "1px solid var(--border)",
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          {(["rules", "query", "ats"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                fontSize: 11,
                padding: "3px 10px",
                background: tab === t ? "var(--accent)22" : "transparent",
                color: tab === t ? "var(--accent)" : "var(--text-dim)",
                border: "none",
                cursor: "pointer",
              }}
            >
              {t === "rules"
                ? "Rules"
                : t === "query"
                  ? "Query"
                  : "ATS Domains"}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        {tab === "rules" && (
          <RulesPanel rules={rules} api={api} onChanged={onRulesChanged} />
        )}
        {tab === "query" && (
          <QueryPanel
            query={query}
            daysBack={daysBack}
            maxResults={maxResults}
            api={api}
            onChanged={onQueryChanged}
          />
        )}
        {tab === "ats" && (
          <AtsDomainsPanel
            atsDomains={atsDomains}
            api={api}
            onChanged={onAtsChanged}
          />
        )}
      </div>
    </div>
  );
}
