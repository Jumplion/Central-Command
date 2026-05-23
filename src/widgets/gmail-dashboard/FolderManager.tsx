import { useState } from "react";
import type { GmailFolder } from "./types";
import {
  buttonDefault,
  buttonSmall,
  buttonTiny,
  dimText,
  inp,
} from "../_shared/styles";
import { INSERT_FOLDER, UPDATE_FOLDER, DELETE_FOLDER } from "./queries";
import { namedSql } from "@renderer/plugins/sqlParams";
import type { WidgetApi } from "@renderer/plugins/api";

const ICONS = [
  "📁",
  "💼",
  "📩",
  "🎤",
  "❌",
  "🎉",
  "🔔",
  "📋",
  "⭐",
  "🏢",
  "📧",
  "🔍",
];

interface FolderRowProps {
  folder: GmailFolder;
  folders: GmailFolder[];
  api: WidgetApi;
  onChanged: () => void;
}

function FolderRow({ folder, folders, api, onChanged }: FolderRowProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const [icon, setIcon] = useState(folder.icon ?? "");
  const [saving, setSaving] = useState(false);

  const parentName = folder.parent_id
    ? folders.find((f) => f.id === folder.parent_id)?.name
    : null;

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.sql.run(
        ...namedSql(UPDATE_FOLDER, {
          name: name.trim(),
          icon: icon || null,
          id: folder.id,
        }),
      );
      setEditing(false);
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        `Delete folder "${folder.name}"? Emails in it will lose their assignment.`,
      )
    )
      return;
    await api.sql.run(DELETE_FOLDER, [folder.id]);
    onChanged();
  };

  if (!editing) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 0",
          borderBottom: "1px solid var(--border)",
          fontSize: 12,
        }}
      >
        <span style={{ minWidth: 20 }}>{folder.icon ?? "📁"}</span>
        <span style={{ flex: 1 }}>
          {parentName && (
            <span style={{ color: "var(--text-dim)", fontSize: 11 }}>
              {parentName} /&nbsp;
            </span>
          )}
          {folder.name}
        </span>
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 6 }}>
        <div>
          <div style={{ ...dimText, fontSize: 10, marginBottom: 2 }}>Icon</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {ICONS.map((ic) => (
              <button
                key={ic}
                className="ghost"
                style={{
                  padding: "2px 4px",
                  fontSize: 14,
                  background: icon === ic ? "var(--accent)" : "transparent",
                  borderRadius: 3,
                }}
                onClick={() => setIcon(ic === icon ? "" : ic)}
              >
                {ic}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ ...dimText, fontSize: 10, marginBottom: 2 }}>Name</div>
          <input
            style={{ ...inp, width: "100%", boxSizing: "border-box" }}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          className="primary"
          style={buttonSmall}
          onClick={() => void handleSave()}
          disabled={saving || !name.trim()}
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

interface AddFolderFormProps {
  folders: GmailFolder[];
  api: WidgetApi;
  onAdded: () => void;
}

function AddFolderForm({ folders, api, onAdded }: AddFolderFormProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📁");
  const [parentId, setParentId] = useState<number | "">("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const maxOrder = folders.filter(
        (f) => f.parent_id === (parentId || null),
      ).length;
      await api.sql.run(
        ...namedSql(INSERT_FOLDER, {
          name: name.trim(),
          parent_id: parentId || null,
          sort_order: maxOrder,
          icon,
        }),
      );
      setName("");
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
        Add folder
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {ICONS.map((ic) => (
          <button
            key={ic}
            className="ghost"
            style={{
              padding: "2px 4px",
              fontSize: 13,
              background: icon === ic ? "var(--accent)" : "transparent",
              borderRadius: 3,
            }}
            onClick={() => setIcon(ic)}
          >
            {ic}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 6 }}>
        <input
          style={{ ...inp, boxSizing: "border-box" }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Folder name"
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleAdd();
          }}
        />
        <select
          style={{ ...inp, boxSizing: "border-box" }}
          value={parentId}
          onChange={(e) =>
            setParentId(e.target.value === "" ? "" : Number(e.target.value))
          }
        >
          <option value="">Top-level</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.icon ? `${f.icon} ` : ""}
              {f.name}
            </option>
          ))}
        </select>
      </div>
      <button
        className="primary"
        style={buttonDefault}
        onClick={() => void handleAdd()}
        disabled={saving || !name.trim()}
      >
        {saving ? "…" : "+ Add Folder"}
      </button>
    </div>
  );
}

interface FolderManagerProps {
  folders: GmailFolder[];
  api: WidgetApi;
  onChanged: () => void;
}

export function FolderManager({ folders, api, onChanged }: FolderManagerProps) {
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
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        {folders.length === 0 ? (
          <div style={{ ...dimText, fontSize: 12, padding: "8px 0" }}>
            No folders yet.
          </div>
        ) : (
          folders.map((f) => (
            <FolderRow
              key={f.id}
              folder={f}
              folders={folders}
              api={api}
              onChanged={onChanged}
            />
          ))
        )}

        <AddFolderForm folders={folders} api={api} onAdded={onChanged} />
      </div>
    </div>
  );
}
