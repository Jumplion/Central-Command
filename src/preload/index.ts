import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc';
import type { AppState, CCApi, DialogOpenPathOptions, GoogleConnectOptions, NetFetchInit, NetFetchResponse, SqlRunResult } from '../shared/types';

const api: CCApi = {
  state: {
    load: (): Promise<AppState> => ipcRenderer.invoke(IPC.STATE_LOAD),
    save: (state: AppState): Promise<void> => ipcRenderer.invoke(IPC.STATE_SAVE, state)
  },
  kv: {
    get: (widgetId, key) => ipcRenderer.invoke(IPC.KV_GET, widgetId, key),
    set: (widgetId, key, value) => ipcRenderer.invoke(IPC.KV_SET, widgetId, key, value),
    del: (widgetId, key) => ipcRenderer.invoke(IPC.KV_DEL, widgetId, key),
    keys: (widgetId) => ipcRenderer.invoke(IPC.KV_KEYS, widgetId)
  },
  sql: {
    run: (widgetId, sql, params = []): Promise<SqlRunResult> =>
      ipcRenderer.invoke(IPC.SQL_RUN, widgetId, sql, params),
    all: (widgetId, sql, params = []) => ipcRenderer.invoke(IPC.SQL_ALL, widgetId, sql, params),
    get: (widgetId, sql, params = []) => ipcRenderer.invoke(IPC.SQL_GET, widgetId, sql, params),
    exec: (widgetId, sql) => ipcRenderer.invoke(IPC.SQL_EXEC, widgetId, sql),
    runBatch: (widgetId, items) => ipcRenderer.invoke(IPC.SQL_RUN_BATCH, widgetId, items)
  },
  shell: {
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke(IPC.SHELL_OPEN_EXTERNAL, url),
    openPath: (path: string): Promise<string> => ipcRenderer.invoke(IPC.SHELL_OPEN_PATH, path),
    showItemInFolder: (path: string): Promise<void> => ipcRenderer.invoke(IPC.SHELL_SHOW_IN_FOLDER, path)
  },
  dialog: {
    openPath: (options?: DialogOpenPathOptions): Promise<string[] | null> =>
      ipcRenderer.invoke(IPC.DIALOG_OPEN_PATH, options)
  },
  net: {
    fetch: (url: string, init?: NetFetchInit): Promise<NetFetchResponse> =>
      ipcRenderer.invoke(IPC.NET_FETCH, url, init)
  },
  secrets: {
    get: (widgetId: string, key: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC.SECRETS_GET, widgetId, key),
    set: (widgetId: string, key: string, value: string): Promise<void> =>
      ipcRenderer.invoke(IPC.SECRETS_SET, widgetId, key, value),
    del: (widgetId: string, key: string): Promise<void> =>
      ipcRenderer.invoke(IPC.SECRETS_DEL, widgetId, key),
    has: (widgetId: string, key: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.SECRETS_HAS, widgetId, key)
  },
  google: {
    connect: (widgetId: string, options: GoogleConnectOptions): Promise<void> =>
      ipcRenderer.invoke(IPC.GOOGLE_CONNECT, widgetId, options),
    getToken: (widgetId: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC.GOOGLE_GET_TOKEN, widgetId),
    disconnect: (widgetId: string): Promise<void> =>
      ipcRenderer.invoke(IPC.GOOGLE_DISCONNECT, widgetId),
    isConnected: (widgetId: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.GOOGLE_IS_CONNECTED, widgetId)
  }
};

contextBridge.exposeInMainWorld('cc', api);
