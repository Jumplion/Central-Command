import type { WidgetManifest } from '@shared/types';
import { isValidWidgetId } from '@shared/validation';

type WidgetModule = unknown;

export function getWidgetRegistrationError(
  widgetModule: WidgetModule,
  usedIds: Set<string>,
  currentPlatform: 'desktop'
): string | undefined {
  const candidate = widgetModule as {
    default?: { manifest?: Partial<WidgetManifest>; Component?: unknown };
  };
  const widget = candidate?.default;

  if (!widget?.manifest || !widget.Component) {
    return 'export is not a valid widget';
  }

  const { manifest } = widget;
  if (typeof manifest.id !== 'string') {
    return 'manifest.id must be a string';
  }

  if (!isValidWidgetId(manifest.id)) {
    return `invalid widget id "${manifest.id}"`;
  }

  if (manifest.platforms && Array.isArray(manifest.platforms) && !manifest.platforms.includes(currentPlatform)) {
    return 'unsupported platform';
  }

  if (usedIds.has(manifest.id)) {
    return `duplicate widget id "${manifest.id}"`;
  }

  return undefined;
}
