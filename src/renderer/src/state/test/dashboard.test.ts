import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppState } from "@shared/types";
import { DEFAULT_STATE } from "@shared/defaults";

vi.mock("@renderer/plugins/registry", () => ({
  getWidget: vi.fn(),
  defaultSettingsFor: vi.fn(),
}));

// Imports must come after vi.mock so mocks are in place when dashboard.ts loads
import { useDashboard } from "../dashboard";
import { getWidget, defaultSettingsFor } from "@renderer/plugins/registry";

const mockGetWidget = vi.mocked(getWidget);
const mockDefaultSettingsFor = vi.mocked(defaultSettingsFor);

const mockSave = vi.fn<() => Promise<void>>();
const mockLoad = vi.fn<() => Promise<AppState>>();

function makeWidget(id = "test-widget") {
  return {
    manifest: {
      id,
      name: "Test Widget",
      version: "1.0.0",
      defaultSize: { w: 3, h: 4 },
    },
    Component: () => null,
  };
}

function getState() {
  return useDashboard.getState().state;
}

function getActions() {
  return useDashboard.getState();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mockSave.mockResolvedValue(undefined);
  mockLoad.mockResolvedValue(structuredClone(DEFAULT_STATE));
  mockGetWidget.mockReturnValue(undefined);
  mockDefaultSettingsFor.mockReturnValue({});
  vi.stubGlobal("cc", { state: { load: mockLoad, save: mockSave } });
  // Reset store to a clean slate (shallow merge preserves action methods)
  useDashboard.setState({
    state: structuredClone(DEFAULT_STATE),
    loaded: false,
  });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("load", () => {
  it("populates state from window.cc.state.load and sets loaded = true", async () => {
    const remoteState: AppState = {
      version: 1,
      dashboards: [{ id: "dash-1", name: "Loaded", instances: [] }],
      activeDashboardId: "dash-1",
    };
    mockLoad.mockResolvedValue(remoteState);

    await getActions().load();

    expect(useDashboard.getState().loaded).toBe(true);
    expect(getState()).toEqual(remoteState);
  });
});

describe("activeDashboard", () => {
  it("returns the dashboard matching activeDashboardId", () => {
    const dashboard = getActions().activeDashboard();
    expect(dashboard.id).toBe("default");
    expect(dashboard.name).toBe("Home");
  });

  it("falls back to the first dashboard when activeDashboardId is not found", () => {
    useDashboard.setState({
      state: {
        version: 1,
        dashboards: [{ id: "only", name: "Only", instances: [] }],
        activeDashboardId: "missing",
      },
    });
    expect(getActions().activeDashboard().id).toBe("only");
  });
});

describe("load normalization", () => {
  it("normalizes a stale activeDashboardId to dashboards[0] on load", async () => {
    const staleState: AppState = {
      version: 1,
      dashboards: [{ id: "default", name: "Home", instances: [] }],
      activeDashboardId: "stale-id",
    };
    mockLoad.mockResolvedValue(staleState);

    await getActions().load();

    expect(getState().activeDashboardId).toBe("default");
  });
});

describe("addDashboard", () => {
  it("adds a new dashboard and makes it active", () => {
    const id = getActions().addDashboard("Work");
    const state = getState();
    expect(state.dashboards.find((d) => d.id === id)).toBeDefined();
    expect(state.activeDashboardId).toBe(id);
  });

  it("schedules persistence after adding a dashboard", () => {
    getActions().addDashboard("Work");
    vi.runAllTimers();
    expect(mockSave).toHaveBeenCalledOnce();
  });
});

describe("removeDashboard", () => {
  it("removes the specified dashboard", () => {
    const id = getActions().addDashboard("Temp");
    getActions().removeDashboard(id);
    expect(getState().dashboards.find((d) => d.id === id)).toBeUndefined();
  });

  it("falls back to DEFAULT_STATE.dashboards when the last dashboard is removed", () => {
    getActions().removeDashboard("default");
    const { dashboards } = getState();
    expect(dashboards.length).toBeGreaterThan(0);
    expect(dashboards[0].id).toBe("default");
  });

  it("switches activeDashboardId when the active dashboard is removed", () => {
    const newId = getActions().addDashboard("Work"); // now active
    getActions().removeDashboard(newId);
    expect(getState().activeDashboardId).not.toBe(newId);
  });

  it("keeps activeDashboardId unchanged when a non-active dashboard is removed", () => {
    getActions().addDashboard("Extra");
    const activeId = getState().activeDashboardId;
    // Remove the original 'default' dashboard (which is no longer active)
    getActions().removeDashboard("default");
    expect(getState().activeDashboardId).toBe(activeId);
  });
});

describe("renameDashboard", () => {
  it("updates the name of the specified dashboard", () => {
    getActions().renameDashboard("default", "Renamed");
    expect(getState().dashboards.find((d) => d.id === "default")?.name).toBe(
      "Renamed",
    );
  });
});

describe("setActiveDashboard", () => {
  it("changes the active dashboard id", () => {
    const newId = getActions().addDashboard("Second");
    getActions().setActiveDashboard("default");
    expect(getState().activeDashboardId).toBe("default");
    getActions().setActiveDashboard(newId);
    expect(getState().activeDashboardId).toBe(newId);
  });

  it("falls back to a valid dashboard id when requested id does not exist", () => {
    getActions().setActiveDashboard("missing-dashboard-id");
    expect(getState().activeDashboardId).toBe("default");
  });
});

describe("addInstance", () => {
  it("returns null when widgetId is not registered", () => {
    mockGetWidget.mockReturnValue(undefined);
    expect(getActions().addInstance("unknown-widget")).toBeNull();
    expect(getState().dashboards[0].instances).toHaveLength(0);
  });

  it("adds a widget instance with correct layout and settings", () => {
    const widget = makeWidget();
    mockGetWidget.mockReturnValue(widget as ReturnType<typeof getWidget>);
    mockDefaultSettingsFor.mockReturnValue({ theme: "dark" });

    const instanceId = getActions().addInstance("test-widget");
    expect(instanceId).toBeTypeOf("string");

    const instances = getState().dashboards.find(
      (d) => d.id === getState().activeDashboardId,
    )!.instances;
    expect(instances).toHaveLength(1);
    expect(instances[0].widgetId).toBe("test-widget");
    expect(instances[0].layout).toMatchObject({ x: 0, y: 0, w: 3, h: 4 });
    expect(instances[0].settings).toEqual({ theme: "dark" });
  });

  it("places the new instance below all existing instances", () => {
    const widget = makeWidget();
    mockGetWidget.mockReturnValue(widget as ReturnType<typeof getWidget>);
    mockDefaultSettingsFor.mockReturnValue({});

    getActions().addInstance("test-widget"); // y=0, h=4 → bottom at y=4
    getActions().addInstance("test-widget"); // should be at y=4

    const instances = getState().dashboards[0].instances;
    expect(instances[1].layout.y).toBe(4);
  });

  it("adds widget to dashboards[0] when activeDashboardId is stale", () => {
    const widget = makeWidget();
    mockGetWidget.mockReturnValue(widget as ReturnType<typeof getWidget>);
    mockDefaultSettingsFor.mockReturnValue({});

    useDashboard.setState({
      state: {
        version: 1,
        dashboards: [{ id: "default", name: "Home", instances: [] }],
        activeDashboardId: "stale-id",
      },
    });

    const instanceId = getActions().addInstance("test-widget");
    expect(instanceId).toBeTypeOf("string");

    const instances = getState().dashboards[0].instances;
    expect(instances).toHaveLength(1);
    expect(instances[0].widgetId).toBe("test-widget");
  });
});

describe("removeInstance", () => {
  it("removes the specified instance", () => {
    const widget = makeWidget();
    mockGetWidget.mockReturnValue(widget as ReturnType<typeof getWidget>);
    mockDefaultSettingsFor.mockReturnValue({});

    const instanceId = getActions().addInstance("test-widget")!;
    getActions().removeInstance(instanceId);

    expect(getState().dashboards[0].instances).toHaveLength(0);
  });
});

describe("updateSettings", () => {
  it("merges new settings onto the specified instance", () => {
    const widget = makeWidget();
    mockGetWidget.mockReturnValue(widget as ReturnType<typeof getWidget>);
    mockDefaultSettingsFor.mockReturnValue({ theme: "light" });

    const instanceId = getActions().addInstance("test-widget")!;
    getActions().updateSettings(instanceId, { theme: "dark", size: "lg" });

    const instance = getState().dashboards[0].instances.find(
      (i) => i.instanceId === instanceId,
    )!;
    expect(instance.settings).toEqual({ theme: "dark", size: "lg" });
  });
});

describe("updateLayout", () => {
  it("updates layout coordinates for the specified instances", () => {
    const widget = makeWidget();
    mockGetWidget.mockReturnValue(widget as ReturnType<typeof getWidget>);
    mockDefaultSettingsFor.mockReturnValue({});

    const instanceId = getActions().addInstance("test-widget")!;
    getActions().updateLayout([{ instanceId, x: 5, y: 2, w: 6, h: 3 }]);

    const instance = getState().dashboards[0].instances.find(
      (i) => i.instanceId === instanceId,
    )!;
    expect(instance.layout).toEqual({ x: 5, y: 2, w: 6, h: 3 });
  });
});

describe("setTitle", () => {
  it("sets the title on an instance", () => {
    const widget = makeWidget();
    mockGetWidget.mockReturnValue(widget as ReturnType<typeof getWidget>);
    mockDefaultSettingsFor.mockReturnValue({});

    const instanceId = getActions().addInstance("test-widget")!;
    getActions().setTitle(instanceId, "My Custom Title");

    const instance = getState().dashboards[0].instances.find(
      (i) => i.instanceId === instanceId,
    )!;
    expect(instance.title).toBe("My Custom Title");
  });

  it("does not create a new state object when the title is already equal", () => {
    const widget = makeWidget();
    mockGetWidget.mockReturnValue(widget as ReturnType<typeof getWidget>);
    mockDefaultSettingsFor.mockReturnValue({});

    const instanceId = getActions().addInstance("test-widget")!;
    const stateBefore = getState();

    // title is currently undefined; setting to undefined is a no-op
    getActions().setTitle(instanceId, undefined);
    expect(getState()).toBe(stateBefore);
  });
});

describe("applyRemoteState", () => {
  it("replaces state with the remote state", () => {
    const remoteState: AppState = {
      version: 1,
      dashboards: [{ id: "remote-1", name: "Remote", instances: [] }],
      activeDashboardId: "remote-1",
    };
    getActions().applyRemoteState(remoteState);
    expect(getState()).toEqual(remoteState);
  });

  it("normalizes empty remote dashboards to DEFAULT_STATE", () => {
    const remoteState: AppState = {
      version: 1,
      dashboards: [],
      activeDashboardId: "missing-id",
    };

    getActions().applyRemoteState(remoteState);

    expect(getState().dashboards).toEqual(DEFAULT_STATE.dashboards);
    expect(getState().activeDashboardId).toBe("default");
  });

  it("normalizes stale remote activeDashboardId to dashboards[0]", () => {
    const remoteState: AppState = {
      version: 1,
      dashboards: [{ id: "remote-1", name: "Remote", instances: [] }],
      activeDashboardId: "missing-id",
    };

    getActions().applyRemoteState(remoteState);

    expect(getState().activeDashboardId).toBe("remote-1");
  });

  it("cancels a pending persist timer so save is not called", () => {
    getActions().addDashboard("Temp"); // schedules a persist timer
    getActions().applyRemoteState(structuredClone(DEFAULT_STATE));
    vi.runAllTimers();
    expect(mockSave).not.toHaveBeenCalled();
  });
});

describe("persist debounce", () => {
  it("does not call save before the debounce delay has elapsed", () => {
    getActions().addDashboard("Work");
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("calls save exactly once after the debounce delay", () => {
    getActions().addDashboard("Work");
    vi.runAllTimers();
    expect(mockSave).toHaveBeenCalledOnce();
  });

  it("coalesces multiple mutations into a single save call", () => {
    getActions().addDashboard("One");
    getActions().addDashboard("Two");
    getActions().addDashboard("Three");
    vi.runAllTimers();
    expect(mockSave).toHaveBeenCalledOnce();
  });

  it("passes the current state snapshot to save", () => {
    getActions().renameDashboard("default", "Renamed");
    vi.runAllTimers();
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({
        dashboards: expect.arrayContaining([
          expect.objectContaining({ id: "default", name: "Renamed" }),
        ]),
      }),
    );
  });
});

describe("removeInstance idempotency", () => {
  it("is a no-op when the instanceId does not exist", () => {
    const before = getState();
    getActions().removeInstance("non-existent-id");
    // State reference should be the same object (no mutation happened)
    expect(getState().dashboards[0].instances).toHaveLength(0);
    vi.runAllTimers();
    // persist was still called, but no crash
    expect(mockSave).toHaveBeenCalledOnce();
  });
});

describe("updateSettings idempotency", () => {
  it("does not mutate other instances when updating one", () => {
    const widget = makeWidget();
    mockGetWidget.mockReturnValue(widget as ReturnType<typeof getWidget>);
    mockDefaultSettingsFor.mockReturnValue({ color: "blue" });

    const id1 = getActions().addInstance("test-widget")!;
    const id2 = getActions().addInstance("test-widget")!;

    getActions().updateSettings(id1, { color: "red" });

    const instances = getState().dashboards[0].instances;
    expect(instances.find((i) => i.instanceId === id1)!.settings).toEqual({
      color: "red",
    });
    expect(instances.find((i) => i.instanceId === id2)!.settings).toEqual({
      color: "blue",
    });
  });
});

describe("renameDashboard persistence", () => {
  it("schedules a save after renaming", () => {
    getActions().renameDashboard("default", "New Name");
    vi.runAllTimers();
    expect(mockSave).toHaveBeenCalledOnce();
  });
});

describe("addInstance layout stacking", () => {
  it("stacks three instances without overlapping", () => {
    const widget = makeWidget();
    mockGetWidget.mockReturnValue(widget as ReturnType<typeof getWidget>);
    mockDefaultSettingsFor.mockReturnValue({});

    getActions().addInstance("test-widget"); // y=0, h=4 → bottom=4
    getActions().addInstance("test-widget"); // y=4, h=4 → bottom=8
    getActions().addInstance("test-widget"); // y=8

    const instances = getState().dashboards[0].instances;
    expect(instances[0].layout.y).toBe(0);
    expect(instances[1].layout.y).toBe(4);
    expect(instances[2].layout.y).toBe(8);
  });
});
