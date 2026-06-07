import { useState } from "react";
import type { GmailFolder, GmailRule } from "../types";
import { AddItemCard } from "../../_shared/AddItemCard";
import {
  buttonDefault,
  buttonSmall,
  buttonTiny,
  dimText,
  inp,
} from "../../_shared/styles";
import { INSERT_RULE, UPDATE_RULE, DELETE_RULE } from "../queries";
import { namedSql } from "@renderer/plugins/sqlParams";
import type { WidgetApi } from "@renderer/plugins/api";

type RuleField = GmailRule["field"];
type RuleOperator = GmailRule["operator"];

const FIELDS: { value: RuleField; label: string }[] = [
  { value: "subject", label: "Subject" },
  { value: "from", label: "From address" },
  { value: "label", label: "Label" },
  { value: "snippet", label: "Body snippet" },
];

const OPERATORS: { value: RuleOperator; label: string }[] = [
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "starts_with", label: "starts with" },
  { value: "ends_with", label: "ends with" },
  { value: "regex", label: "matches regex" },
];

interface RuleRowProps {
  rule: GmailRule;
  folders: GmailFolder[];
  api: WidgetApi;
  onChanged: () => void;
}

function RuleRow({ rule, folders, api, onChanged }: RuleRowProps) {
  const [editing, setEditing] = useState(false);
  const [field, setField] = useState<RuleField>(rule.field);
  const [operator, setOperator] = useState<RuleOperator>(rule.operator);
  const [value, setValue] = useState(rule.value);
  const [folderId, setFolderId] = useState(rule.folder_id);
  const [priority, setPriority] = useState(rule.priority);
  const [saving, setSaving] = useState(false);

  const folderName =
    folders.find((f) => f.id === rule.folder_id)?.name ?? "Unknown";

  const handleSave = async () => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await api.sql.run(
        ...namedSql(UPDATE_RULE, {
          folder_id: folderId,
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
    await api.sql.run(DELETE_RULE, [rule.id]);
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
          <span style={{ color: "var(--text-dim)" }}> → {folderName}</span>
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
        <span style={{ ...dimText, fontSize: 11 }}>Folder:</span>
        <select
          style={{ ...inp, flex: 1 }}
          value={folderId}
          onChange={(e) => setFolderId(Number(e.target.value))}
        >
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.icon ? `${f.icon} ` : ""}
              {f.name}
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

interface AddRuleFormProps {
  folders: GmailFolder[];
  api: WidgetApi;
  onAdded: () => void;
}

function AddRuleForm({ folders, api, onAdded }: AddRuleFormProps) {
  const [field, setField] = useState<RuleField>("subject");
  const [operator, setOperator] = useState<RuleOperator>("contains");
  const [value, setValue] = useState("");
  const [folderId, setFolderId] = useState<number>(folders[0]?.id ?? 0);
  const [priority, setPriority] = useState(50);
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!value.trim() || !folderId) return;
    setSaving(true);
    try {
      await api.sql.run(
        ...namedSql(INSERT_RULE, {
          folder_id: folderId,
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
    <AddItemCard title="Add rule">
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
        <span style={{ ...dimText, fontSize: 11 }}>→ Folder:</span>
        <select
          style={{ ...inp, flex: 1 }}
          value={folderId}
          onChange={(e) => setFolderId(Number(e.target.value))}
        >
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.icon ? `${f.icon} ` : ""}
              {f.name}
            </option>
          ))}
        </select>
        <button
          className="primary"
          style={buttonDefault}
          onClick={() => void handleAdd()}
          disabled={saving || !value.trim() || !folderId}
        >
          {saving ? "…" : "+ Add Rule"}
        </button>
      </div>
    </AddItemCard>
  );
}

interface RulesEditorProps {
  rules: GmailRule[];
  folders: GmailFolder[];
  api: WidgetApi;
  onChanged: () => void;
}

export function RulesEditor({
  rules,
  folders,
  api,
  onChanged,
}: RulesEditorProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        padding: "0 2px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--text-dim)",
          marginBottom: 8,
          lineHeight: 1.5,
        }}
      >
        Rules match emails to folders. Higher priority = evaluated first. First
        match wins.
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
              folders={folders}
              api={api}
              onChanged={onChanged}
            />
          ))
        )}

        <AddRuleForm folders={folders} api={api} onAdded={onChanged} />
      </div>
    </div>
  );
}
