import { promises as fs } from 'node:fs';
import path from 'node:path';
import { assertValidWidgetId } from '@shared/validation';

export function widgetDir(root: string, widgetId: string): string {
  assertValidWidgetId(widgetId);
  return path.join(root, 'widgets', widgetId);
}

export function widgetFile(root: string, widgetId: string, fileName: string): string {
  return path.join(widgetDir(root, widgetId), fileName);
}

export async function ensureWidgetDir(root: string, widgetId: string): Promise<void> {
  await fs.mkdir(widgetDir(root, widgetId), { recursive: true });
}

export async function atomicWrite(filePath: string, contents: string): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, contents, 'utf-8');
  await fs.rename(tmp, filePath);
}
