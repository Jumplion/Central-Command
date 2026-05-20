export type MediaType =
  | "book"
  | "movie"
  | "tv"
  | "game"
  | "podcast"
  | "anime"
  | "other";
export type MediaStatus =
  | "current"
  | "owned"
  | "want"
  | "completed"
  | "paused"
  | "dropped";
export type StatusFilter = MediaStatus | "all";
export type TypeFilter = MediaType | "all";
export type LinkRelation =
  | "sequel"
  | "prequel"
  | "spinoff"
  | "series"
  | "adaptation"
  | "remake"
  | "related";

export interface MediaItem {
  id: number;
  title: string;
  type: MediaType;
  status: MediaStatus;
  pinned: number;
  rating: number | null;
  notes: string | null;
  author_creator: string | null;
  external_id: string | null;
  external_source: string | null;
  created_at: string;
  updated_at: string;
}

export interface HistoryEntry {
  id: number;
  item_id: number;
  status: MediaStatus;
  changed_at: string;
}

export interface MediaLink {
  id: number;
  item_id: number;
  linked_item_id: number;
  relation: LinkRelation;
  created_at: string;
}

export interface FormState {
  title: string;
  type: MediaType;
  status: MediaStatus;
  author_creator: string;
  rating: number;
  notes: string;
  external_id: string;
  external_source: string;
}

export interface LookupResult {
  externalId: string;
  source: "tmdb" | "rawg" | "openlibrary";
  title: string;
  creator: string;
  year: string;
}
