import type { CastingSite, ProjectType, Status } from "./types";

export const STATUSES: Status[] = [
  "Interested",
  "Submitted",
  "Callback",
  "Booked",
  "Released",
  "Passed",
];

export const STATUS_COLOR: Record<Status, string> = {
  Interested: "#6ea8ff",
  Submitted: "#a78bfa",
  Callback: "#f59e0b",
  Booked: "#34d399",
  Released: "#6b7280",
  Passed: "#ff6e6e",
};

export const PROJECT_TYPES: ProjectType[] = [
  "Film",
  "TV",
  "Commercial",
  "Theater",
  "Voiceover",
  "Student/Indie",
];

export const CASTING_SITES: CastingSite[] = [
  {
    id: "actors-access",
    name: "Actors Access",
    url: "https://actorsaccess.com/",
  },
  {
    id: "backstage",
    name: "Backstage",
    url: "https://www.backstage.com/casting/",
  },
  {
    id: "casting-networks",
    name: "Casting Networks",
    url: "https://www.castingnetworks.com/",
  },
  {
    id: "casting-frontier",
    name: "Casting Frontier",
    url: "https://castingfrontier.com/",
  },
  {
    id: "project-casting",
    name: "Project Casting",
    url: "https://www.projectcasting.com/",
  },
  {
    id: "nycastings",
    name: "NYCastings",
    url: "https://www.nycastings.com/casting-calls/",
  },
  { id: "playbill", name: "Playbill Jobs", url: "https://playbill.com/jobs" },
  { id: "voice123", name: "Voice123", url: "https://voice123.com/" },
  { id: "voices", name: "Voices.com", url: "https://www.voices.com/" },
];

export const CSV_HEADERS = [
  "project_title",
  "role",
  "project_type",
  "status",
  "casting_studio",
  "location",
  "pay_rate",
  "submitted_at",
  "submission_deadline",
  "shoot_date",
  "link",
  "notes",
] as const;

export const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS auditions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    project_title       TEXT    NOT NULL,
    role                TEXT    NOT NULL DEFAULT '',
    project_type        TEXT    NOT NULL DEFAULT 'Film',
    status              TEXT    NOT NULL DEFAULT 'Interested',
    casting_studio      TEXT    NOT NULL DEFAULT '',
    location            TEXT    NOT NULL DEFAULT '',
    pay_rate            TEXT    NOT NULL DEFAULT '',
    submitted_at        TEXT    NOT NULL,
    submission_deadline TEXT    NOT NULL DEFAULT '',
    shoot_date          TEXT    NOT NULL DEFAULT '',
    link                TEXT    NOT NULL DEFAULT '',
    notes               TEXT    NOT NULL DEFAULT '',
    last_updated        INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS site_checks (
    site_id      TEXT    PRIMARY KEY,
    last_checked INTEGER NOT NULL
  );
`;
