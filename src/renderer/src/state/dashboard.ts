import { create } from 'zustand';
import type { AppState, Dashboard, DashboardId, InstanceId, WidgetId, WidgetInstance, WidgetSettings } from '@shared/types';

const NANOID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
function nanoid(length: number): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => NANOID_ALPHABET[b & 63]).join('');
}
import { DEFAULT_STATE } from '@shared/defaults';
import { defaultSettingsFor, getWidget } from '@renderer/plugins/registry';

interface DashboardStore {
  loaded: boolean;
  state: AppState;

  load(): Promise<void>;
  persist(): void;
  applyRemoteState(state: AppState): void;

  activeDashboard(): Dashboard;
  setActiveDashboard(id: DashboardId): void;

  addDashboard(name: string): DashboardId;
  removeDashboard(id: DashboardId): void;
  renameDashboard(id: DashboardId, name: string): void;

  addInstance(widgetId: WidgetId): InstanceId | null;
  removeInstance(instanceId: InstanceId): void;
  updateLayout(layouts: { instanceId: InstanceId; x: number; y: number; w: number; h: number }[]): void;
  updateSettings(instanceId: InstanceId, settings: WidgetSettings): void;
  setTitle(instanceId: InstanceId, title: string | undefined): void;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function patchActive(state: AppState, fn: (d: Dashboard) => Dashboard): AppState {
  return {
    ...state,
    dashboards: state.dashboards.map((d) => (d.id === state.activeDashboardId ? fn(d) : d))
  };
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
    set({ state: s, loaded: true });
  },

  persist() {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      void window.cc.state.save(get().state);
    }, 150);
  },

  applyRemoteState(state) {
    if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
    set({ state });
  },

  activeDashboard() {
    const s = get().state;
    return s.dashboards.find((d) => d.id === s.activeDashboardId) ?? s.dashboards[0];
  },

  setActiveDashboard(id) {
    mutate((s) => ({ ...s, activeDashboardId: id }));
  },

  addDashboard(name) {
    const id = nanoid(8);
    mutate((s) => ({
      ...s,
      dashboards: [...s.dashboards, { id, name, instances: [] }],
      activeDashboardId: id
    }));
    return id;
  },

  removeDashboard(id) {
    mutate((s) => {
      const filtered = s.dashboards.filter((d) => d.id !== id);
      const dashboards = filtered.length > 0 ? filtered : DEFAULT_STATE.dashboards;
      const activeDashboardId =
        s.activeDashboardId === id ? dashboards[0].id : s.activeDashboardId;
      return { ...s, dashboards, activeDashboardId };
    });
  },

  renameDashboard(id, name) {
    mutate((s) => ({
      ...s,
      dashboards: s.dashboards.map((d) => (d.id === id ? { ...d, name } : d))
    }));
  },

  addInstance(widgetId) {
    const widget = getWidget(widgetId);
    if (!widget) {
      console.warn(`[dashboard] addInstance: widget "${widgetId}" not found`);
      return null;
    }
    const instanceId = nanoid(10);
    const { defaultSize } = widget.manifest;
    const settings = defaultSettingsFor(widget.manifest);
    mutate((s) =>
      patchActive(s, (d) => {
        const maxY = d.instances.reduce((m, inst) => Math.max(m, inst.layout.y + inst.layout.h), 0);
        const inst: WidgetInstance = {
          instanceId,
          widgetId,
          layout: { x: 0, y: maxY, w: defaultSize.w, h: defaultSize.h },
          settings
        };
        return { ...d, instances: [...d.instances, inst] };
      })
    );
    return instanceId;
  },

  removeInstance(instanceId) {
    mutate((s) =>
      patchActive(s, (d) => ({
        ...d,
        instances: d.instances.filter((i) => i.instanceId !== instanceId)
      }))
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
            return l ? { ...i, layout: { x: l.x, y: l.y, w: l.w, h: l.h } } : i;
          })
        };
      })
    );
  },

  updateSettings(instanceId, settings) {
    mutate((s) =>
      patchActive(s, (d) => ({
        ...d,
        instances: d.instances.map((i) => (i.instanceId === instanceId ? { ...i, settings } : i))
      }))
    );
  },

  setTitle(instanceId, title) {
    mutate((s) => {
      const active = s.dashboards.find((d) => d.id === s.activeDashboardId);
      const current = active?.instances.find((i) => i.instanceId === instanceId);
      if (!current || current.title === title) return s;

      return patchActive(s, (d) => ({
        ...d,
        instances: d.instances.map((i) => (i.instanceId === instanceId ? { ...i, title } : i))
      }));
    });
  }
  };
});
