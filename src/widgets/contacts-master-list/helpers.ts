import type { Birthday, Contact, RawPerson } from "./types";

export function parseContact(p: RawPerson): Contact {
  const photo = p.photos?.find((ph) => !ph.default) ?? p.photos?.[0];
  return {
    id: p.resourceName,
    etag: p.etag,
    displayName: p.names?.[0]?.displayName ?? "(no name)",
    givenName: p.names?.[0]?.givenName ?? "",
    familyName: p.names?.[0]?.familyName ?? "",
    emails: p.emailAddresses ?? [],
    phones: p.phoneNumbers ?? [],
    organizations: p.organizations ?? [],
    addresses: p.addresses ?? [],
    birthdays: p.birthdays ?? [],
    photoUrl: photo?.url ?? null,
    urls: p.urls ?? [],
    note: p.biographies?.[0]?.value ?? "",
  };
}

export function formatBirthday(b: Birthday): string {
  if (b.text) return b.text;
  if (!b.date) return "";
  const { year, month, day } = b.date;
  const parts: string[] = [];
  if (month) parts.push(String(month).padStart(2, "0"));
  if (day) parts.push(String(day).padStart(2, "0"));
  const base = parts.join("/");
  return year ? `${year}/${base}` : base;
}

export function initials(c: Contact): string {
  if (c.givenName && c.familyName)
    return (c.givenName[0] + c.familyName[0]).toUpperCase();
  if (c.displayName && c.displayName !== "(no name)")
    return c.displayName.slice(0, 2).toUpperCase();
  return "?";
}

export function contactMatchesQuery(c: Contact, q: string): boolean {
  const lower = q.toLowerCase();
  if (c.displayName.toLowerCase().includes(lower)) return true;
  if (c.emails.some((e) => e.value?.toLowerCase().includes(lower))) return true;
  if (c.phones.some((p) => p.value?.toLowerCase().includes(lower))) return true;
  if (
    c.organizations.some(
      (o) =>
        o.name?.toLowerCase().includes(lower) ||
        o.title?.toLowerCase().includes(lower),
    )
  )
    return true;
  return false;
}
