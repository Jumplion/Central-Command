/** Widget/namespace id pattern shared by main and renderer. */
const VALID_WIDGET_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function isValidWidgetId(id: string): boolean {
  return VALID_WIDGET_ID.test(id);
}

export function assertValidWidgetId(id: string): void {
  if (!isValidWidgetId(id)) throw new Error(`Invalid widget id: ${id}`);
}
