export const TODOIST_API_BASE = "https://api.todoist.com/rest/v2";
export const SECRET_TOKEN_KEY = "api_token";

export const PRIORITY_COLOR: Record<number, string> = {
  4: "var(--danger)",
  3: "#f59e0b",
  2: "#3b82f6",
  1: "var(--text-dim)",
};

const PRIORITY_LABEL: Record<number, string> = {
  4: "Urgent",
  3: "High",
  2: "Medium",
  1: "Normal",
};
