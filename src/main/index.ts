import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { Storage } from './storage';
import { SecretsStore } from './secrets';
import { OAuthManager } from './oauth';
import { DriveSync } from './storage/drive';
import { SyncManager } from './sync';
import { registerIpc } from './ipc';

let storage: Storage | null = null;
let syncManager: SyncManager | null = null;
let isQuitting = false;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    backgroundColor: '#0e0f12',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return win;
}

app.whenReady().then(() => {
  const userData = app.getPath('userData');
  storage = new Storage();
  const secrets = new SecretsStore(userData);
  const oauth = new OAuthManager(secrets);
  const drive = new DriveSync(oauth);
  const win = createWindow();
  syncManager = new SyncManager(drive, storage, () => BrowserWindow.getAllWindows()[0] ?? null);
  registerIpc(storage, secrets, oauth, syncManager);
  win.webContents.once('did-finish-load', () => {
    void syncManager!.initialSync().catch((err) => {
      console.error('[sync] initialSync failed:', (err as Error).message);
    });
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async (event) => {
  if (isQuitting || !storage) return;
  event.preventDefault();
  syncManager?.dispose();
  syncManager = null;
  try {
    await storage.dispose();
  } finally {
    storage = null;
    isQuitting = true;
    app.quit();
  }
});
