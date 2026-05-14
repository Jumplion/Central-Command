import { Browser } from '@capacitor/browser';
import type { CapturedAudition, CapturedJob, DialogOpenPathOptions } from '@shared/types';

export const shellApi = {
  async openExternal(url: string): Promise<void> {
    await Browser.open({ url });
  },
  async openPath(_path: string): Promise<string> {
    console.warn('[mobile] shell.openPath: not supported on Android');
    return '';
  },
  async showItemInFolder(_path: string): Promise<void> {
    console.warn('[mobile] shell.showItemInFolder: not supported on Android');
  },
};

export const dialogApi = {
  async openPath(_options?: DialogOpenPathOptions): Promise<string[] | null> {
    console.warn('[mobile] dialog.openPath: not supported on Android');
    return null;
  },
};

export const jobCaptureStub = {
  status: async () => ({ running: false, port: 0, token: '' }),
  regenerateToken: async () => '',
  onJobAdded: (_cb: (job: CapturedJob) => void) => () => {},
  onAuditionAdded: (_cb: (audition: CapturedAudition) => void) => () => {},
};
