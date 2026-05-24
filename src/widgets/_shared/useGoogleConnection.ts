import { useState, useEffect } from "react";
import type { WidgetApi } from "@renderer/plugins/api";

/**
 * Checks and tracks the Google OAuth connection status.
 * Returns `[connected, setConnected]` where `connected` is `null` while
 * loading, `true` when connected, and `false` when not.
 */
export function useGoogleConnection(
  api: WidgetApi,
): [boolean | null, (v: boolean | null) => void] {
  const [connected, setConnected] = useState<boolean | null>(null);
  useEffect(() => {
    api.google.shared
      .isConnected()
      .then((c) => setConnected(c))
      .catch(() => setConnected(false));
  }, [api]);
  return [connected, setConnected];
}
