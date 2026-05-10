export type WidgetId = string;
export type InstanceId = string;
export type DashboardId = string;

export type SettingsField =
  | {
      kind: 'string';
      key: string;
      label: string;
      default?: string;
      placeholder?: string;
      multiline?: boolean;
    }
  | {
      kind: 'number';
      key: string;
      label: string;
      default?: number;
      min?: number;
      max?: number;
      step?: number;
    }
  | { kind: 'boolean'; key: string; label: string; default?: boolean }
  | {
      kind: 'select';
      key: string;
      label: string;
      default?: string;
      options: { value: string; label: string }[];
    };

export interface WidgetManifest {
  id: WidgetId;
  name: string;
  description?: string;
  version: string;
  author?: string;
  icon?: string;
  defaultSize: { w: number; h: number };
  minSize?: { w: number; h: number };
  settings?: SettingsField[];
  permissions?: { sqlite?: boolean };
}

export type WidgetSettings = Record<string, unknown>;

export interface WidgetInstance {
  instanceId: InstanceId;
  widgetId: WidgetId;
  layout: { x: number; y: number; w: number; h: number };
  settings: WidgetSettings;
  title?: string;
}

export interface Dashboard {
  id: DashboardId;
  name: string;
  instances: WidgetInstance[];
}

export interface AppState {
  version: number;
  dashboards: Dashboard[];
  activeDashboardId: DashboardId;
}

export interface SqlRunResult {
  changes: number;
  lastInsertRowid: number;
}

export interface CCApi {
  state: {
    load(): Promise<AppState>;
    save(state: AppState): Promise<void>;
  };
  kv: {
    get(widgetId: string, key: string): Promise<unknown>;
    set(widgetId: string, key: string, value: unknown): Promise<void>;
    del(widgetId: string, key: string): Promise<void>;
    keys(widgetId: string): Promise<string[]>;
  };
  sql: {
    run(widgetId: string, sql: string, params?: unknown[]): Promise<SqlRunResult>;
    all(widgetId: string, sql: string, params?: unknown[]): Promise<unknown[]>;
    get(widgetId: string, sql: string, params?: unknown[]): Promise<unknown>;
    exec(widgetId: string, sql: string): Promise<void>;
  };
}
