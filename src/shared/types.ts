import type { GoogleConnectOptions, GoogleServiceDefinition, GoogleServiceId } from './google';
export type { GoogleConnectOptions, GoogleServiceDefinition, GoogleServiceId } from './google';

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
  permissions?: { sqlite?: boolean; google?: boolean };
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

export interface DialogOpenPathOptions {
  title?: string;
  defaultPath?: string;
  properties?: ('openFile' | 'openDirectory' | 'multiSelections')[];
}

export interface NetFetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface NetFetchResponse {
  ok: boolean;
  status: number;
  body: string;
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
    runBatch(widgetId: string, items: { sql: string; params?: unknown[] }[]): Promise<SqlRunResult[]>;
  };
  shell: {
    openExternal(url: string): Promise<void>;
    openPath(path: string): Promise<string>;
    showItemInFolder(path: string): Promise<void>;
  };
  dialog: {
    openPath(options?: DialogOpenPathOptions): Promise<string[] | null>;
  };
  net: {
    fetch(url: string, init?: NetFetchInit): Promise<NetFetchResponse>;
  };
  secrets: {
    get(widgetId: string, key: string): Promise<string | null>;
    set(widgetId: string, key: string, value: string): Promise<void>;
    del(widgetId: string, key: string): Promise<void>;
    has(widgetId: string, key: string): Promise<boolean>;
  };
  google: {
    services: Record<GoogleServiceId, GoogleServiceDefinition>;
    connect(widgetId: string, options: GoogleConnectOptions): Promise<void>;
    getToken(widgetId: string, service?: GoogleServiceId): Promise<string | null>;
    disconnect(widgetId: string, service?: GoogleServiceId): Promise<void>;
    isConnected(widgetId: string, service?: GoogleServiceId): Promise<boolean>;
  };
}
