import type { WidgetApi } from "@renderer/plugins/api";
import type {
  LinkRelation,
  LookupResult,
  MediaStatus,
  MediaType,
} from "./types";
import { LINK_RELATIONS, MEDIA_TYPES, STATUS_FILTERS } from "./constants";

export const typeEmoji = (t: MediaType) =>
  MEDIA_TYPES.find((m) => m.value === t)?.emoji ?? "🎯";
export const statusLabel = (s: MediaStatus) =>
  STATUS_FILTERS.find((f) => f.value === s)?.label ?? s;
export const relationLabel = (r: LinkRelation) =>
  LINK_RELATIONS.find((x) => x.value === r)?.label ?? r;

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export async function lookupMetadata(
  net: WidgetApi["net"],
  type: MediaType,
  title: string,
  settings: Record<string, unknown>,
): Promise<LookupResult[]> {
  const q = encodeURIComponent(title);

  if (type === "movie" || type === "tv" || type === "anime") {
    const key = settings.tmdbKey as string | undefined;
    if (!key) return [];
    const res = await net.fetch(
      `https://api.themoviedb.org/3/search/multi?api_key=${key}&query=${q}&page=1`,
    );
    if (!res.ok) return [];
    const data = JSON.parse(res.body) as {
      results: Array<{
        id: number;
        title?: string;
        name?: string;
        release_date?: string;
        first_air_date?: string;
      }>;
    };
    return (data.results ?? []).slice(0, 5).map((r) => ({
      externalId: String(r.id),
      source: "tmdb" as const,
      title: r.title ?? r.name ?? "",
      creator: "",
      year: (r.release_date ?? r.first_air_date ?? "").slice(0, 4),
    }));
  }

  if (type === "game") {
    const key = settings.rawgKey as string | undefined;
    if (!key) return [];
    const res = await net.fetch(
      `https://api.rawg.io/api/games?key=${key}&search=${q}&page_size=5`,
    );
    if (!res.ok) return [];
    const data = JSON.parse(res.body) as {
      results: Array<{ id: number; name: string; released: string | null }>;
    };
    return (data.results ?? []).slice(0, 5).map((r) => ({
      externalId: String(r.id),
      source: "rawg" as const,
      title: r.name,
      creator: "",
      year: (r.released ?? "").slice(0, 4),
    }));
  }

  if (type === "book") {
    const res = await net.fetch(
      `https://openlibrary.org/search.json?title=${q}&limit=5&fields=key,title,author_name,first_publish_year`,
    );
    if (!res.ok) return [];
    const data = JSON.parse(res.body) as {
      docs: Array<{
        key: string;
        title: string;
        author_name?: string[];
        first_publish_year?: number;
      }>;
    };
    return (data.docs ?? []).slice(0, 5).map((d) => ({
      externalId: d.key,
      source: "openlibrary" as const,
      title: d.title,
      creator: (d.author_name ?? []).slice(0, 2).join(", "),
      year: String(d.first_publish_year ?? ""),
    }));
  }

  return [];
}
