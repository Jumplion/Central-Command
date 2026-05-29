import type { KeepNote, Note } from "./types";

export function keepNoteToLocal(kn: KeepNote): Note {
  const id = kn.name.replace("notes/", "");
  const title = kn.title ?? "";
  let content = "";
  if (kn.body?.text) {
    content = kn.body.text.text;
  } else if (kn.body?.list) {
    content = kn.body.list.listItems
      .map((item) => `${item.checked ? "- [x]" : "- [ ]"} ${item.text.text}`)
      .join("\n");
  }
  return {
    id,
    title,
    content,
    category: "",
    pinned: kn.pinned ? 1 : 0,
    created_at: kn.createTime,
    updated_at: kn.updateTime,
  };
}

export function noteMatchesSearch(note: Note, query: string): boolean {
  const q = query.toLowerCase();
  return (
    note.title.toLowerCase().includes(q) ||
    note.content.toLowerCase().includes(q) ||
    note.category.toLowerCase().includes(q)
  );
}

export function extractCategories(notes: Note[]): string[] {
  const cats = new Set<string>();
  for (const n of notes) {
    if (n.category) cats.add(n.category.trim());
  }
  return Array.from(cats).sort();
}

export function contentPreview(content: string, maxLen = 90): string {
  const stripped = content
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/\n+/g, " ")
    .trim();
  return stripped.length <= maxLen ? stripped : stripped.slice(0, maxLen) + "…";
}

export function newLocalId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isKeepNote(id: string): boolean {
  return !id.startsWith("local-");
}
