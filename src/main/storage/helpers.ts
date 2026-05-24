import { promises as fs } from "node:fs";
import path from "node:path";
import { assertValidWidgetId } from "@shared/validation";

export function widgetDir(root: string, widgetId: string): string {
  assertValidWidgetId(widgetId);
  return path.join(root, "widgets", widgetId);
}

export function widgetFile(
  root: string,
  widgetId: string,
  fileName: string,
): string {
  return path.join(widgetDir(root, widgetId), fileName);
}

/** Module-level dedup map so concurrent callers for the same dir share one mkdir. */
const _dirInitPending = new Map<string, Promise<void>>();

export async function ensureWidgetDir(
  root: string,
  widgetId: string,
): Promise<void> {
  const dir = widgetDir(root, widgetId);
  const key = dir;
  let pending = _dirInitPending.get(key);
  if (!pending) {
    pending = fs
      .mkdir(dir, { recursive: true })
      .then(() => undefined)
      .finally(() => {
        _dirInitPending.delete(key);
      });
    _dirInitPending.set(key, pending);
  }
  await pending;
}

export async function atomicWrite(
  filePath: string,
  contents: string | Buffer,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, contents);
  await fs.rename(tmp, filePath);
}
