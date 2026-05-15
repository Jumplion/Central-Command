import { useState, useEffect, useCallback } from 'react';
import type { WidgetApi } from '@renderer/plugins/api';

export function useWidgetData<T>(
  api: WidgetApi,
  query: string,
  params?: unknown[],
): [T[], boolean, () => Promise<void>] {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api.sql.all<T>(query, params);
      setData(rows);
    } finally {
      setLoading(false);
    }
  }, [api, query]);

  useEffect(() => { void load(); }, [load]);

  return [data, loading, load];
}
