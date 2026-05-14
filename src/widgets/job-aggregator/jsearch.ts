import type { JobListing, NetFetcher } from './types';

// ─── JSearch (RapidAPI) [DISABLED] ────────────────────────────────────────────

export async function searchJSearch(
  fetch: NetFetcher,
  key: string,
  query: string,
  remote: boolean,
  empType: string,
): Promise<JobListing[]> {
  throw new Error('JSearch querying is disabled');
}
