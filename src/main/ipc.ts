import { ipcMain, shell, dialog, net } from 'electron';
import { IPC } from '@shared/ipc';
import { openExternal } from './platform';
import type { AppState, DialogOpenPathOptions, GoogleConnectOptions, NetFetchInit } from '@shared/types';
import { isGoogleServiceId } from '@shared/google';
import type { GoogleServiceId } from '@shared/google';
import type { Storage } from './storage';
import type { SecretsStore } from './secrets';
import type { OAuthManager } from './oauth';
import type { SyncManager } from './sync';

const isString = (x: unknown): x is string => typeof x === 'string';
const isParams = (x: unknown): x is unknown[] => Array.isArray(x);
const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;

/** Assert that an optional `service` argument is a valid Google service id. */
function requireOptionalService(channel: string, service: unknown): void {
  if (service !== undefined && !isGoogleServiceId(service))
    throw new Error(`${channel}: invalid service`);
}

type ArgValidator = (value: unknown) => boolean;
type ArgDescriptor = ArgValidator | { validator: ArgValidator; optional: boolean };

function unwrapValidator(descriptor: ArgDescriptor): ArgValidator {
  return typeof descriptor === 'function' ? descriptor : descriptor.validator;
}

function withArgs<T extends unknown[]>(
  channel: string,
  validators: ArgDescriptor[],
  fn: (...args: T) => unknown
) {
  return (_e: unknown, ...args: unknown[]) => {
    for (let index = 0; index < validators.length; index += 1) {
      const descriptor = validators[index];
      const value = args[index];
      const validator = unwrapValidator(descriptor);
      if (value === undefined) {
        if (typeof descriptor !== 'function' && descriptor.optional) continue;
        throw new Error(`${channel}: invalid arguments`);
      }
      if (!validator(value)) throw new Error(`${channel}: invalid arguments`);
    }
    return fn(...(args as T));
  };
}

function registerHandler<T extends unknown[]>(
  channel: string,
  validators: ArgDescriptor[],
  fn: (...args: T) => unknown
) {
  ipcMain.handle(channel, withArgs(channel, validators, fn));
}

export function registerIpc(storage: Storage, secrets: SecretsStore, oauth: OAuthManager, syncManager: SyncManager): void {
  registerHandler(IPC.STATE_LOAD, [], () => storage.loadState());
  registerHandler(IPC.STATE_SAVE, [isObject], (state: AppState) => storage.saveState(state));

  // ─── KV handlers ─────────────────────────────────────────────────────────────
  registerHandler(IPC.KV_GET, [isString, isString], (widgetId: string, key: string) => storage.json.get(widgetId, key));
  registerHandler(IPC.KV_SET, [isString, isString], (widgetId: string, key: string, value: unknown) => storage.json.set(widgetId, key, value));
  registerHandler(IPC.KV_DEL, [isString, isString], (widgetId: string, key: string) => storage.json.del(widgetId, key));
  registerHandler(IPC.KV_KEYS, [isString], (widgetId: string) => storage.json.keys(widgetId));
  registerHandler(IPC.KV_KEYS_PREFIX, [isString, isString], (widgetId: string, prefix: string) =>
    storage.json.keysWithPrefix(widgetId, prefix)
  );

  // ─── SQL handlers ─────────────────────────────────────────────────────────────
  registerHandler(IPC.SQL_RUN, [isString, isString, isParams], (widgetId: string, sql: string, params: unknown[]) =>
    storage.sqlite.run(widgetId, sql, params)
  );
  registerHandler(IPC.SQL_ALL, [isString, isString, isParams], (widgetId: string, sql: string, params: unknown[]) =>
    storage.sqlite.all(widgetId, sql, params)
  );
  registerHandler(IPC.SQL_GET, [isString, isString, isParams], (widgetId: string, sql: string, params: unknown[]) =>
    storage.sqlite.get(widgetId, sql, params)
  );
  registerHandler(IPC.SQL_EXEC, [isString, isString], (widgetId: string, sql: string) => storage.sqlite.exec(widgetId, sql));
  registerHandler(IPC.SQL_RUN_BATCH, [isString, Array.isArray], (widgetId: string, items: { sql: string; params?: unknown[] }[]) =>
    storage.sqlite.runBatch(widgetId, items)
  );

  registerHandler(IPC.SHELL_OPEN_EXTERNAL, [isString], (url: string) => {
    if (!/^(https?|mailto):/.test(url)) throw new Error('openExternal: url must be http(s) or mailto');
    return openExternal(url);
  });

  registerHandler(IPC.SHELL_OPEN_PATH, [isString], (path: string) => shell.openPath(path));
  registerHandler(IPC.SHELL_SHOW_IN_FOLDER, [isString], (path: string) => shell.showItemInFolder(path));

  registerHandler(IPC.DIALOG_OPEN_PATH, [{ validator: () => true, optional: true }], async (options: unknown) => {
    const opts = isObject(options) ? (options as DialogOpenPathOptions) : {};
    const result = await dialog.showOpenDialog({
      title: opts.title,
      defaultPath: opts.defaultPath,
      properties: opts.properties,
    });
    return result.canceled ? null : result.filePaths;
  });

  registerHandler(IPC.NET_FETCH, [() => true, { validator: isObject, optional: true }], async (url: unknown, init: unknown) => {
    if (!isString(url) || !/^https?:\/\//.test(url)) throw new Error('net.fetch: url must be http(s)');
    const options: NetFetchInit = {};
    if (isObject(init)) {
      const i = init as Record<string, unknown>;
      if (typeof i.method === 'string') options.method = i.method;
      if (i.headers && typeof i.headers === 'object') options.headers = i.headers as Record<string, string>;
      if (typeof i.body === 'string') options.body = i.body;
    }
    const resp = await net.fetch(url, options);
    const body = await resp.text();
    return { ok: resp.ok, status: resp.status, body };
  });

  // ─── Secrets handlers ─────────────────────────────────────────────────────
  registerHandler(IPC.SECRETS_GET, [isString, isString], (widgetId: string, key: string) => secrets.get(widgetId, key));
  registerHandler(IPC.SECRETS_DEL, [isString, isString], (widgetId: string, key: string) => secrets.del(widgetId, key));
  registerHandler(IPC.SECRETS_HAS, [isString, isString], (widgetId: string, key: string) => secrets.has(widgetId, key));
  registerHandler(IPC.SECRETS_SET, [isString, isString, isString], (widgetId: string, key: string, value: string) =>
    secrets.set(widgetId, key, value)
  );

  // ─── Google OAuth handlers ─────────────────────────────────────────────────
  registerHandler(IPC.GOOGLE_CONNECT, [isString, isObject], (widgetId: string, options: unknown) => {
    if (!isObject(options)) throw new Error('google.connect: invalid arguments');
    const o = options as Record<string, unknown>;
    if (!isString(o.clientId) || !isString(o.clientSecret))
      throw new Error('google.connect: invalid options');
    if (o.scopes !== undefined && !Array.isArray(o.scopes)) throw new Error('google.connect: invalid scopes');
    requireOptionalService('google.connect', o.service);
    return oauth.connect(widgetId, options as unknown as GoogleConnectOptions);
  });

  const googleServiceHandler = (channel: string, fn: (widgetId: string, service?: GoogleServiceId) => unknown) =>
    registerHandler(channel, [isString, { validator: () => true, optional: true }], (widgetId: string, service?: unknown) => {
      requireOptionalService(channel, service);
      return fn(widgetId, service as GoogleServiceId | undefined);
    });

  googleServiceHandler(IPC.GOOGLE_GET_TOKEN,    (w, s) => oauth.getToken(w, s));
  googleServiceHandler(IPC.GOOGLE_DISCONNECT,   (w, s) => oauth.disconnect(w, s));
  googleServiceHandler(IPC.GOOGLE_IS_CONNECTED, (w, s) => oauth.isConnected(w, s));

  // ─── Drive Sync handlers ───────────────────────────────────────────────────
  registerHandler(IPC.DRIVE_SYNC_GET_STATUS, [], () => syncManager.getStatus());
  registerHandler(IPC.DRIVE_SYNC_ENABLE, [], () => syncManager.enable());
  registerHandler(IPC.DRIVE_SYNC_DISABLE, [], () => syncManager.disable());
  registerHandler(IPC.DRIVE_SYNC_FORCE_PUSH, [], () => syncManager.forcePush());
  registerHandler(IPC.DRIVE_SYNC_FORCE_PULL, [], () => syncManager.forcePull());
}
