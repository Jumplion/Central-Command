import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { AppState, Dashboard, DashboardId, InstanceId, WidgetId, WidgetInstance, WidgetSettings } from '@shared/types';
import { defaultSettingsFor, getWidget } from '@renderer/plugins/registry';

interface DashboardStore {
  loaded: boolean;
  state: AppState;

  load(): Promise<void>;
  persist(): void;

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

const DEFAULT_STATE: AppState = {
  version: 1,
  dashboards: [{ id: 'default', name: 'Home', instances: [] }],
  activeDashboardId: 'default'
};

let persistTimer: ReturnType<typeof setTimeout> | null = null;

export const useDashboard = create<DashboardStore>((set, get) => ({
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

  activeDashboard() {
    const s = get().state;
    return s.dashboards.find((d) => d.id === s.activeDashboardId) ?? s.dashboards[0];
  },

  setActiveDashboard(id) {
    set((s) => ({ state: { ...s.state, activeDashboardId: id } }));
    get().persist();
  },

  addDashboard(name) {
    const id = nanoid(8);
    set((s) => ({
      state: {
        ...s.state,
        dashboards: [...s.state.dashboards, { id, name, instances: [] }],
        activeDashboardId: id
      }
    }));
    get().persist();
    return id;
  },

  removeDashboard(id) {
    set((s) => {
      const filtered = s.state.dashboards.filter((d) => d.id !== id);
      const dashboards = filtered.length > 0 ? filtered : DEFAULT_STATE.dashboards;
      const activeDashboardId =
        s.state.activeDashboardId === id ? dashboards[0].id : s.state.activeDashboardId;
      return { state: { ...s.state, dashboards, activeDashboardId } };
    });
    get().persist();
  },

  renameDashboard(id, name) {
    set((s) => ({
      state: {
        ...s.state,
        dashboards: s.state.dashboards.map((d) => (d.id === id ? { ...d, name } : d))
      }
    }));
    get().persist();
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
    set((s) => {
      const dashboards = s.state.dashboards.map((d) => {
        if (d.id !== s.state.activeDashboardId) return d;
        const maxY = d.instances.reduce((m, inst) => Math.max(m, inst.layout.y + inst.layout.h), 0);
        const inst: WidgetInstance = {
          instanceId,
          widgetId,
          layout: { x: 0, y: maxY, w: defaultSize.w, h: defaultSize.h },
          settings
        };
        return { ...d, instances: [...d.instances, inst] };
      });
      return { state: { ...s.state, dashboards } };
    });
    get().persist();
    return instanceId;
  },

  removeInstance(instanceId) {
    set((s) => {
      const dashboards = s.state.dashboards.map((d) =>
        d.id !== s.state.activeDashboardId
          ? d
          : { ...d, instances: d.instances.filter((i) => i.instanceId !== instanceId) }
      );
      return { state: { ...s.state, dashboards } };
    });
    get().persist();
  },

  updateLayout(layouts) {
    set((s) => {
      const dashboards = s.state.dashboards.map((d) => {
        if (d.id !== s.state.activeDashboardId) return d;
        const map = new Map(layouts.map((l) => [l.instanceId, l]));
        return {
          ...d,
          instances: d.instances.map((i) => {
            const l = map.get(i.instanceId);
            return l ? { ...i, layout: { x: l.x, y: l.y, w: l.w, h: l.h } } : i;
          })
        };
      });
      return { state: { ...s.state, dashboards } };
    });
    get().persist();
  },

  updateSettings(instanceId, settings) {
    set((s) => {
      const dashboards = s.state.dashboards.map((d) =>
        d.id !== s.state.activeDashboardId
          ? d
          : {
              ...d,
              instances: d.instances.map((i) =>
                i.instanceId === instanceId ? { ...i, settings } : i
              )
            }
      );
      return { state: { ...s.state, dashboards } };
    });
    get().persist();
  },

  setTitle(instanceId, title) {
    set((s) => {
      const dashboards = s.state.dashboards.map((d) =>
        d.id !== s.state.activeDashboardId
          ? d
          : {
              ...d,
              instances: d.instances.map((i) =>
                i.instanceId === instanceId ? { ...i, title } : i
              )
            }
      );
      return { state: { ...s.state, dashboards } };
    });
    get().persist();
  }
}));
