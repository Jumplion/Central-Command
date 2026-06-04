import type {
  DialogOpenPathOptions,
  GoogleConnectOptions,
  InstanceId,
  NetFetchInit,
  NetFetchResponse,
  SqlRunResult,
  WidgetId,
} from "@shared/types";
import type { GoogleServiceDefinition, GoogleServiceId } from "@shared/google";
import {
  getGoogleCredsKey,
  SHARED_GOOGLE_WIDGET_ID,
  getGoogleReconnectOptions,
} from "@shared/google";
import { emitApiCall } from "./apiEvents";

export interface WidgetApi {
  widgetId: WidgetId;
  instanceId: InstanceId;
  /**
   * Per-instance JSON key/value store. Keys are scoped to this widget instance,
   * so two instances of the same widget will not collide.
   */
  kv: {
    get<T = unknown>(key: string): Promise<T | undefined>;
    set(key: string, value: unknown): Promise<void>;
    del(key: string): Promise<void>;
    keys(): Promise<string[]>;
  };
  /**
   * Per-widget SQLite database. Tables are shared across all instances of the
   * same widget. Use parameterized queries; never interpolate untrusted values.
   */
  sql: {
    run(sql: string, params?: unknown[]): Promise<SqlRunResult>;
    all<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
    get<T = unknown>(sql: string, params?: unknown[]): Promise<T | undefined>;
    exec(sql: string): Promise<void>;
    runBatch(
      items: { sql: string; params?: unknown[] }[],
    ): Promise<SqlRunResult[]>;
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
  /**
   * Per-widget encrypted secret store. Keys are scoped to this widget type
   * and persisted using Electron safeStorage (OS keychain where available).
   */
  secrets: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    del(key: string): Promise<void>;
    has(key: string): Promise<boolean>;
  };
  clipboard: {
    read(): Promise<string>;
  };
  /**
   * Google OAuth helper. Call `connect` once to run the PKCE loopback flow;
   * `getToken` returns a fresh access token (auto-refreshes when expired).
   * Credentials and tokens are stored in the widget's secrets vault.
   * Requires `permissions: { google: true }` in the widget manifest.
   */
  google: {
    services: Record<GoogleServiceId, GoogleServiceDefinition>;
    connect(options: GoogleConnectOptions): Promise<void>;
    getToken(service?: GoogleServiceId): Promise<string | null>;
    disconnect(service?: GoogleServiceId): Promise<void>;
    isConnected(service?: GoogleServiceId): Promise<boolean>;
    /**
     * Shared (app-wide) Google OAuth. All widgets that use `shared.*` store
     * credentials and tokens under a single `'google'` namespace so the user
     * only needs to authenticate once regardless of how many widgets require
     * Google access.
     */
    shared: {
      /** Run PKCE OAuth flow and store credentials + tokens in the shared namespace. */
      connect(options: {
        clientId: string;
        clientSecret: string;
        service?: GoogleServiceId;
      }): Promise<void>;
      /** Return a valid access token, auto-refreshing if expired. Returns null if not authenticated. */
      getToken(service?: GoogleServiceId): Promise<string | null>;
      isConnected(service?: GoogleServiceId): Promise<boolean>;
      disconnect(service?: GoogleServiceId): Promise<void>;
      /** True if OAuth credentials have ever been stored (even if tokens are now expired). */
      hasCreds(service?: GoogleServiceId): Promise<boolean>;
      /**
       * Re-run the OAuth flow using previously-stored credentials (no credential
       * re-entry required). Returns false if no credentials are stored yet.
       */
      reconnect(service?: GoogleServiceId): Promise<boolean>;
    };
  };
}

const SCOPE_SEP = "::";

// Renderer-side cache for the shared Google access token.
// The main process refreshes tokens before they expire; this cache avoids
// redundant IPC round-trips within a single refresh window.
const _sharedTokenCache = new Map<
  string,
  { token: string; expiresAt: number }
>();
const SHARED_TOKEN_TTL_MS = 5 * 60_000; // 5 minutes — well within Google's 1-hour token lifetime

function _sharedTokenKey(service?: string): string {
  return service ?? "__default__";
}

function scoped(instanceId: InstanceId, key: string): string {
  return `${instanceId}${SCOPE_SEP}${key}`;
}

export function createKvApi(
  widgetId: WidgetId,
  instanceId: InstanceId,
): WidgetApi["kv"] {
  return {
    get: <T>(key: string) =>
      window.cc.kv.get(widgetId, scoped(instanceId, key)) as Promise<
        T | undefined
      >,
    set: (key, value) =>
      window.cc.kv.set(widgetId, scoped(instanceId, key), value),
    del: (key) => window.cc.kv.del(widgetId, scoped(instanceId, key)),
    keys: async () => {
      const prefix = instanceId + SCOPE_SEP;
      const prefixed = await window.cc.kv.keysWithPrefix(widgetId, prefix);
      return prefixed.map((k) => k.slice(prefix.length));
    },
  };
}

export function createSqlApi(widgetId: WidgetId): WidgetApi["sql"] {
  return {
    run: (sql, params = []) => window.cc.sql.run(widgetId, sql, params),
    all: <T>(sql: string, params: unknown[] = []) =>
      window.cc.sql.all(widgetId, sql, params) as Promise<T[]>,
    get: <T>(sql: string, params: unknown[] = []) =>
      window.cc.sql.get(widgetId, sql, params) as Promise<T | undefined>,
    exec: (sql) => window.cc.sql.exec(widgetId, sql),
    runBatch: (items) => window.cc.sql.runBatch(widgetId, items),
  };
}

export function createGoogleApi(widgetId: WidgetId): WidgetApi["google"] {
  return {
    services: window.cc.google.services,
    connect: (options) => window.cc.google.connect(widgetId, options),
    getToken: (service) => window.cc.google.getToken(widgetId, service),
    disconnect: (service) => window.cc.google.disconnect(widgetId, service),
    isConnected: (service) => window.cc.google.isConnected(widgetId, service),
    shared: {
      connect: (options) =>
        window.cc.google.connect(SHARED_GOOGLE_WIDGET_ID, options),
      getToken: async (service) => {
        const key = _sharedTokenKey(service);
        const cached = _sharedTokenCache.get(key);
        if (cached && Date.now() < cached.expiresAt) return cached.token;
        const token = await window.cc.google.getToken(
          SHARED_GOOGLE_WIDGET_ID,
          service,
        );
        if (token) {
          _sharedTokenCache.set(key, {
            token,
            expiresAt: Date.now() + SHARED_TOKEN_TTL_MS,
          });
        }
        return token;
      },
      isConnected: (service) =>
        window.cc.google.isConnected(SHARED_GOOGLE_WIDGET_ID, service),
      disconnect: (service) => {
        _sharedTokenCache.delete(_sharedTokenKey(service));
        return window.cc.google.disconnect(SHARED_GOOGLE_WIDGET_ID, service);
      },
      hasCreds: (service) =>
        window.cc.secrets.has(
          SHARED_GOOGLE_WIDGET_ID,
          getGoogleCredsKey(service),
        ),
      reconnect: async (service) => {
        const credsRaw = await window.cc.secrets.get(
          SHARED_GOOGLE_WIDGET_ID,
          getGoogleCredsKey(service),
        );
        const options = getGoogleReconnectOptions(credsRaw, service);
        if (!options) return false;
        await window.cc.google.connect(SHARED_GOOGLE_WIDGET_ID, options);
        return true;
      },
    },
  };
}

export function createWidgetApi(
  widgetId: WidgetId,
  instanceId: InstanceId,
): WidgetApi {
  return {
    widgetId,
    instanceId,
    kv: createKvApi(widgetId, instanceId),
    sql: createSqlApi(widgetId),
    shell: window.cc.shell,
    dialog: window.cc.dialog,
    net: {
      fetch: async (url, init) => {
        const t0 = Date.now();
        const res = await window.cc.net.fetch(url, init);
        emitApiCall({
          widgetId,
          url,
          method: init?.method ?? "GET",
          timestamp: t0,
          status: res.status,
          duration: Date.now() - t0,
          ok: res.ok,
        });
        return res;
      },
    },
    secrets: {
      get: (key) => window.cc.secrets.get(widgetId, key),
      set: (key, value) => window.cc.secrets.set(widgetId, key, value),
      del: (key) => window.cc.secrets.del(widgetId, key),
      has: (key) => window.cc.secrets.has(widgetId, key),
    },
    google: createGoogleApi(widgetId),
    clipboard: {
      read: () => window.cc.clipboard.read(),
    },
  };
}
