import { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import type { Widget } from "@renderer/plugins/registry";
import { vi, describe, expect, it, beforeEach, afterEach } from "vitest";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

type DashboardState = {
  state: {
    dashboards: Array<{ id: string; name: string }>;
    activeDashboardId: string;
  };
  addInstance: (widgetId: string) => string | null;
  removeInstance: (instanceId: string) => void;
  setTitle: (instanceId: string, title: string | undefined) => void;
  updateSettings: (
    instanceId: string,
    settings: Record<string, unknown>,
  ) => void;
  setActiveDashboard: (id: string) => void;
  addDashboard: (name: string) => void;
  renameDashboard: (id: string, name: string) => void;
  removeDashboard: (id: string) => void;
  updateLayout: (
    layout: Array<{
      instanceId: string;
      x: number;
      y: number;
      w: number;
      h: number;
    }>,
  ) => void;
};

const dashboardState: DashboardState = {
  state: {
    dashboards: [{ id: "dash-1", name: "Home" }],
    activeDashboardId: "dash-1",
  },
  addInstance: vi.fn(() => "instance-1"),
  removeInstance: vi.fn(),
  setTitle: vi.fn(),
  updateSettings: vi.fn(),
  setActiveDashboard: vi.fn(),
  addDashboard: vi.fn(),
  renameDashboard: vi.fn(),
  removeDashboard: vi.fn(),
  updateLayout: vi.fn(),
};

let widgets: Widget[] = [
  {
    manifest: {
      id: "widget-a",
      name: "Widget A",
      version: "1.0.0",
      description: "First widget",
      icon: "A",
      defaultSize: { w: 3, h: 2 },
    },
    Component: () => <div>Widget A body</div>,
  },
  {
    manifest: {
      id: "widget-b",
      name: "Widget B",
      version: "1.2.0",
      description: "Second widget",
      icon: "B",
      defaultSize: { w: 3, h: 2 },
      settings: [
        {
          kind: "string",
          key: "note",
          label: "Note",
          placeholder: "Enter note",
        },
      ],
    },
    Component: () => <div>Widget B body</div>,
  },
];

vi.mock("@renderer/state/dashboard", () => ({
  useDashboard: (selector: (state: DashboardState) => unknown) =>
    selector(dashboardState),
}));

vi.mock("@renderer/plugins/registry", () => ({
  listWidgets: () => widgets,
  getWidget: (id: string) => widgets.find((w) => w.manifest.id === id),
}));

vi.mock("@renderer/plugins/api", () => ({
  createWidgetApi: vi.fn((widgetId: string, instanceId: string) => ({
    widgetId,
    instanceId,
    kv: { get: vi.fn(), set: vi.fn(), del: vi.fn(), keys: vi.fn() },
    sql: {
      run: vi.fn(),
      all: vi.fn(),
      get: vi.fn(),
      exec: vi.fn(),
      runBatch: vi.fn(),
    },
    shell: {
      openExternal: vi.fn(),
      openPath: vi.fn(),
      showItemInFolder: vi.fn(),
    },
    dialog: { openPath: vi.fn() },
    net: { fetch: vi.fn() },
    secrets: { get: vi.fn(), set: vi.fn(), del: vi.fn(), has: vi.fn() },
    google: {
      services: {},
      connect: vi.fn(),
      getToken: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn(),
      shared: {
        connect: vi.fn(),
        getToken: vi.fn(),
        isConnected: vi.fn(),
        disconnect: vi.fn(),
        hasCreds: vi.fn(),
        reconnect: vi.fn(),
      },
    },
  })),
}));

import { AddWidgetDialog } from "./AddWidgetDialog";
import { AppSettings } from "./AppSettings";
import { WidgetHost } from "./WidgetHost";
import { WidgetSettingsPanel } from "./WidgetSettingsPanel";
import { Sidebar } from "./Sidebar";

const createContainer = () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  return container;
};

const cleanupContainer = (container: HTMLElement) => {
  if (container.parentNode) {
    container.parentNode.removeChild(container);
  }
};

const flushEvents = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const dispatchValueEvent = async (
  element: HTMLElement,
  value: string | boolean,
) => {
  await act(async () => {
    Simulate.change(element as Element, { target: { value } } as any);
  });
  await flushEvents();
};

const dispatchCheckedEvent = async (element: HTMLElement, checked: boolean) => {
  await act(async () => {
    Simulate.change(element as Element, { target: { checked } } as any);
  });
  await flushEvents();
};

const clickElement = async (element: Element | null | undefined) => {
  await act(async () => {
    element?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  widgets = [
    {
      manifest: {
        id: "widget-a",
        name: "Widget A",
        version: "1.0.0",
        description: "First widget",
        icon: "A",
        defaultSize: { w: 3, h: 2 },
      },
      Component: () => <div>Widget A body</div>,
    },
    {
      manifest: {
        id: "widget-b",
        name: "Widget B",
        version: "1.2.0",
        description: "Second widget",
        icon: "B",
        defaultSize: { w: 3, h: 2 },
        settings: [
          {
            kind: "string",
            key: "note",
            label: "Note",
            placeholder: "Enter note",
          },
        ],
      },
      Component: () => <div>Widget B body</div>,
    },
  ];
  dashboardState.state.dashboards = [{ id: "dash-1", name: "Home" }];
  dashboardState.state.activeDashboardId = "dash-1";
  dashboardState.addInstance = vi.fn(() => "instance-1");
  dashboardState.removeInstance = vi.fn();
  dashboardState.setTitle = vi.fn();
  dashboardState.updateSettings = vi.fn();
  dashboardState.setActiveDashboard = vi.fn();
  dashboardState.addDashboard = vi.fn();
  dashboardState.renameDashboard = vi.fn();
  dashboardState.removeDashboard = vi.fn();
  dashboardState.updateLayout = vi.fn();

  (window as any).cc = {
    driveSync: {
      getStatus: vi.fn(async () => ({
        enabled: false,
        state: "disabled",
        lastSyncedAt: null,
        lastError: null,
      })),
      onStatusChanged: vi.fn(() => () => {}),
      enable: vi.fn(async () => undefined),
      disable: vi.fn(async () => undefined),
      forcePush: vi.fn(async () => undefined),
      forcePull: vi.fn(async () => undefined),
    },
    google: {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      isConnected: vi.fn(async () => false),
    },
    secrets: {
      has: vi.fn(async () => false),
    },
  };

  (globalThis as any).ResizeObserver = class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  };
});

afterEach(() => {
  delete (globalThis as any).ResizeObserver;
});

describe("AddWidgetDialog", () => {
  it("renders widget list, filters results, and adds a widget", async () => {
    const onClose = vi.fn();
    const container = createContainer();
    const root = createRoot(container);

    await act(async () => {
      root.render(<AddWidgetDialog onClose={onClose} />);
    });

    expect(container.querySelectorAll(".widget-list li").length).toBe(2);

    const input = container.querySelector<HTMLInputElement>("input.search");
    expect(input).toBeTruthy();

    await dispatchValueEvent(input!, "B");

    expect(container.querySelectorAll(".widget-list li").length).toBe(1);
    expect(container.textContent).toContain("Widget B");

    const addButton =
      container.querySelector<HTMLButtonElement>("button.primary");
    await clickElement(addButton);

    expect(dashboardState.addInstance).toHaveBeenCalledWith("widget-b");
    expect(onClose).toHaveBeenCalledOnce();
    cleanupContainer(container);
  });

  it("shows empty state when no widgets are installed", async () => {
    widgets = [];
    const onClose = vi.fn();
    const container = createContainer();
    const root = createRoot(container);

    await act(async () => {
      root.render(<AddWidgetDialog onClose={onClose} />);
    });

    expect(container.textContent).toContain("No widgets installed.");
    cleanupContainer(container);
  });

  it("shows a message when no widgets match the search term", async () => {
    const onClose = vi.fn();
    const container = createContainer();
    const root = createRoot(container);

    await act(async () => {
      root.render(<AddWidgetDialog onClose={onClose} />);
    });

    const input = container.querySelector<HTMLInputElement>("input.search");
    await dispatchValueEvent(input!, "missing");

    expect(container.textContent).toContain('No widgets match "missing".');
    cleanupContainer(container);
  });
});

describe("AppSettings", () => {
  it("renders disconnected state and disables connect button when inputs are empty", async () => {
    const container = createContainer();
    const root = createRoot(container);

    await act(async () => {
      root.render(<AppSettings onClose={vi.fn()} />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Google Drive Sync");
    const button = container.querySelector<HTMLButtonElement>("button.primary");
    expect(button?.disabled).toBe(true);
    cleanupContainer(container);
  });

  it("connects and enables drive sync with valid credentials", async () => {
    const container = createContainer();
    const root = createRoot(container);

    await act(async () => {
      root.render(<AppSettings onClose={vi.fn()} />);
    });

    // Both Google Account and Drive Sync sections share the same input placeholders;
    // scope selectors to the Drive Sync section to avoid targeting the wrong form.
    const sections = Array.from(container.querySelectorAll("section"));
    const driveSection = sections.find((s) =>
      s.textContent?.includes("Google Drive Sync"),
    )!;
    const clientIdInput = driveSection.querySelector<HTMLInputElement>(
      'input[placeholder="your-client-id.apps.googleusercontent.com"]',
    );
    const clientSecretInput = driveSection.querySelector<HTMLInputElement>(
      'input[placeholder="Client secret"]',
    );
    const connectButton =
      driveSection.querySelector<HTMLButtonElement>("button.primary");

    await dispatchValueEvent(clientIdInput!, "id.apps.googleusercontent.com");
    await dispatchValueEvent(clientSecretInput!, "secret");

    await act(async () => {
      connectButton!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(window.cc.google.connect).toHaveBeenCalled();
    expect(window.cc.driveSync.enable).toHaveBeenCalled();
    cleanupContainer(container);
  });

  it("shows connected status and allows disconnect", async () => {
    (window as any).cc.driveSync.getStatus = vi.fn(async () => ({
      enabled: true,
      state: "idle",
      lastSyncedAt: Date.now(),
      lastError: null,
    }));

    const container = createContainer();
    const root = createRoot(container);

    await act(async () => {
      root.render(<AppSettings onClose={vi.fn()} />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Connected");

    const disconnect = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Disconnect"),
    );

    await clickElement(disconnect);

    expect(window.cc.driveSync.disable).toHaveBeenCalled();
    expect(window.cc.google.disconnect).toHaveBeenCalled();
    cleanupContainer(container);
  });
});

describe("WidgetHost", () => {
  it("renders missing widget UI and removes the instance", async () => {
    const container = createContainer();
    const root = createRoot(container);
    const instance = {
      instanceId: "missing-1",
      widgetId: "missing-widget",
      title: undefined,
      settings: {},
      layout: { x: 0, y: 0, w: 2, h: 2 },
    };

    await act(async () => {
      root.render(<WidgetHost instance={instance} widget={undefined} />);
    });

    expect(container.textContent).toContain("Missing widget: missing-widget");
    const removeButton = container.querySelector('button[aria-label="Remove"]');
    await clickElement(removeButton);

    expect(dashboardState.removeInstance).toHaveBeenCalledWith("missing-1");
    cleanupContainer(container);
  });

  it("renders widget body and toggles settings panel when manifest has settings", async () => {
    const testWidget: Widget = {
      manifest: {
        id: "widget-c",
        name: "Widget C",
        version: "1.0.0",
        icon: "C",
        defaultSize: { w: 3, h: 2 },
        settings: [{ kind: "boolean", key: "active", label: "Active" }],
      },
      Component: () => <div>Widget C body</div>,
    };
    const container = createContainer();
    const root = createRoot(container);
    const instance = {
      instanceId: "inst-c",
      widgetId: "widget-c",
      title: undefined,
      settings: { active: true },
      layout: { x: 0, y: 0, w: 2, h: 2 },
    };

    await act(async () => {
      root.render(<WidgetHost instance={instance} widget={testWidget} />);
    });

    expect(container.textContent).toContain("Widget C body");
    const settingsButton = container.querySelector(
      'button[aria-label="Settings"]',
    );
    await clickElement(settingsButton);

    expect(container.querySelector(".settings-panel")).toBeTruthy();
    cleanupContainer(container);
  });

  it("displays widget error UI when child component throws", async () => {
    const crashingWidget: Widget = {
      manifest: {
        id: "widget-crash",
        name: "Crash widget",
        version: "1.0.0",
        icon: "X",
        defaultSize: { w: 3, h: 2 },
      },
      Component: () => {
        throw new Error("boom");
      },
    };
    const container = createContainer();
    const root = createRoot(container);
    const instance = {
      instanceId: "inst-crash",
      widgetId: "widget-crash",
      title: undefined,
      settings: {},
      layout: { x: 0, y: 0, w: 2, h: 2 },
    };

    await act(async () => {
      root.render(<WidgetHost instance={instance} widget={crashingWidget} />);
    });

    expect(container.textContent).toContain("Widget crashed.");
    expect(container.textContent).toContain("boom");
    cleanupContainer(container);
  });
});

describe("WidgetSettingsPanel", () => {
  it("renders each field type and saves updated settings and title override", async () => {
    const widget = {
      manifest: {
        id: "widget-settings",
        name: "Settings Widget",
        version: "1.0.0",
        icon: "S",
        settings: [
          {
            kind: "string",
            key: "text",
            label: "Text",
            placeholder: "Enter text",
          },
          {
            kind: "number",
            key: "count",
            label: "Count",
            min: 0,
            max: 10,
            step: 1,
          },
          { kind: "boolean", key: "enabled", label: "Enabled" },
          {
            kind: "select",
            key: "mode",
            label: "Mode",
            options: [
              { value: "one", label: "One" },
              { value: "two", label: "Two" },
            ],
          },
        ],
      },
      Component: () => null,
    };

    const instance = {
      instanceId: "inst-settings",
      widgetId: "widget-settings",
      title: "Existing title",
      settings: { text: "hello", count: 3, enabled: false, mode: "one" },
      layout: { x: 0, y: 0, w: 2, h: 2 },
    };
    const onClose = vi.fn();
    const container = createContainer();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <WidgetSettingsPanel
          widget={widget as any}
          instance={instance as any}
          onClose={onClose}
        />,
      );
    });

    const titleInput = container.querySelector<HTMLInputElement>(
      'input[placeholder="Settings Widget"]',
    );
    const textInput = container.querySelector<HTMLInputElement>(
      'input[placeholder="Enter text"]',
    );
    const numberInput = container.querySelector<HTMLInputElement>(
      'input[type="number"]',
    );
    const checkbox = container.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    const select = container.querySelector<HTMLSelectElement>("select");
    const saveButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Save",
    );

    await dispatchValueEvent(titleInput!, "New title");
    await dispatchValueEvent(textInput!, "world");
    await dispatchValueEvent(numberInput!, "5");
    await dispatchCheckedEvent(checkbox!, true);
    await dispatchValueEvent(select!, "two");

    await clickElement(saveButton as Element | null | undefined);

    expect(dashboardState.updateSettings).toHaveBeenCalledWith(
      "inst-settings",
      {
        text: "world",
        count: 5,
        enabled: true,
        mode: "two",
      },
    );
    expect(dashboardState.setTitle).toHaveBeenCalledWith(
      "inst-settings",
      "New title",
    );
    expect(onClose).toHaveBeenCalledOnce();
    cleanupContainer(container);
  });
});

describe("Sidebar", () => {
  it("renders dashboard tabs and opens add widget and settings dialogs", async () => {
    const container = createContainer();
    const root = createRoot(container);

    await act(async () => {
      root.render(<Sidebar />);
    });

    const addWidgetButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent === "+ Add widget");
    expect(addWidgetButton).toBeTruthy();

    await act(async () => {
      addWidgetButton?.click();
    });

    expect(container.querySelector(".modal")).toBeTruthy();

    const settingsButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent === "Settings");
    await act(async () => {
      settingsButton?.click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Google Drive Sync");
    cleanupContainer(container);
  });

  it("calls setActiveDashboard and addDashboard from dashboard buttons", async () => {
    dashboardState.state.dashboards = [
      { id: "dash-1", name: "Home" },
      { id: "dash-2", name: "Work" },
    ];
    dashboardState.state.activeDashboardId = "dash-1";

    const container = createContainer();
    const root = createRoot(container);

    await act(async () => {
      root.render(<Sidebar />);
    });

    const workButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Work",
    );
    await act(async () => {
      workButton?.click();
    });

    expect(dashboardState.setActiveDashboard).toHaveBeenCalledWith("dash-2");

    const newDashboardButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.title === "New dashboard");
    await act(async () => {
      newDashboardButton?.click();
    });

    expect(dashboardState.addDashboard).toHaveBeenCalledWith("New dashboard");
    cleanupContainer(container);
  });

  it("confirms and removes the active dashboard", async () => {
    dashboardState.state.dashboards = [
      { id: "dash-1", name: "Home" },
      { id: "dash-2", name: "Work" },
    ];
    dashboardState.state.activeDashboardId = "dash-2";
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    const container = createContainer();
    const root = createRoot(container);

    await act(async () => {
      root.render(<Sidebar />);
    });

    const deleteButtons = Array.from(
      container.querySelectorAll("button"),
    ).filter((button) => button.ariaLabel === "Delete dashboard");
    expect(deleteButtons.length).toBe(1);

    await act(async () => {
      deleteButtons[0].click();
    });

    expect(confirmSpy).toHaveBeenCalled();
    expect(dashboardState.removeDashboard).toHaveBeenCalledWith("dash-2");
    confirmSpy.mockRestore();
    cleanupContainer(container);
  });
});
