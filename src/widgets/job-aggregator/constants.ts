import type { CompanyType, FeedType, SavedStatus } from "./types";

// ─── Shared style constants ───────────────────────────────────────────────────

export const thStyle: React.CSSProperties = {
  padding: "4px 6px",
  fontWeight: 500,
  fontSize: 11,
  textAlign: "left",
  borderBottom: "1px solid var(--border)",
};

export const tdStyle: React.CSSProperties = {
  padding: "5px 6px",
  verticalAlign: "middle",
};

export const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// ─── Status / source colours ──────────────────────────────────────────────────

export const STATUSES: SavedStatus[] = [
  "Interested",
  "Applied",
  "Phone",
  "Onsite",
  "Offer",
  "Rejected",
];

export const STATUS_COLORS: Record<SavedStatus, string> = {
  Interested: "#6ea8ff",
  Applied: "#a78bfa",
  Phone: "#f59e0b",
  Onsite: "#ff9f40",
  Offer: "#34d399",
  Rejected: "#ff6e6e",
};

export const SOURCE_COLORS: Record<string, string> = {
  LinkedIn: "#0a66c2",
  Indeed: "#003a9b",
  Glassdoor: "#0caa41",
  ZipRecruiter: "#59bd66",
  "Google Jobs": "#4285f4",
  Monster: "#6e2d8e",
  Arbeitnow: "#6ea8ff",
  Lever: "#5d5df8",
  Greenhouse: "#24a47f",
};

export const FEED_COLORS: Record<FeedType, string> = {
  rss: "#f59e0b",
  lever: "#5d5df8",
  greenhouse: "#24a47f",
  search: "#6ea8ff",
};

export const FEED_LABELS: Record<FeedType, string> = {
  rss: "RSS",
  lever: "Lever",
  greenhouse: "Greenhouse",
  search: "Search",
};

export const COMPANY_TYPE_LABELS: Record<CompanyType, string> = {
  gaming: "🎮 Gaming",
  tech: "💻 Tech / Software",
  finance: "🏦 Finance & Fintech",
  defense: "🛡️ Defense & Aerospace",
  cybersecurity: "🔒 Cybersecurity",
  other: "🏢 Other",
};

export const COMPANY_TYPE_COLORS: Record<CompanyType, string> = {
  gaming: "#a78bfa",
  tech: "#6ea8ff",
  finance: "#34d399",
  defense: "#f59e0b",
  cybersecurity: "#ff6e6e",
  other: "#9ca3af",
};

export const COMPANY_TYPE_ORDER: CompanyType[] = [
  "gaming",
  "tech",
  "finance",
  "defense",
  "cybersecurity",
  "other",
];

export const EMP_TYPES = [
  { value: "all", label: "All Types" },
  { value: "fulltime", label: "Full-time" },
  { value: "parttime", label: "Part-time" },
  { value: "contractor", label: "Contract" },
  { value: "intern", label: "Internship" },
];

// ─── Seed data ────────────────────────────────────────────────────────────────

// Bump SEED_VERSION whenever new entries are added — the seeder skips if the
// stored version already matches (checked via KV on every mount).
export const SEED_VERSION = 6;

export const DEFAULT_FEEDS: Array<{
  name: string;
  url: string;
  feed_type: FeedType;
  company_type: CompanyType;
}> = [
  // ── Tech / SaaS — Lever ───────────────────────────────────────────────────
  {
    name: "AppLovin",
    url: "applovin",
    feed_type: "lever",
    company_type: "gaming",
  },
  {
    name: "Eventbrite",
    url: "eventbrite",
    feed_type: "lever",
    company_type: "tech",
  },
  { name: "Kabam", url: "kabam", feed_type: "lever", company_type: "gaming" },
  { name: "KPMG", url: "kpmg", feed_type: "lever", company_type: "finance" },
  { name: "Netflix", url: "netflix", feed_type: "lever", company_type: "tech" },
  {
    name: "Niantic",
    url: "niantic",
    feed_type: "lever",
    company_type: "gaming",
  },
  {
    name: "Palantir",
    url: "palantir",
    feed_type: "lever",
    company_type: "tech",
  },
  {
    name: "People Can Fly",
    url: "peoplecanfly",
    feed_type: "lever",
    company_type: "gaming",
  },
  {
    name: "Scopely",
    url: "scopely",
    feed_type: "lever",
    company_type: "gaming",
  },
  {
    name: "Shield AI",
    url: "shieldai",
    feed_type: "lever",
    company_type: "defense",
  },
  { name: "Shopify", url: "shopify", feed_type: "lever", company_type: "tech" },
  {
    name: "Unity Technologies",
    url: "unity",
    feed_type: "lever",
    company_type: "gaming",
  },

  // ── Texas Tech — Lever ────────────────────────────────────────────────────
  {
    name: "HighLevel (Dallas)",
    url: "gohighlevel",
    feed_type: "lever",
    company_type: "tech",
  },
  {
    name: "Jam City",
    url: "jamcity",
    feed_type: "lever",
    company_type: "gaming",
  },

  // ── Gaming — Greenhouse ───────────────────────────────────────────────────
  {
    name: "2K Games",
    url: "2k",
    feed_type: "greenhouse",
    company_type: "gaming",
  },
  {
    name: "Avalanche Studios",
    url: "avalanchestudios",
    feed_type: "greenhouse",
    company_type: "gaming",
  },
  {
    name: "Bungie",
    url: "bungie",
    feed_type: "greenhouse",
    company_type: "gaming",
  },
  {
    name: "CD Projekt Red",
    url: "cdprojektred",
    feed_type: "greenhouse",
    company_type: "gaming",
  },
  {
    name: "Devolver Digital",
    url: "devolverdigital",
    feed_type: "greenhouse",
    company_type: "gaming",
  },
  {
    name: "Digital Extremes",
    url: "digitalextremes",
    feed_type: "greenhouse",
    company_type: "gaming",
  },
  {
    name: "Epic Games",
    url: "epicgames",
    feed_type: "greenhouse",
    company_type: "gaming",
  },
  {
    name: "Frontier Developments",
    url: "frontierdevelopments",
    feed_type: "greenhouse",
    company_type: "gaming",
  },
  {
    name: "Hi-Rez Studios",
    url: "hirezstudios",
    feed_type: "greenhouse",
    company_type: "gaming",
  },
  {
    name: "Insomniac Games",
    url: "insomniac",
    feed_type: "greenhouse",
    company_type: "gaming",
  },
  {
    name: "IO Interactive",
    url: "iointeractive",
    feed_type: "greenhouse",
    company_type: "gaming",
  },
  {
    name: "Iron Galaxy",
    url: "irongalaxy",
    feed_type: "greenhouse",
    company_type: "gaming",
  },
  {
    name: "Jagex",
    url: "jagex",
    feed_type: "greenhouse",
    company_type: "gaming",
  },
  {
    name: "Naughty Dog",
    url: "naughtydog",
    feed_type: "greenhouse",
    company_type: "gaming",
  },
  {
    name: "Paradox Interactive",
    url: "paradoxinteractive",
    feed_type: "greenhouse",
    company_type: "gaming",
  },
  {
    name: "PlayStation / Sony IE",
    url: "sonyinteractiveentertainmentglobal",
    feed_type: "greenhouse",
    company_type: "gaming",
  },
  {
    name: "Riot Games",
    url: "riotgames",
    feed_type: "greenhouse",
    company_type: "gaming",
  },
  {
    name: "Rockstar Games",
    url: "rockstargames",
    feed_type: "greenhouse",
    company_type: "gaming",
  },
  {
    name: "Take-Two Interactive",
    url: "taketwo",
    feed_type: "greenhouse",
    company_type: "gaming",
  },
  {
    name: "Team17",
    url: "team17",
    feed_type: "greenhouse",
    company_type: "gaming",
  },
  {
    name: "Turtle Rock Studios",
    url: "turtlerock",
    feed_type: "greenhouse",
    company_type: "gaming",
  },
  {
    name: "Wargaming",
    url: "wargaming",
    feed_type: "greenhouse",
    company_type: "gaming",
  },
  {
    name: "Wizards of the Coast",
    url: "wizardsofthecoast",
    feed_type: "greenhouse",
    company_type: "gaming",
  },
  {
    name: "Crystal Dynamics",
    url: "crystaldynamics",
    feed_type: "greenhouse",
    company_type: "gaming",
  },
  {
    name: "Krafton",
    url: "krafton",
    feed_type: "greenhouse",
    company_type: "gaming",
  },
  {
    name: "PUBG Corporation",
    url: "pubgcorporation",
    feed_type: "greenhouse",
    company_type: "gaming",
  },
  {
    name: "Roblox",
    url: "roblox",
    feed_type: "greenhouse",
    company_type: "gaming",
  },

  // ── Gaming — Lever ──────────────────────────────────────────
  {
    name: "Larian Studios",
    url: "larian",
    feed_type: "lever",
    company_type: "gaming",
  },

  // ── Tech — Greenhouse (verified tokens) ──────────────────────────────────
  {
    name: "Affirm",
    url: "affirm",
    feed_type: "greenhouse",
    company_type: "finance",
  },
  {
    name: "Airtable",
    url: "airtable",
    feed_type: "greenhouse",
    company_type: "tech",
  },
  {
    name: "Airbnb",
    url: "airbnb",
    feed_type: "greenhouse",
    company_type: "tech",
  },
  {
    name: "Amplitude",
    url: "amplitude",
    feed_type: "greenhouse",
    company_type: "tech",
  },
  {
    name: "Anthropic",
    url: "anthropic",
    feed_type: "greenhouse",
    company_type: "tech",
  },
  {
    name: "Asana",
    url: "asana",
    feed_type: "greenhouse",
    company_type: "tech",
  },
  {
    name: "Brex",
    url: "brex",
    feed_type: "greenhouse",
    company_type: "finance",
  },
  {
    name: "Chime",
    url: "chime",
    feed_type: "greenhouse",
    company_type: "finance",
  },
  {
    name: "Cloudflare",
    url: "cloudflare",
    feed_type: "greenhouse",
    company_type: "tech",
  },
  {
    name: "Databricks",
    url: "databricks",
    feed_type: "greenhouse",
    company_type: "tech",
  },
  {
    name: "Datadog",
    url: "datadog",
    feed_type: "greenhouse",
    company_type: "tech",
  },
  {
    name: "DeepMind",
    url: "deepmind",
    feed_type: "greenhouse",
    company_type: "tech",
  },
  {
    name: "Discord",
    url: "discord",
    feed_type: "greenhouse",
    company_type: "tech",
  },
  {
    name: "Dropbox",
    url: "dropbox",
    feed_type: "greenhouse",
    company_type: "tech",
  },
  {
    name: "Elastic",
    url: "elastic",
    feed_type: "greenhouse",
    company_type: "tech",
  },
  {
    name: "Fastly",
    url: "fastly",
    feed_type: "greenhouse",
    company_type: "tech",
  },
  {
    name: "Figma",
    url: "figma",
    feed_type: "greenhouse",
    company_type: "tech",
  },
  {
    name: "GitLab",
    url: "gitlab",
    feed_type: "greenhouse",
    company_type: "tech",
  },
  {
    name: "HubSpot",
    url: "hubspot",
    feed_type: "greenhouse",
    company_type: "tech",
  },
  {
    name: "Inflection AI",
    url: "inflectionai",
    feed_type: "greenhouse",
    company_type: "tech",
  },
  {
    name: "Instacart",
    url: "instacart",
    feed_type: "greenhouse",
    company_type: "tech",
  },
  { name: "Lyft", url: "lyft", feed_type: "greenhouse", company_type: "tech" },
  {
    name: "Mixpanel",
    url: "mixpanel",
    feed_type: "greenhouse",
    company_type: "tech",
  },
  {
    name: "MongoDB",
    url: "mongodb",
    feed_type: "greenhouse",
    company_type: "tech",
  },
  {
    name: "Netlify",
    url: "netlify",
    feed_type: "greenhouse",
    company_type: "tech",
  },
  {
    name: "Nubank",
    url: "nubank",
    feed_type: "greenhouse",
    company_type: "finance",
  },
  {
    name: "Okta",
    url: "okta",
    feed_type: "greenhouse",
    company_type: "cybersecurity",
  },
  {
    name: "PagerDuty",
    url: "pagerduty",
    feed_type: "greenhouse",
    company_type: "tech",
  },
  {
    name: "Reddit",
    url: "reddit",
    feed_type: "greenhouse",
    company_type: "tech",
  },
  {
    name: "Robinhood",
    url: "robinhood",
    feed_type: "greenhouse",
    company_type: "finance",
  },
  {
    name: "Rubrik",
    url: "rubrik",
    feed_type: "greenhouse",
    company_type: "tech",
  },
  {
    name: "Scale AI",
    url: "scaleai",
    feed_type: "greenhouse",
    company_type: "tech",
  },
  {
    name: "Stripe",
    url: "stripe",
    feed_type: "greenhouse",
    company_type: "finance",
  },
  {
    name: "Twilio",
    url: "twilio",
    feed_type: "greenhouse",
    company_type: "tech",
  },
  {
    name: "Twitch",
    url: "twitch",
    feed_type: "greenhouse",
    company_type: "tech",
  },
  {
    name: "Vercel",
    url: "vercel",
    feed_type: "greenhouse",
    company_type: "tech",
  },
  {
    name: "Waymo",
    url: "waymo",
    feed_type: "greenhouse",
    company_type: "tech",
  },
  { name: "xAI", url: "xai", feed_type: "greenhouse", company_type: "tech" },

  // ── Defense / Advanced Tech — Greenhouse ─────────────────────────────────
  {
    name: "Anduril Industries",
    url: "andurilindustries",
    feed_type: "greenhouse",
    company_type: "defense",
  },
  {
    name: "Relativity Space",
    url: "relativity",
    feed_type: "greenhouse",
    company_type: "defense",
  },

  // ── Tech — Lever (additional) ─────────────────────────────────────────────
  { name: "Plaid", url: "plaid", feed_type: "lever", company_type: "finance" },
  { name: "Spotify", url: "spotify", feed_type: "lever", company_type: "tech" },

  // ── Texas Fortune 500 — JSearch (Workday / proprietary ATS) ──────────────
  {
    name: "American Airlines",
    url: "American Airlines",
    feed_type: "search",
    company_type: "other",
  },
  {
    name: "AT&T",
    url: "AT&T software engineer jobs",
    feed_type: "search",
    company_type: "tech",
  },
  {
    name: "Bank of America",
    url: "Bank of America",
    feed_type: "search",
    company_type: "finance",
  },
  {
    name: "Dell Technologies",
    url: "Dell Technologies",
    feed_type: "search",
    company_type: "tech",
  },
  {
    name: "ExxonMobil",
    url: "ExxonMobil Houston Texas",
    feed_type: "search",
    company_type: "other",
  },
  {
    name: "Southwest Airlines",
    url: "Southwest Airlines Dallas",
    feed_type: "search",
    company_type: "other",
  },
  {
    name: "Texas Instruments",
    url: "Texas Instruments Dallas",
    feed_type: "search",
    company_type: "tech",
  },
  {
    name: "Toyota",
    url: "Toyota Motor",
    feed_type: "search",
    company_type: "other",
  },
  {
    name: "USAA",
    url: "USAA San Antonio Texas",
    feed_type: "search",
    company_type: "finance",
  },

  // ── Defense / Aerospace Texas — JSearch ──────────────────────────────────
  {
    name: "Boeing",
    url: "Boeing engineer Texas",
    feed_type: "search",
    company_type: "defense",
  },
  {
    name: "L3Harris",
    url: "L3Harris engineer Texas",
    feed_type: "search",
    company_type: "defense",
  },
  {
    name: "Lockheed Martin",
    url: "Lockheed Martin Fort Worth Texas",
    feed_type: "search",
    company_type: "defense",
  },
  {
    name: "Raytheon",
    url: "Raytheon Texas",
    feed_type: "search",
    company_type: "defense",
  },

  // ── Cybersecurity (Texas presence) — JSearch ─────────────────────────────
  {
    name: "CrowdStrike",
    url: "CrowdStrike Austin Texas",
    feed_type: "search",
    company_type: "cybersecurity",
  },
  {
    name: "Forcepoint",
    url: "Forcepoint Austin Texas",
    feed_type: "search",
    company_type: "cybersecurity",
  },
  {
    name: "Palo Alto Networks",
    url: "Palo Alto Networks cybersecurity",
    feed_type: "search",
    company_type: "cybersecurity",
  },
  {
    name: "SentinelOne",
    url: "SentinelOne cybersecurity",
    feed_type: "search",
    company_type: "cybersecurity",
  },
  {
    name: "Trellix",
    url: "Trellix Plano Texas cybersecurity",
    feed_type: "search",
    company_type: "cybersecurity",
  },

  // ── Gaming Publishers — JSearch (Workday / proprietary ATS) ──────────────
  {
    name: "Activision Blizzard",
    url: "Activision Blizzard",
    feed_type: "search",
    company_type: "gaming",
  },
  {
    name: "Bandai Namco",
    url: "Bandai Namco game developer",
    feed_type: "search",
    company_type: "gaming",
  },
  {
    name: "Capcom",
    url: "Capcom game developer",
    feed_type: "search",
    company_type: "gaming",
  },
  {
    name: "Electronic Arts (EA)",
    url: "Electronic Arts",
    feed_type: "search",
    company_type: "gaming",
  },
  {
    name: "Gearbox Software",
    url: "Gearbox Software Frisco Texas",
    feed_type: "search",
    company_type: "gaming",
  },
  {
    name: "Nintendo",
    url: "Nintendo developer",
    feed_type: "search",
    company_type: "gaming",
  },
  {
    name: "Sega",
    url: "Sega game developer",
    feed_type: "search",
    company_type: "gaming",
  },
  {
    name: "Square Enix",
    url: "Square Enix game developer",
    feed_type: "search",
    company_type: "gaming",
  },
  {
    name: "Ubisoft",
    url: "Ubisoft",
    feed_type: "search",
    company_type: "gaming",
  },
  {
    name: "Warner Bros Games",
    url: "Warner Bros Games developer",
    feed_type: "search",
    company_type: "gaming",
  },
  {
    name: "Xbox Game Studios",
    url: "Xbox Game Studios developer",
    feed_type: "search",
    company_type: "gaming",
  },

  // ── Fortune 500 Tech — JSearch (Workday / proprietary ATS) ──────────────
  {
    name: "Amazon",
    url: "Amazon software engineer",
    feed_type: "search",
    company_type: "tech",
  },
  {
    name: "AMD",
    url: "AMD Advanced Micro Devices engineer",
    feed_type: "search",
    company_type: "tech",
  },
  {
    name: "Apple",
    url: "Apple software engineer",
    feed_type: "search",
    company_type: "tech",
  },
  {
    name: "Cisco",
    url: "Cisco Systems software engineer",
    feed_type: "search",
    company_type: "tech",
  },
  {
    name: "Coinbase",
    url: "Coinbase software engineer",
    feed_type: "search",
    company_type: "finance",
  },
  {
    name: "DoorDash",
    url: "DoorDash software engineer",
    feed_type: "search",
    company_type: "tech",
  },
  {
    name: "Google",
    url: "Google software engineer",
    feed_type: "search",
    company_type: "tech",
  },
  {
    name: "IBM",
    url: "IBM software engineer",
    feed_type: "search",
    company_type: "tech",
  },
  {
    name: "Intel",
    url: "Intel Corporation software engineer",
    feed_type: "search",
    company_type: "tech",
  },
  {
    name: "Meta",
    url: "Meta software engineer",
    feed_type: "search",
    company_type: "tech",
  },
  {
    name: "Microsoft",
    url: "Microsoft software engineer",
    feed_type: "search",
    company_type: "tech",
  },
  {
    name: "Nvidia",
    url: "Nvidia software engineer",
    feed_type: "search",
    company_type: "tech",
  },
  {
    name: "Oracle",
    url: "Oracle software engineer",
    feed_type: "search",
    company_type: "tech",
  },
  {
    name: "Qualcomm",
    url: "Qualcomm software engineer",
    feed_type: "search",
    company_type: "tech",
  },
  {
    name: "Salesforce",
    url: "Salesforce software engineer",
    feed_type: "search",
    company_type: "tech",
  },
  {
    name: "Snowflake",
    url: "Snowflake software engineer",
    feed_type: "search",
    company_type: "tech",
  },
  {
    name: "Uber",
    url: "Uber software engineer",
    feed_type: "search",
    company_type: "tech",
  },
  {
    name: "Zoom",
    url: "Zoom Video Communications engineer",
    feed_type: "search",
    company_type: "tech",
  },

  // ── Fortune 500 Finance — JSearch ─────────────────────────────────────────
  {
    name: "American Express",
    url: "American Express software engineer",
    feed_type: "search",
    company_type: "finance",
  },
  {
    name: "Capital One",
    url: "Capital One software engineer",
    feed_type: "search",
    company_type: "finance",
  },
  {
    name: "Citigroup",
    url: "Citigroup software engineer",
    feed_type: "search",
    company_type: "finance",
  },
  {
    name: "Goldman Sachs",
    url: "Goldman Sachs software engineer",
    feed_type: "search",
    company_type: "finance",
  },
  {
    name: "JPMorgan Chase",
    url: "JPMorgan Chase software engineer",
    feed_type: "search",
    company_type: "finance",
  },
  {
    name: "Morgan Stanley",
    url: "Morgan Stanley software engineer",
    feed_type: "search",
    company_type: "finance",
  },
  {
    name: "Wells Fargo",
    url: "Wells Fargo software engineer",
    feed_type: "search",
    company_type: "finance",
  },

  // ── US Gaming Studios — JSearch (Workday / proprietary ATS) ─────────────
  {
    name: "Bethesda Game Studios",
    url: "Bethesda Game Studios developer",
    feed_type: "search",
    company_type: "gaming",
  },
  {
    name: "BioWare",
    url: "BioWare game developer",
    feed_type: "search",
    company_type: "gaming",
  },
  {
    name: "id Software",
    url: "id Software game developer",
    feed_type: "search",
    company_type: "gaming",
  },
  {
    name: "NetherRealm Studios",
    url: "NetherRealm Studios developer",
    feed_type: "search",
    company_type: "gaming",
  },
  {
    name: "Obsidian Entertainment",
    url: "Obsidian Entertainment developer",
    feed_type: "search",
    company_type: "gaming",
  },
  {
    name: "Raven Software",
    url: "Raven Software game developer",
    feed_type: "search",
    company_type: "gaming",
  },
  {
    name: "Respawn Entertainment",
    url: "Respawn Entertainment developer",
    feed_type: "search",
    company_type: "gaming",
  },
  {
    name: "Santa Monica Studio",
    url: "Santa Monica Studio Sony developer",
    feed_type: "search",
    company_type: "gaming",
  },
  {
    name: "Treyarch",
    url: "Treyarch game developer",
    feed_type: "search",
    company_type: "gaming",
  },
  {
    name: "Valve",
    url: "Valve Corporation developer",
    feed_type: "search",
    company_type: "gaming",
  },

  // ── International Gaming Studios — JSearch ────────────────────────────────
  {
    name: "11 bit studios",
    url: "11 bit studios game developer",
    feed_type: "search",
    company_type: "gaming",
  },
  {
    name: "Behaviour Interactive",
    url: "Behaviour Interactive game developer",
    feed_type: "search",
    company_type: "gaming",
  },
  {
    name: "Bloober Team",
    url: "Bloober Team game developer",
    feed_type: "search",
    company_type: "gaming",
  },
  {
    name: "Bohemia Interactive",
    url: "Bohemia Interactive developer",
    feed_type: "search",
    company_type: "gaming",
  },
  {
    name: "Creative Assembly",
    url: "Creative Assembly game developer",
    feed_type: "search",
    company_type: "gaming",
  },
  {
    name: "Crytek",
    url: "Crytek game developer",
    feed_type: "search",
    company_type: "gaming",
  },
  {
    name: "Eidos Montreal",
    url: "Eidos Montreal game developer",
    feed_type: "search",
    company_type: "gaming",
  },
  {
    name: "HoYoverse",
    url: "HoYoverse miHoYo game developer",
    feed_type: "search",
    company_type: "gaming",
  },
  {
    name: "Klei Entertainment",
    url: "Klei Entertainment game developer",
    feed_type: "search",
    company_type: "gaming",
  },
  {
    name: "Nexon America",
    url: "Nexon America game developer",
    feed_type: "search",
    company_type: "gaming",
  },
  {
    name: "Pearl Abyss",
    url: "Pearl Abyss game developer",
    feed_type: "search",
    company_type: "gaming",
  },
  {
    name: "Relic Entertainment",
    url: "Relic Entertainment game developer",
    feed_type: "search",
    company_type: "gaming",
  },
  {
    name: "Remedy Entertainment",
    url: "Remedy Entertainment developer",
    feed_type: "search",
    company_type: "gaming",
  },
  {
    name: "Techland",
    url: "Techland game developer",
    feed_type: "search",
    company_type: "gaming",
  },
];

// ─── SQL schema ───────────────────────────────────────────────────────────────

export const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS saved_jobs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id          TEXT    NOT NULL UNIQUE,
    title           TEXT    NOT NULL,
    company         TEXT    NOT NULL,
    location        TEXT    NOT NULL DEFAULT '',
    is_remote       INTEGER NOT NULL DEFAULT 0,
    employment_type TEXT    NOT NULL DEFAULT '',
    salary_min      REAL,
    salary_max      REAL,
    salary_currency TEXT    NOT NULL DEFAULT '',
    salary_period   TEXT    NOT NULL DEFAULT '',
    date_posted     TEXT    NOT NULL DEFAULT '',
    apply_link      TEXT    NOT NULL DEFAULT '',
    source          TEXT    NOT NULL DEFAULT '',
    description     TEXT    NOT NULL DEFAULT '',
    status          TEXT    NOT NULL DEFAULT 'Interested',
    notes           TEXT    NOT NULL DEFAULT '',
    saved_at        INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS company_feeds (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,
    url          TEXT    NOT NULL,
    feed_type    TEXT    NOT NULL DEFAULT 'rss',
    company_type TEXT    NOT NULL DEFAULT 'other',
    enabled      INTEGER NOT NULL DEFAULT 1,
    added_at     INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS feed_jobs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    feed_id     INTEGER NOT NULL,
    ext_id      TEXT    NOT NULL,
    title       TEXT    NOT NULL,
    company     TEXT    NOT NULL DEFAULT '',
    location    TEXT    NOT NULL DEFAULT '',
    date_posted TEXT    NOT NULL DEFAULT '',
    apply_link  TEXT    NOT NULL DEFAULT '',
    description TEXT    NOT NULL DEFAULT '',
    fetched_at  INTEGER NOT NULL,
    ignored     INTEGER NOT NULL DEFAULT 0,
    UNIQUE(feed_id, ext_id)
  );
`;
