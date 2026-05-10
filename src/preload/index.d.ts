import type { CCApi } from '../shared/types';

declare global {
  interface Window {
    cc: CCApi;
  }
}

export {};
