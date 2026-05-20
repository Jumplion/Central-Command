import type { AppState } from "./types";

export const DEFAULT_STATE: AppState = {
  version: 1,
  dashboards: [{ id: "default", name: "Home", instances: [] }],
  activeDashboardId: "default",
};
