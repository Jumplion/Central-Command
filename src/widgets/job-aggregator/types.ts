// ─── Domain types ─────────────────────────────────────────────────────────────

export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  isRemote: boolean;
  employmentType: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency: string;
  salaryPeriod: string;
  datePosted: string;
  applyLink: string;
  source: string;
  description: string;
}

export type SavedStatus = 'Interested' | 'Applied' | 'Phone' | 'Onsite' | 'Offer' | 'Rejected';

export interface SavedJob {
  id: number;
  job_id: string;
  title: string;
  company: string;
  location: string;
  is_remote: number;
  employment_type: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  salary_period: string;
  date_posted: string;
  apply_link: string;
  source: string;
  status: SavedStatus;
  notes: string;
  saved_at: number;
}

export type FeedType = 'rss' | 'lever' | 'greenhouse' | 'search';

export interface CompanyFeed {
  id: number;
  name: string;
  url: string; // handle for lever/greenhouse, full URL for rss, search query for search
  feed_type: FeedType;
  enabled: number;
  added_at: number;
}

export interface FeedJob {
  id: number;
  feed_id: number;
  ext_id: string;
  title: string;
  company: string;
  location: string;
  date_posted: string;
  apply_link: string;
  description: string;
  fetched_at: number;
}

export type NetFetcher = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
) => Promise<{ ok: boolean; status: number; body: string }>;

// Internal parser types
export type ParsedFeedJob  = Omit<FeedJob, 'id' | 'feed_id' | 'fetched_at'>;
export type StampedFeedJob = ParsedFeedJob & { fetched_at: number };
