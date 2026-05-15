import type { CCApi } from '@shared/types';
import { GOOGLE_SERVICES } from '@shared/google';
import { stateApi } from './state';
import { kvApi } from './kv';
import { sqlApi, initSqlite } from './sql';
import { secretsApi } from './secrets';
import { netApi } from './net';
import { shellApi, dialogApi } from './stubs';
import {
  googleConnect,
  googleGetToken,
  googleDisconnect,
  googleIsConnected,
} from './google-oauth';
import { DriveSync } from './drive-sync';
import { MobileSyncManager } from './sync-manager';
import type { GoogleServiceId, GoogleConnectOptions } from '@shared/types';

let syncManager: MobileSyncManager | null = null;

export async function installMobileBridge(): Promise<void> {
  await initSqlite();

  const drive = new DriveSync();
  syncManager = new MobileSyncManager(drive);

  const googleApi: CCApi['google'] = {
    services: GOOGLE_SERVICES,
    connect(widgetId: string, options: GoogleConnectOptions) {
      return googleConnect(widgetId, options);
    },
    getToken(widgetId: string, service?: GoogleServiceId) {
      return googleGetToken(widgetId, service);
    },
    disconnect(widgetId: string, service?: GoogleServiceId) {
      return googleDisconnect(widgetId, service);
    },
    isConnected(widgetId: string, service?: GoogleServiceId) {
      return googleIsConnected(widgetId, service);
    },
  };

  const sm = syncManager;
  const driveSyncApi: CCApi['driveSync'] = {
    getStatus() { return Promise.resolve(sm.getStatus()); },
    enable() { sm.enable(); return Promise.resolve(); },
    disable() { sm.disable(); return Promise.resolve(); },
    forcePush() { return sm.forcePush(); },
    forcePull() { return sm.forcePull(); },
    onStatusChanged(cb) { return sm.onStatusChanged(cb); },
  };

  const api: CCApi = {
    state: stateApi,
    kv: kvApi,
    sql: sqlApi,
    shell: shellApi,
    dialog: dialogApi,
    net: netApi,
    secrets: secretsApi,
    google: googleApi,
    driveSync: driveSyncApi,
  };

  (window as unknown as Record<string, unknown>).cc = api;

  // Kick off Drive sync if already authenticated
  await sm.initialSync();
}
