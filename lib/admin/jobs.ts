import type { Fit } from "@/lib/chains";

// Job Matches: open roles from Watchlist boards and Aggregators that fit
// Gavin's search criteria. Terms match CONTEXT.md. Pure types and rules.
//
// Criteria (agreed):
//  - Titles: Solutions Engineer, Sales Engineer, Solutions Consultant, Presales.
//  - Solutions Architect only when the posting says presales.
//  - No remote roles tied to another territory (in the title or the location).
//  - Forward Deployed / Applied AI Engineer only when the posting explicitly
//    calls it pre-sales, or the company is flagged (LangChain).
//  - Individual contributor, experienced: no interns, new grads, junior, entry-level,
//    and no managers, heads, directors or VPs. No post-sales-only roles.
//  - Location: Austin, or remote in the US.

export type JobSource = "ashby" | "greenhouse" | "lever" | "hn" | "notion";

export type Posting = {
  key: string; // source:id, stable across scans
  source: JobSource;
  company: string;
  title: string;
  locations: string[];
  remote: boolean;
  url: string;
  description: string; // plain text, trimmed
  postedAt?: string;
  watchlistId?: string;
};

export type JobMatch = Omit<Posting, "remote"> & {
  location: string;
  firstSeen: string;
  lastSeen: string;
  status: "new" | "dismissed" | "applied";
  applicationId?: string;
  fit?: Fit;
  fitScore?: number; // 0-100: share of requirements matched
  fitCheckedAt?: string;
  fitSkipped?: string; // why no Fit Check (e.g. description too short)
  closedAt?: string; // no longer listed on its board
};

export type WatchlistCompany = {
  id: string; // ats:board
  name: string;
  ats: "ashby" | "greenhouse" | "lever";
  board: string;
  /** Forward Deployed / Applied AI roles here are pre-sales (e.g. LangChain). */
  fdeIsPresales?: boolean;
  addedAt?: string;
};

// ---- Titles ----

const EXCLUDE_LEVEL = /\b(intern|internship|new grad|graduate program|junior|jr\.?|entry[- ]level|associate)\b/i;
const EXCLUDE_MANAGER = /\b(manager|head of|director|vp|vice president|chief|cro)\b/i;
const CORE_TITLE = /\bsolutions?\s+engineer|\bsales\s+engineer|\bsolutions?\s+consultant|\bpre-?\s?sales\b|\bpresales\b/i;
const ARCHITECT = /\bsolutions?\s+architect/i;
const FDE = /forward[- ]deployed|applied ai (engineer|architect)/i;
const SAYS_PRESALES = /\bpre-?\s?sales\b|\bpresales\b/i;
const POST_SALES_TITLE = /\b(resident|implementation|professional services|post-?\s?sales|delivery|onboarding|support)\b/i;

export function titleQualifies(title: string, description: string, opts: { fdeIsPresales?: boolean } = {}): boolean {
  if (EXCLUDE_LEVEL.test(title) || EXCLUDE_MANAGER.test(title)) return false;
  if (POST_SALES_TITLE.test(title) && !SAYS_PRESALES.test(title)) return false;
  if (CORE_TITLE.test(title)) return true;
  const text = `${title}\n${description}`;
  if (ARCHITECT.test(title)) return SAYS_PRESALES.test(text);
  if (FDE.test(title)) return !!opts.fdeIsPresales || SAYS_PRESALES.test(text);
  return false;
}

// ---- Locations ----
// Austin, or remote anywhere in the US. Remote roles tied to another state or
// region ("Remote - Southeast", "Remote - New Jersey", "Chicago area") don't count;
// time-zone notes and "X preferred" do.

const US_MARK = /\b(united states|usa|u\.s\.a?\.?|us|remote[- ]us|americas|amer|north america|nationwide|anywhere in the us)\b/i;
const FOREIGN = /\b(london|uk|united kingdom|england|emea|europe|eu|germany|berlin|munich|dublin|ireland|france|paris|amsterdam|netherlands|spain|madrid|sweden|stockholm|canada|toronto|vancouver|montreal|singapore|apac|apj|india|bangalore|bengaluru|japan|tokyo|seoul|korea|sydney|melbourne|australia|israel|tel aviv|latam|brazil|mexico|middle east|dubai|poland|switzerland|zurich|colombia|bogota|argentina|buenos aires|chile|peru|costa rica|portugal|lisbon|italy|milan|rome|belgium|brussels|denmark|copenhagen|norway|oslo|finland|helsinki|austria|vienna|czech|prague|romania|ukraine|turkey|uae|saudi|south africa|nigeria|kenya|egypt|philippines|manila|vietnam|thailand|indonesia|malaysia|hong kong|china|taiwan|new zealand|auckland|anz|dach|nordics|benelux|uki|mea|medit|cee|delhi|são paulo|sao paulo)\b/i;
const STATES =
  "alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming";
const CITIES =
  "new york|nyc|san francisco|sf|los angeles|chicago|boston|cambridge|seattle|denver|atlanta|miami|washington,? dc|d\\.c\\.|philadelphia|palo alto|menlo park|mountain view|san jose|san diego|portland|minneapolis|detroit|nashville|phoenix|salt lake city|raleigh|charlotte|pittsburgh|columbus|st\\.? louis|kansas city|baltimore|tampa|orlando|las vegas|reston";
const REGION = new RegExp(
  `\\b(${STATES}|south ?east|north ?east|north ?west|west coast|east coast|pacific northwest|midwest|mid-atlantic|new england|great lakes|rocky mountains?|bay area|tri-state|dmv|socal|norcal|metro|commuting distance|area|${CITIES})\\b`,
  "i",
);
const STATE_ABBR = /,\s*(A[LKZR]|C[AOT]|D[EC]|FL|GA|HI|I[DLNA]|K[SY]|LA|M[EDAINSOT]|N[EVHJMYCD]|O[HKR]|PA|RI|S[CD]|TN|UT|V[TA]|W[AVIY])\b/;
const TEXAS_OK = /\b(texas|tx|tola|central|south central|southwest|anywhere|nationwide)\b/i;
const BROAD_US =
  /\bremote\s*[-—–:,]?\s*(the\s+)?(continental\s+)?(united states|u\.?s\.?a?\b)(?!\s*(east|west|southeast|northeast|northwest|southwest|midwest|mid-atlantic)\b)|\bus[- ]remote\b|\bor (us )?remote\b/i;
const stripPreferences = (s: string) =>
  s
    .replace(/\([^)]*\b(preferred|ideal(ly)?|a plus)\b[^)]*\)/gi, "")
    .replace(/[;,][^;|]*\b(preferred|ideal(ly)?|also available|a plus)\b[^;|]*/gi, "");

export function locationQualifies(locations: string[], remote: boolean): boolean {
  const all = locations.join(" | ");
  if (/\baustin\b/i.test(all)) return true;
  const isRemote = remote || /\bremote\b|\banywhere\b|\bdistributed\b/i.test(all);
  if (!isRemote) return false;
  const text = stripPreferences(all);
  if (FOREIGN.test(text) && !US_MARK.test(text)) return false;
  if (BROAD_US.test(text) || TEXAS_OK.test(text)) return true;
  if (REGION.test(text) || STATE_ABBR.test(text)) return false;
  return true;
}

/** A territory named in the title ("Solutions Engineer, East"), unless it covers Texas. */
const TITLE_TERRITORY = /\b(east|west|south ?east|north ?east|north ?west|mid-?atlantic|new england|midwest|pacific northwest|bay area|nyc|new york|socal|norcal|great lakes|rockies)\b(?!\s+(coast )?preferred)/i;
const TITLE_TEXAS = /\b(texas|tx|central|south|southwest|tola|austin)\b/i;
export function titleTerritoryElsewhere(title: string): boolean {
  const tail = title.replace(/^[^,\-–—(|]*/, ""); // only the qualifiers after the role name
  return TITLE_TERRITORY.test(tail) && !TITLE_TEXAS.test(tail.replace(/south ?east/gi, ""));
}

export function postingQualifies(p: Posting, opts: { fdeIsPresales?: boolean } = {}): boolean {
  if (titleTerritoryElsewhere(p.title) && !/\baustin\b/i.test(p.locations.join(" "))) return false;
  return titleQualifies(p.title, p.description, opts) && locationQualifies(p.locations, p.remote);
}

/** 0-100: share of the job's requirements the Fit Check found evidence for. */
export function fitScore(fit: Fit): number {
  const total = fit.matches.length + fit.gaps.length;
  return total ? Math.round((fit.matches.length / total) * 100) : 0;
}

/** For de-duplicating the same posting seen through two sources. */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

/** Plain text from an HTML fragment (job descriptions). */
export function htmlToText(html: string): string {
  return html
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/<(br|p|\/p|\/li|\/h\d|\/div)(\s[^>]*)?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

/**
 * Reads a job board from what Gavin pastes on the Watchlist screen: a board URL
 * (jobs.ashbyhq.com/x, job-boards.greenhouse.io/x, boards.greenhouse.io/x,
 * jobs.lever.co/x) or a bare board name with the system chosen.
 */
export function parseBoardInput(input: string, ats?: string): Pick<WatchlistCompany, "ats" | "board"> | null {
  const raw = input.trim();
  if (!raw) return null;
  const url = raw.match(/^(?:https?:\/\/)?([^/\s]+)\/([^/?#\s]+)/i);
  if (url && /\./.test(url[1])) {
    const host = url[1].toLowerCase();
    const board = decodeURIComponent(url[2]);
    if (/(^|\.)ashbyhq\.com$/.test(host)) return { ats: "ashby", board };
    if (/(^|\.)greenhouse\.io$/.test(host)) return { ats: "greenhouse", board };
    if (/(^|\.)lever\.co$/.test(host)) return { ats: "lever", board };
    return null;
  }
  if (!/^[A-Za-z0-9._-]+$/.test(raw)) return null;
  if (ats === "ashby" || ats === "greenhouse" || ats === "lever") return { ats, board: raw };
  return null;
}
