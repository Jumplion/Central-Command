import { create } from "zustand";
import type {
  AppState,
  Dashboard,
  DashboardId,
  InstanceId,
  WidgetId,
  WidgetInstance,
  WidgetSettings,
} from "@shared/types";

const NANOID_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
function nanoid(length: number): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => NANOID_ALPHABET[b & 63]).join("");
}
import { DEFAULT_STATE } from "@shared/defaults";
import { defaultSettingsFor, getWidget } from "@renderer/plugins/registry";

interface DashboardStore {
  loaded: boolean;
  state: AppState;

  load(): Promise<void>;
  persist(): void;
  applyRemoteState(state: AppState): void;

  activeDashboard(): Dashboard;
  activeInstances(): WidgetInstance[];
  setActiveDashboard(id: DashboardId): void;

  addDashboard(name: string): DashboardId;
  removeDashboard(id: DashboardId): void;
  renameDashboard(id: DashboardId, name: string): void;

  addInstance(widgetId: WidgetId): InstanceId | null;
  removeInstance(instanceId: InstanceId): void;
  updateLayout(
    layouts: {
      instanceId: InstanceId;
      x: number;
      y: number;
      w: number;
      h: number;
    }[],
  ): void;
  updateSettings(instanceId: InstanceId, settings: WidgetSettings): void;
  setTitle(instanceId: InstanceId, title: string | undefined): void;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function isDebugEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    return globalThis.localStorage?.getItem("cc:debug") === "1";
  } catch {
    return false;
  }
}

function debugLog(event: string, details: Record<string, unknown>): void {
  if (!isDebugEnabled()) return;
  console.info(`[dashboard] ${event}`, details);
}

function normalizeState(state: AppState): AppState {
  const dashboards =
    state.dashboards.length > 0 ? state.dashboards : DEFAULT_STATE.dashboards;
  const intermediate = { ...state, dashboards };
  return { ...intermediate, activeDashboardId: resolveActiveId(intermediate) };
}

function resolveActiveId(state: AppState): DashboardId {
  return state.dashboards.some((d) => d.id === state.activeDashboardId)
    ? state.activeDashboardId
    : (state.dashboards[0]?.id ?? state.activeDashboardId);
}

function patchActive(
  state: AppState,
  fn: (d: Dashboard) => Dashboard,
): AppState {
  const activeId = resolveActiveId(state);
  return {
    ...state,
    dashboards: state.dashboards.map((d) => (d.id === activeId ? fn(d) : d)),
  };
}

function updateWidgetInstance(
  state: AppState,
  instanceId: InstanceId,
  updater: (instance: WidgetInstance) => WidgetInstance,
): AppState {
  const activeId = resolveActiveId(state);
  let changed = false;

  const dashboards = state.dashboards.map((dashboard) => {
    if (dashboard.id !== activeId) return dashboard;

    const instances = dashboard.instances.map((instance) => {
      if (instance.instanceId !== instanceId) return instance;
      const updated = updater(instance);
      if (updated === instance) return instance;
      changed = true;
      return updated;
    });

    return changed ? { ...dashboard, instances } : dashboard;
  });

  return changed ? { ...state, dashboards } : state;
}

export const useDashboard = create<DashboardStore>((set, get) => {
  /** Apply a state transform and schedule persistence in one call. */
  function mutate(updater: (s: AppState) => AppState): void {
    set((store) => ({ state: updater(store.state) }));
    get().persist();
  }

  return {
    loaded: false,
    state: DEFAULT_STATE,

    async load() {
      const s = await window.cc.state.load();
      const normalized = normalizeState(s);
      debugLog("load", {
        dashboardCount: normalized.dashboards.length,
        activeDashboardId: normalized.activeDashboardId,
      });
      set({ state: normalized, loaded: true });
    },

    persist() {
      if (persistTimer) clearTimeout(persistTimer);
      persistTimer = setTimeout(() => {
        void window.cc.state.save(get().state);
      }, 150);
    },

    applyRemoteState(state) {
      if (persistTimer) {
        clearTimeout(persistTimer);
        persistTimer = null;
      }
      const normalized = normalizeState(state);
      debugLog("applyRemoteState", {
        dashboardCount: normalized.dashboards.length,
        activeDashboardId: normalized.activeDashboardId,
      });
      set({ state: normalized });
    },

    activeDashboard() {
      const s = get().state;
      const activeId = resolveActiveId(s);
      return s.dashboards.find((d) => d.id === activeId) ?? s.dashboards[0];
    },

    activeInstances() {
      const s = get().state;
      const activeId = resolveActiveId(s);
      return (
        s.dashboards.find((d) => d.id === activeId)?.instances ??
        s.dashboards[0]?.instances ??
        []
      );
    },

    setActiveDashboard(id) {
      mutate((s) => {
        if (!s.dashboards.some((d) => d.id === id)) {
          const fallbackId = resolveActiveId(s);
          debugLog("setActiveDashboard.invalid", {
            requestedId: id,
            fallbackId,
          });
          return { ...s, activeDashboardId: fallbackId };
        }
        debugLog("setActiveDashboard", { id });
        return { ...s, activeDashboardId: id };
      });
    },

    addDashboard(name) {
      const id = nanoid(8);
      mutate((s) => ({
        ...s,
        dashboards: [...s.dashboards, { id, name, instances: [] }],
        activeDashboardId: id,
      }));
      debugLog("addDashboard", { id, name });
      return id;
    },

    removeDashboard(id) {
      mutate((s) => {
        const filtered = s.dashboards.filter((d) => d.id !== id);
        const dashboards =
          filtered.length > 0 ? filtered : DEFAULT_STATE.dashboards;
        const activeDashboardId =
          s.activeDashboardId === id ? dashboards[0].id : s.activeDashboardId;
        return { ...s, dashboards, activeDashboardId };
      });
    },

    renameDashboard(id, name) {
      mutate((s) => ({
        ...s,
        dashboards: s.dashboards.map((d) => (d.id === id ? { ...d, name } : d)),
      }));
    },

    addInstance(widgetId) {
      const stateBefore = get().state;
      const targetDashboardId = resolveActiveId(stateBefore);
      const targetDashboard = stateBefore.dashboards.find(
        (d) => d.id === targetDashboardId,
      );

      const widget = getWidget(widgetId);
      if (!widget) {
        console.warn(`[dashboard] addInstance: widget "${widgetId}" not found`);
        debugLog("addInstance.rejected", {
          widgetId,
          targetDashboardId,
          reason: "widget-not-found",
        });
        return null;
      }

      const instanceId = nanoid(10);
      const { defaultSize } = widget.manifest;
      const settings = defaultSettingsFor(widget.manifest);

      debugLog("addInstance.request", {
        widgetId,
        instanceId,
        targetDashboardId,
        targetDashboardName: targetDashboard?.name,
        existingInstances: targetDashboard?.instances.length ?? 0,
      });

      mutate((s) =>
        patchActive(s, (d) => {
          const maxY = d.instances.reduce(
            (m, inst) => Math.max(m, inst.layout.y + inst.layout.h),
            0,
          );
          const inst: WidgetInstance = {
            instanceId,
            widgetId,
            layout: { x: 0, y: maxY, w: defaultSize.w, h: defaultSize.h },
            settings,
          };
          return { ...d, instances: [...d.instances, inst] };
        }),
      );

      const stateAfter = get().state;
      const activeAfter = stateAfter.dashboards.find(
        (d) => d.id === resolveActiveId(stateAfter),
      );
      const added = activeAfter?.instances.find(
        (i) => i.instanceId === instanceId,
      );

      debugLog("addInstance.result", {
        widgetId,
        instanceId,
        activeDashboardId: activeAfter?.id,
        activeDashboardName: activeAfter?.name,
        inserted: Boolean(added),
        layout: added?.layout,
      });

      return instanceId;
    },

    removeInstance(instanceId) {
      mutate((s) =>
        patchActive(s, (d) => ({
          ...d,
          instances: d.instances.filter((i) => i.instanceId !== instanceId),
        })),
      );
    },

    updateLayout(layouts) {
      mutate((s) =>
        patchActive(s, (d) => {
          const map = new Map(layouts.map((l) => [l.instanceId, l]));
          return {
            ...d,
            instances: d.instances.map((i) => {
              const l = map.get(i.instanceId);
              return l
                ? { ...i, layout: { x: l.x, y: l.y, w: l.w, h: l.h } }
                : i;
            }),
          };
        }),
      );
    },

    updateSettings(instanceId, settings) {
      mutate((s) =>
        updateWidgetInstance(s, instanceId, (i) => ({ ...i, settings })),
      );
    },

    setTitle(instanceId, title) {
      mutate((s) => {
        const active = s.dashboards.find((d) => d.id === s.activeDashboardId);
        const current = active?.instances.find(
          (i) => i.instanceId === instanceId,
        );
        if (!current || current.title === title) return s;

        return updateWidgetInstance(s, instanceId, (i) => ({ ...i, title }));
      });
    },
  };
});
