import { useState, useEffect, useCallback, useMemo } from "react";
import type { Widget, WidgetProps } from "@renderer/plugins/registry";
import { useSqlInit } from "@renderer/hooks/useSqlInit";
import type { GmailEmail, GmailFolder, GmailRule, FolderTreeNode, GroupBy } from "./types";
import { INIT_SQL, MIGRATIONS, DEFAULT_FOLDERS, DEFAULT_RULES } from "./constants";
import {
  SELECT_ALL_FOLDERS,
  SELECT_ALL_RULES,
  SELECT_EMAILS_FOR_FOLDER,
  SELECT_FOLDER_COUNTS,
  SET_OVERRIDE_FOLDER,
  CLEAR_OVERRIDE_FOLDER,
  INSERT_FOLDER,
  INSERT_RULE,
} from "./queries";
import { fetchAndStoreEmails, reapplyAllRules } from "./gmail";
import { FolderTree } from "./FolderTree";
import { EmailList } from "./EmailList";
import { RulesEditor } from "./RulesEditor";
import { FolderManager } from "./FolderManager";
import { NotConnected } from "../_shared/NotConnected";
import { buttonDefault, buttonSmall, dimText } from "../_shared/styles";

// ─── Auth state ───────────────────────────────────────────────────────────

type AuthState = "loading" | "no-creds" | "connecting" | "connected" | "error";

// ─── Tree builder ─────────────────────────────────────────────────────────

function buildTree(
  folders: GmailFolder[],
  counts: Map<number, { total: number; unread: number }>,
): FolderTreeNode[] {
  const nodeMap = new Map<number, FolderTreeNode>();
  for (const f of folders) {
    const c = counts.get(f.id) ?? { total: 0, unread: 0 };
    nodeMap.set(f.id, { ...f, children: [], emailCount: c.total, unreadCount: c.unread });
  }

  const roots: FolderTreeNode[] = [];
  for (const f of folders) {
    const node = nodeMap.get(f.id)!;
    if (f.parent_id == null) {
      roots.push(node);
    } else {
      const parent = nodeMap.get(f.parent_id);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
  }

  const aggregateCounts = (node: FolderTreeNode): FolderTreeNode => {
    for (const child of node.children) {
      aggregateCounts(child);
      node.emailCount += child.emailCount;
      node.unreadCount += child.unreadCount;
    }
    return node;
  };

  for (const root of roots) {
    aggregateCounts(root);
  }

  return roots;
}

// ─── Main component ───────────────────────────────────────────────────────

type View = "emails" | "rules" | "folders";

function GmailDashboard({ api, settings }: WidgetProps) {
  const ready = useSqlInit(api, INIT_SQL, MIGRATIONS);

  const [authState, setAuthState] = useState<AuthState>("loading");
  const [authError, setAuthError] = useState("");

  const [folders, setFolders] = useState<GmailFolder[]>([]);
  const [rules, setRules] = useState<GmailRule[]>([]);
  const [counts, setCounts] = useState<Map<number, { total: number; unread: number }>>(new Map());
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [emails, setEmails] = useState<GmailEmail[]>([]);

  const [view, setView] = useState<View>("emails");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanError, setScanError] = useState("");
  const [newCount, setNewCount] = useState(0);

  const gmailQuery = (settings.gmailQuery as string | undefined) || "";
  const maxResults = Number(settings.maxResults ?? 100);

  // ── Seed default folders & rules on first load ────────────────────────

  const seedDefaults = useCallback(async () => {
    const existing = await api.sql.all<{ id: number }>("SELECT id FROM gd_folders LIMIT 1");
    if (existing.length > 0) return;

    // Insert root folder first
    const rootResult = await api.sql.run(INSERT_FOLDER, [
      DEFAULT_FOLDERS[0].name,
      null,
      0,
      DEFAULT_FOLDERS[0].icon,
    ]);
    const rootId = rootResult.lastInsertRowid;

    // Insert child folders
    const childIds: Record<string, number> = {};
    for (let i = 1; i < DEFAULT_FOLDERS.length; i++) {
      const f = DEFAULT_FOLDERS[i];
      const res = await api.sql.run(INSERT_FOLDER, [f.name, rootId, f.sort_order, f.icon]);
      childIds[f.name] = res.lastInsertRowid;
    }

    // Insert default rules
    for (const [folderName, field, operator, value, priority] of DEFAULT_RULES) {
      const fid = childIds[folderName];
      if (!fid) continue;
      await api.sql.run(INSERT_RULE, [fid, field, operator, value, priority]);
    }
  }, [api]);

  // ── Data loaders ──────────────────────────────────────────────────────

  const loadFolders = useCallback(async () => {
    const rows = await api.sql.all<GmailFolder>(SELECT_ALL_FOLDERS);
    setFolders(rows);
    return rows;
  }, [api]);

  const loadRules = useCallback(async () => {
    const rows = await api.sql.all<GmailRule>(SELECT_ALL_RULES);
    setRules(rows);
    return rows;
  }, [api]);

  const loadCounts = useCallback(async () => {
    const rows = await api.sql.all<{ fid: number; total: number; unread: number }>(
      SELECT_FOLDER_COUNTS,
    );
    const m = new Map<number, { total: number; unread: number }>();
    for (const r of rows) m.set(r.fid, { total: r.total, unread: r.unread });
    setCounts(m);
  }, [api]);

  const loadEmails = useCallback(
    async (folderId: number) => {
      const rows = await api.sql.all<GmailEmail>(SELECT_EMAILS_FOR_FOLDER, [folderId]);
      setEmails(rows);
    },
    [api],
  );

  const loadAll = useCallback(async () => {
    await Promise.all([loadFolders(), loadRules(), loadCounts()]);
  }, [loadFolders, loadRules, loadCounts]);

  // ── Auth initialization ───────────────────────────────────────────────

  useEffect(() => {
    if (!ready) return;

    const init = async () => {
      try {
        const connected = await api.google.shared.isConnected();
        if (connected) {
          await seedDefaults();
          await loadAll();
          setAuthState("connected");
          return;
        }
        const hasCreds = await api.google.shared.hasCreds();
        if (hasCreds) {
          setAuthState("connecting");
          const ok = await api.google.shared.reconnect();
          if (ok) {
            await seedDefaults();
            await loadAll();
            setAuthState("connected");
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
    void init();
  }, [ready, api, seedDefaults, loadAll]);

  // ── Load emails when folder selection changes ─────────────────────────

  useEffect(() => {
    if (selectedFolderId != null) {
      void loadEmails(selectedFolderId);
    } else {
      setEmails([]);
    }
  }, [selectedFolderId, loadEmails]);

  // ── Connect flow ──────────────────────────────────────────────────────

  const handleConnect = async () => {
    setAuthState("connecting");
    setAuthError("");
    try {
      await api.google.shared.connect({ clientId: "", clientSecret: "", service: "gmail" });
      await seedDefaults();
      await loadAll();
      setAuthState("connected");
    } catch (err) {
      setAuthError(String(err));
      setAuthState("no-creds");
    }
  };

  const handleDisconnect = async () => {
    await api.google.shared.disconnect("gmail");
    setFolders([]);
    setRules([]);
    setCounts(new Map());
    setEmails([]);
    setAuthState("no-creds");
  };

  // ── Scan ──────────────────────────────────────────────────────────────

  const handleScan = async () => {
    setScanning(true);
    setScanProgress(0);
    setScanError("");
    setNewCount(0);
    try {
      const token = await api.google.shared.getToken("gmail");
      if (!token) {
        setAuthState("no-creds");
        return;
      }

      const effectiveQuery = gmailQuery ||
        "(job OR application OR interview OR offer OR rejection OR alert) newer_than:90d";

      const n = await fetchAndStoreEmails(
        api,
        token,
        { query: effectiveQuery, maxResults, rules },
        (count) => setScanProgress(count),
      );

      setNewCount(n);
      await loadCounts();
      if (selectedFolderId != null) await loadEmails(selectedFolderId);
    } catch (err) {
      setScanError(String(err));
    } finally {
      setScanning(false);
    }
  };

  // ── Move email ────────────────────────────────────────────────────────

  const handleMove = async (emailId: number, folderId: number | null) => {
    if (folderId === null) {
      await api.sql.run(CLEAR_OVERRIDE_FOLDER, [emailId]);
    } else {
      await api.sql.run(SET_OVERRIDE_FOLDER, [folderId, emailId]);
    }
    await loadCounts();
    if (selectedFolderId != null) await loadEmails(selectedFolderId);
  };

  // ── After rules/folders change ────────────────────────────────────────

  const handleRulesChanged = useCallback(async () => {
    const updatedRules = await loadRules();
    await reapplyAllRules(api, updatedRules);
    await loadCounts();
    if (selectedFolderId != null) await loadEmails(selectedFolderId);
  }, [api, loadRules, loadCounts, loadEmails, selectedFolderId]);

  const handleFoldersChanged = useCallback(async () => {
    await loadAll();
    if (selectedFolderId != null) await loadEmails(selectedFolderId);
  }, [loadAll, loadEmails, selectedFolderId]);

  // ── Tree ──────────────────────────────────────────────────────────────

  const treeRoots = useMemo(() => buildTree(folders, counts), [folders, counts]);

  // ── Render ────────────────────────────────────────────────────────────

  if (!ready || authState === "loading") {
    return (
      <div style={{ padding: 16, color: "var(--text-dim)", fontSize: 12 }}>
        Initializing…
      </div>
    );
  }

  if (authState === "connecting") {
    return (
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Connecting to Google…</div>
        <div style={{ ...dimText, fontSize: 12, lineHeight: 1.5 }}>
          A browser window opened for authorization. Complete sign-in there and return here.
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
        <div style={{ padding: "12px 8px" }}>
          <NotConnected />
          <button
            className="primary"
            style={{ ...buttonDefault, marginTop: 12 }}
            onClick={() => void handleConnect()}
          >
            Connect Google Account
          </button>
        </div>
      </div>
    );
  }

  // Connected
  const selectedFolder = folders.find((f) => f.id === selectedFolderId);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Top toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "0 0 6px",
          flexShrink: 0,
          borderBottom: "1px solid var(--border)",
          flexWrap: "wrap",
        }}
      >
        <button
          className="primary"
          style={buttonSmall}
          onClick={() => void handleScan()}
          disabled={scanning}
        >
          {scanning ? `Scanning… (${scanProgress})` : "⟳ Scan Gmail"}
        </button>

        {newCount > 0 && !scanning && (
          <span style={{ fontSize: 11, color: "var(--accent)" }}>
            +{newCount} new
          </span>
        )}

        <div
          style={{
            display: "flex",
            background: "var(--panel-2)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            overflow: "hidden",
            fontSize: 11,
          }}
        >
          {(["emails", "rules", "folders"] as const).map((v) => (
            <button
              key={v}
              className="ghost"
              style={{
                padding: "2px 8px",
                borderRadius: 0,
                fontWeight: view === v ? 600 : 400,
                background: view === v ? "var(--accent)" : "transparent",
                color: view === v ? "#fff" : "var(--text-dim)",
                fontSize: 11,
              }}
              onClick={() => setView(v)}
            >
              {v === "emails" ? "Emails" : v === "rules" ? "Rules" : "Folders"}
            </button>
          ))}
        </div>

        {view === "emails" && (
          <select
            style={{ fontSize: 11, padding: "2px 6px", marginLeft: "auto" }}
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            title="Group emails by"
          >
            <option value="none">No grouping</option>
            <option value="company">By sender</option>
            <option value="source">By source</option>
            <option value="recency">By recency</option>
          </select>
        )}

        <button
          className="ghost"
          style={{ fontSize: 11, padding: "2px 6px", color: "var(--text-dim)" }}
          onClick={() => void handleDisconnect()}
          title="Disconnect Google account"
        >
          ✕ Disconnect
        </button>
      </div>

      {scanError && (
        <div style={{ fontSize: 11, color: "#ff6e6e", padding: "2px 0", flexShrink: 0 }}>
          {scanError}
        </div>
      )}

      {/* Body */}
      {view === "rules" ? (
        <div style={{ flex: 1, overflow: "auto", minHeight: 0, paddingTop: 8 }}>
          <RulesEditor rules={rules} folders={folders} api={api} onChanged={() => void handleRulesChanged()} />
        </div>
      ) : view === "folders" ? (
        <div style={{ flex: 1, overflow: "auto", minHeight: 0, paddingTop: 8 }}>
          <FolderManager folders={folders} api={api} onChanged={() => void handleFoldersChanged()} />
        </div>
      ) : (
        <div style={{ display: "flex", flex: 1, minHeight: 0, gap: 0 }}>
          {/* Folder sidebar */}
          <div
            style={{
              width: 160,
              flexShrink: 0,
              borderRight: "1px solid var(--border)",
              overflowY: "auto",
              paddingTop: 6,
              paddingRight: 4,
            }}
          >
            <FolderTree
              roots={treeRoots}
              selectedId={selectedFolderId}
              onSelect={(id) => setSelectedFolderId(id === selectedFolderId ? null : id)}
            />
          </div>

          {/* Email pane */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, paddingLeft: 6, paddingTop: 4 }}>
            {selectedFolderId == null ? (
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
                Select a folder to view emails
              </div>
            ) : (
              <>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-dim)",
                    paddingBottom: 4,
                    flexShrink: 0,
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  {selectedFolder?.icon && `${selectedFolder.icon} `}
                  {selectedFolder?.name ?? "Folder"}
                  <span style={{ fontWeight: 400, marginLeft: 6 }}>
                    ({emails.length})
                  </span>
                </div>
                <EmailList
                  emails={emails}
                  folders={folders}
                  groupBy={groupBy}
                  onOpenGmail={(threadId) =>
                    void api.shell.openExternal(
                      `https://mail.google.com/mail/u/0/#inbox/${threadId}`,
                    )
                  }
                  onMove={(emailId, folderId) => void handleMove(emailId, folderId)}
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Widget export ────────────────────────────────────────────────────────

const widget: Widget = {
  manifest: {
    id: "gmail-dashboard",
    name: "Gmail Dashboard",
    description: "Organizes Gmail messages into folders using customizable filter rules. Tailored for job search.",
    version: "0.1.0",
    icon: "📬",
    defaultSize: { w: 8, h: 8 },
    minSize: { w: 6, h: 5 },
    permissions: {
      sqlite: true,
      google: true,
    },
    settings: [
      {
        kind: "string",
        key: "gmailQuery",
        label: "Gmail search query",
        placeholder: "e.g. label:job-search newer_than:90d",
        default: "",
      },
      {
        kind: "number",
        key: "maxResults",
        label: "Max emails per scan",
        default: 100,
        min: 10,
        max: 500,
        step: 10,
      },
    ],
  },
  Component: GmailDashboard,
};

export default widget;
