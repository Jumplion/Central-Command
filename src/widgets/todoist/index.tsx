import { useEffect, useRef, useState } from "react";
import type { Widget, WidgetProps } from "@renderer/plugins/registry";
import {
  buttonDefault,
  buttonSmall,
  dimText,
  inputBase,
} from "../_shared/styles";
import {
  PRIORITY_COLOR,
  SECRET_TOKEN_KEY,
  TODOIST_API_BASE,
} from "./constants";
import type { TodoistProject, TodoistTask } from "./types";

// ── API helpers ──────────────────────────────────────────────────────────────

async function apiGet<T>(
  api: WidgetProps["api"],
  token: string,
  path: string,
): Promise<T> {
  const res = await api.net.fetch(`${TODOIST_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return JSON.parse(res.body) as T;
}

async function apiPost<T>(
  api: WidgetProps["api"],
  token: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const res = await api.net.fetch(`${TODOIST_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status}`);
  if (res.body) return JSON.parse(res.body) as T;
  return undefined as T;
}

async function apiDelete(
  api: WidgetProps["api"],
  token: string,
  path: string,
): Promise<void> {
  const res = await api.net.fetch(`${TODOIST_API_BASE}${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`${res.status}`);
}

// ── Due date display ─────────────────────────────────────────────────────────

function formatDue(
  due: TodoistTask["due"],
): { label: string; overdue: boolean } | null {
  if (!due) return null;
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const dueDate = due.date;
  const overdue = dueDate < today;
  let label: string;
  if (dueDate === today) label = "Today";
  else if (dueDate === tomorrow) label = "Tomorrow";
  else {
    const d = new Date(dueDate + "T00:00:00");
    label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return { label, overdue };
}

// ── Token setup screen ───────────────────────────────────────────────────────

function TokenSetup({
  onConnect,
  onOpenLink,
}: {
  onConnect: (token: string) => Promise<string | null>;
  onOpenLink: (url: string) => void;
}) {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    const t = token.trim();
    if (!t) return;
    setLoading(true);
    setError(null);
    const err = await onConnect(t);
    if (err) setError(err);
    setLoading(false);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: 12,
        padding: 24,
      }}
    >
      <div style={{ fontSize: 28 }}>✅</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>Connect Todoist</div>
      <div
        style={{
          fontSize: 11,
          color: "var(--text-dim)",
          textAlign: "center",
          maxWidth: 240,
        }}
      >
        Enter your Todoist API token from{" "}
        <span
          style={{ color: "var(--accent)", cursor: "pointer" }}
          onClick={() =>
            onOpenLink(
              "https://app.todoist.com/app/settings/integrations/developer",
            )
          }
        >
          Settings → Integrations → Developer
        </span>
      </div>
      <input
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void handleConnect()}
        placeholder="API token"
        autoFocus
        style={{
          ...inputBase,
          width: "100%",
          maxWidth: 280,
          background: "var(--panel-2)",
        }}
      />
      {error && (
        <div style={{ fontSize: 11, color: "var(--danger)" }}>{error}</div>
      )}
      <button
        className="primary"
        style={{ ...buttonDefault, minWidth: 100 }}
        disabled={loading || !token.trim()}
        onClick={() => void handleConnect()}
      >
        {loading ? "Connecting…" : "Connect"}
      </button>
    </div>
  );
}

// ── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  onToggle,
  onSave,
  onDelete,
}: {
  task: TodoistTask;
  onToggle: () => void;
  onSave: (content: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.content);
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const due = formatDue(task.due);

  const startEdit = () => {
    setDraft(task.content);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commitEdit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== task.content) onSave(trimmed);
    setEditing(false);
  };

  const cancelEdit = () => {
    setDraft(task.content);
    setEditing(false);
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "6px 8px",
        borderRadius: 6,
        background: hovered ? "var(--panel-2)" : "transparent",
        transition: "background 0.1s",
        minHeight: 32,
      }}
    >
      {/* Checkbox */}
      <button
        onClick={onToggle}
        title={task.is_completed ? "Reopen" : "Complete"}
        style={{
          flexShrink: 0,
          width: 16,
          height: 16,
          marginTop: 2,
          borderRadius: "50%",
          border: `2px solid ${task.priority > 1 ? PRIORITY_COLOR[task.priority] : "var(--border)"}`,
          background: task.is_completed ? "var(--accent)" : "transparent",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          transition: "all 0.15s",
        }}
      >
        {task.is_completed && (
          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
            <path
              d="M1 3l2 2 4-4"
              stroke="#fff"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") cancelEdit();
            }}
            style={{
              ...inputBase,
              width: "100%",
              background: "var(--panel-2)",
              fontSize: 12,
              padding: "2px 6px",
            }}
          />
        ) : (
          <span
            onClick={startEdit}
            title="Click to edit"
            style={{
              fontSize: 12,
              color: task.is_completed ? "var(--text-dim)" : "var(--text)",
              textDecoration: task.is_completed ? "line-through" : "none",
              cursor: "text",
              display: "block",
              lineHeight: "1.4",
              wordBreak: "break-word",
            }}
          >
            {task.content}
          </span>
        )}
      </div>

      {/* Due date */}
      {due && !editing && (
        <span
          style={{
            flexShrink: 0,
            fontSize: 10,
            color: due.overdue ? "var(--danger)" : "var(--text-dim)",
            marginTop: 3,
            whiteSpace: "nowrap",
          }}
        >
          {due.label}
        </span>
      )}

      {/* Delete button */}
      {hovered && !editing && (
        <button
          onClick={onDelete}
          title="Delete task"
          style={{
            flexShrink: 0,
            background: "transparent",
            border: "none",
            color: "var(--text-dim)",
            cursor: "pointer",
            padding: "0 2px",
            fontSize: 14,
            lineHeight: 1,
            marginTop: 1,
            display: "flex",
            alignItems: "center",
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────

function TodoistWidget({ api }: WidgetProps) {
  const [token, setToken] = useState<string | null>(null);
  const [projects, setProjects] = useState<TodoistProject[]>([]);
  const [tasks, setTasks] = useState<TodoistTask[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addContent, setAddContent] = useState("");
  const [adding, setAdding] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  // Load token on mount
  useEffect(() => {
    void (async () => {
      const has = await api.secrets.has(SECRET_TOKEN_KEY);
      if (has) {
        const t = (await api.secrets.get(SECRET_TOKEN_KEY)) as string;
        setToken(t);
      }
    })();
  }, [api]);

  // Load data when token is available
  useEffect(() => {
    if (!token) return;
    void loadAll(token);
  }, [token]);

  const loadAll = async (t: string) => {
    setLoading(true);
    setError(null);
    try {
      const [projs, taskList] = await Promise.all([
        apiGet<TodoistProject[]>(api, t, "/projects"),
        apiGet<TodoistTask[]>(api, t, "/tasks"),
      ]);
      projs.sort((a, b) => a.order - b.order);
      setProjects(projs);
      setTasks(taskList);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "401") {
        setToken(null);
        await api.secrets.del(SECRET_TOKEN_KEY);
        setError("Token invalid. Please reconnect.");
      } else {
        setError("Failed to load tasks.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (t: string): Promise<string | null> => {
    try {
      await apiGet<TodoistProject[]>(api, t, "/projects");
      await api.secrets.set(SECRET_TOKEN_KEY, t);
      setToken(t);
      return null;
    } catch (err) {
      const errorMessage = String(err);
      if (errorMessage.includes("401") || errorMessage.includes("403")) {
        return "Invalid token. Please check and try again.";
      }
      return "Failed to connect. Please check your network and try again.";
    }
  };

  const handleDisconnect = async () => {
    await api.secrets.del(SECRET_TOKEN_KEY);
    setToken(null);
    setTasks([]);
    setProjects([]);
  };

  const handleToggle = async (task: TodoistTask) => {
    const wasCompleted = task.is_completed;
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, is_completed: !wasCompleted } : t,
      ),
    );
    try {
      if (wasCompleted) {
        await apiPost(api, token!, `/tasks/${task.id}/reopen`);
      } else {
        await apiPost(api, token!, `/tasks/${task.id}/close`);
      }
    } catch {
      // Rollback
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, is_completed: wasCompleted } : t,
        ),
      );
    }
  };

  const handleSave = async (task: TodoistTask, content: string) => {
    const oldContent = task.content;
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, content } : t)),
    );
    try {
      await apiPost(api, token!, `/tasks/${task.id}`, { content });
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, content: oldContent } : t)),
      );
    }
  };

  const handleDelete = async (taskId: string) => {
    const removed = tasks.find((t) => t.id === taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      await apiDelete(api, token!, `/tasks/${taskId}`);
    } catch {
      if (removed) setTasks((prev) => [...prev, removed]);
    }
  };

  const handleAddTask = async () => {
    const content = addContent.trim();
    if (!content) return;
    setAdding(true);
    const body: Record<string, unknown> = { content };
    if (selectedProject !== "all") body.project_id = selectedProject;
    try {
      const created = await apiPost<TodoistTask>(api, token!, "/tasks", body);
      setTasks((prev) => [...prev, created]);
      setAddContent("");
      addInputRef.current?.focus();
    } catch {
      setError("Failed to add task.");
    } finally {
      setAdding(false);
    }
  };

  if (!token) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
        }}
      >
        {error && (
          <div
            style={{
              background: "var(--danger)",
              color: "white",
              padding: "8px 12px",
              fontSize: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                cursor: "pointer",
                fontSize: 16,
                padding: 0,
              }}
            >
              ×
            </button>
          </div>
        )}
        <TokenSetup
          onConnect={handleConnect}
          onOpenLink={(url) => void api.shell.openExternal(url)}
        />
      </div>
    );
  }

  const visibleTasks = tasks
    .filter((t) => {
      if (selectedProject !== "all" && t.project_id !== selectedProject)
        return false;
      return showCompleted ? true : !t.is_completed;
    })
    .sort((a, b) => {
      if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (a.due && b.due) return a.due.date.localeCompare(b.due.date);
      if (a.due) return -1;
      if (b.due) return 1;
      return a.order - b.order;
    });

  const completedCount = tasks.filter((t) =>
    selectedProject === "all"
      ? t.is_completed
      : t.project_id === selectedProject && t.is_completed,
  ).length;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 8px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          style={{
            ...inputBase,
            flex: 1,
            background: "var(--panel-2)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text)",
            cursor: "pointer",
            padding: "3px 6px",
          }}
        >
          <option value="all">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.is_inbox_project ? "📥 Inbox" : p.name}
            </option>
          ))}
        </select>

        <button
          onClick={() => setShowCompleted((v) => !v)}
          title={showCompleted ? "Hide completed" : "Show completed"}
          style={{
            ...buttonSmall,
            background: showCompleted ? "var(--panel-2)" : "transparent",
            border: `1px solid ${showCompleted ? "var(--accent)" : "var(--border)"}`,
            color: showCompleted ? "var(--accent)" : "var(--text-dim)",
            borderRadius: 6,
            cursor: "pointer",
            flexShrink: 0,
            fontSize: 10,
          }}
        >
          ✓ {completedCount}
        </button>

        <button
          onClick={() => token && void loadAll(token)}
          disabled={loading}
          title="Refresh"
          style={{
            ...buttonSmall,
            background: "transparent",
            border: "1px solid var(--border)",
            color: "var(--text-dim)",
            borderRadius: 6,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {loading ? "…" : "↻"}
        </button>

        <button
          onClick={() => void handleDisconnect()}
          title="Disconnect"
          style={{
            ...buttonSmall,
            background: "transparent",
            border: "1px solid var(--border)",
            color: "var(--text-dim)",
            borderRadius: 6,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          ⏏
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div
          style={{
            fontSize: 11,
            color: "var(--danger)",
            padding: "4px 8px",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          {error}
        </div>
      )}

      {/* Task list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {visibleTasks.length === 0 && !loading && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              ...dimText,
              fontSize: 12,
            }}
          >
            {showCompleted ? "No tasks" : "All done! 🎉"}
          </div>
        )}
        {visibleTasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onToggle={() => void handleToggle(task)}
            onSave={(content) => void handleSave(task, content)}
            onDelete={() => void handleDelete(task.id)}
          />
        ))}
      </div>

      {/* Add task */}
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "6px 8px",
          borderTop: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <input
          ref={addInputRef}
          value={addContent}
          onChange={(e) => setAddContent(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void handleAddTask()}
          placeholder="Add a task…"
          disabled={adding}
          style={{
            ...inputBase,
            flex: 1,
            background: "var(--panel-2)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text)",
            fontSize: 12,
            padding: "4px 8px",
          }}
        />
        <button
          className="primary"
          onClick={() => void handleAddTask()}
          disabled={adding || !addContent.trim()}
          style={{ ...buttonDefault, flexShrink: 0 }}
        >
          {adding ? "…" : "Add"}
        </button>
      </div>
    </div>
  );
}

const widget: Widget = {
  manifest: {
    id: "todoist",
    name: "Todoist",
    description: "View, add, and complete your Todoist tasks",
    version: "0.1.0",
    author: "Central Command",
    icon: "✅",
    defaultSize: { w: 4, h: 7 },
    minSize: { w: 3, h: 4 },
    permissions: {},
  },
  Component: TodoistWidget,
};

export default widget;
