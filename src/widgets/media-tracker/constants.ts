import type {
  FormState,
  LinkRelation,
  MediaStatus,
  MediaType,
  StatusFilter,
} from "./types";

export const MEDIA_TYPES: { value: MediaType; label: string; emoji: string }[] =
  [
    { value: "book", label: "Book", emoji: "📚" },
    { value: "movie", label: "Movie", emoji: "🎬" },
    { value: "tv", label: "TV Show", emoji: "📺" },
    { value: "game", label: "Game", emoji: "🎮" },
    { value: "podcast", label: "Podcast", emoji: "🎙️" },
    { value: "anime", label: "Anime", emoji: "⛩️" },
    { value: "other", label: "Other", emoji: "🎯" },
  ];

export const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "current", label: "Current" },
  { value: "owned", label: "Owned" },
  { value: "want", label: "Want" },
  { value: "completed", label: "Completed" },
  { value: "paused", label: "Paused" },
  { value: "dropped", label: "Dropped" },
];

export const STATUS_COLORS: Record<MediaStatus, string> = {
  current: "#3b82f6",
  owned: "#06b6d4",
  want: "#a855f7",
  completed: "#22c55e",
  paused: "#f59e0b",
  dropped: "#ef4444",
};

export const CURRENT_VERB: Record<MediaType, string> = {
  book: "Reading",
  movie: "Watching",
  tv: "Watching",
  game: "Playing",
  podcast: "Listening",
  anime: "Watching",
  other: "Consuming",
};

export const LINK_RELATIONS: { value: LinkRelation; label: string }[] = [
  { value: "sequel", label: "Sequel" },
  { value: "prequel", label: "Prequel" },
  { value: "spinoff", label: "Spinoff" },
  { value: "series", label: "Same Series" },
  { value: "adaptation", label: "Adaptation" },
  { value: "remake", label: "Remake / Remaster" },
  { value: "related", label: "Related" },
];

export const DEFAULT_FORM: FormState = {
  title: "",
  type: "book",
  status: "want",
  author_creator: "",
  rating: 0,
  notes: "",
  external_id: "",
  external_source: "",
};
