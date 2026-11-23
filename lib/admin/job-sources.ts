import { htmlToText, type Posting, type WatchlistCompany } from "./jobs";

// Where Job Matches come from. Each source has a pure parser (tested against
// sample payloads) and a fetcher. All are public, no-login endpoints:
//   Ashby       https://api.ashbyhq.com/posting-api/job-board/<board>
//   Greenhouse  https://boards-api.greenhouse.io/v1/boards/<board>/jobs?content=true
//   Lever       https://api.lever.co/v0/postings/<board>?mode=json
//   Hacker News the monthly "Who is hiring?" thread, via the Algolia HN API
//   Notion      the recruiting agency's job board (an Aggregator). This uses
//               Notion's undocumented public-page endpoints, which can change
//               without notice; failures show in the scan report, not as errors.

const DESC_MAX = 12_000;
const TIMEOUT = 15_000;
const clip = (s: string) => s.slice(0, DESC_MAX);

async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT), headers: { "user-agent": "gavinwhitlock.com job tracker", ...(init?.headers ?? {}) } });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).hostname}`);
  return res.json();
}

// ---- Ashby ----

type AshbyJob = {
  id: string; title: string; location?: string; isRemote?: boolean; workplaceType?: string;
  secondaryLocations?: { location?: string }[]; address?: { postalAddress?: { addressCountry?: string; addressRegion?: string; addressLocality?: string } };
  descriptionPlain?: string; descriptionHtml?: string; jobUrl?: string; publishedAt?: string; isListed?: boolean;
};

export function parseAshby(data: unknown, c: WatchlistCompany): Posting[] {
  const jobs = ((data as { jobs?: AshbyJob[] })?.jobs ?? []).filter((j) => j.isListed !== false);
  return jobs.map((j) => ({
    key: `ashby:${j.id}`,
    source: "ashby",
    company: c.name,
    title: j.title.trim(),
    locations: [
      j.location,
      ...(j.secondaryLocations ?? []).map((s) => s.location),
      j.address?.postalAddress?.addressRegion,
      j.address?.postalAddress?.addressCountry,
    ].filter((x): x is string => !!x),
    // Ashby sets isRemote for hybrid roles too; workplaceType is the reliable field.
    remote: j.workplaceType ? /remote/i.test(j.workplaceType) : !!j.isRemote,
    url: j.jobUrl ?? `https://jobs.ashbyhq.com/${c.board}/${j.id}`,
    description: clip(j.descriptionPlain ?? htmlToText(j.descriptionHtml ?? "")),
    postedAt: j.publishedAt,
    watchlistId: c.id,
  }));
}

// ---- Greenhouse ----

type GreenhouseJob = { id: number; title: string; location?: { name?: string }; absolute_url: string; content?: string; updated_at?: string; first_published?: string };

export function parseGreenhouse(data: unknown, c: WatchlistCompany): Posting[] {
  const jobs = (data as { jobs?: GreenhouseJob[] })?.jobs ?? [];
  return jobs.map((j) => {
    const loc = j.location?.name ?? "";
    return {
      key: `greenhouse:${c.board}:${j.id}`,
      source: "greenhouse",
      company: c.name,
      title: j.title.trim(),
      // Only the job's own location: "offices" lists company offices, not where the role sits.
      locations: [loc].filter(Boolean),
      remote: /remote/i.test(loc),
      url: j.absolute_url,
      description: clip(htmlToText(j.content ?? "")),
      postedAt: j.first_published ?? j.updated_at,
      watchlistId: c.id,
    } satisfies Posting;
  });
}

// ---- Lever ----

type LeverJob = {
  id: string; text: string; hostedUrl: string; createdAt?: number; workplaceType?: string;
  categories?: { location?: string; allLocations?: string[] }; descriptionPlain?: string;
  lists?: { text?: string; content?: string }[]; additionalPlain?: string;
};

export function parseLever(data: unknown, c: WatchlistCompany): Posting[] {
  const jobs = Array.isArray(data) ? (data as LeverJob[]) : [];
  return jobs.map((j) => ({
    key: `lever:${j.id}`,
    source: "lever",
    company: c.name,
    title: j.text.trim(),
    locations: [j.categories?.location, ...(j.categories?.allLocations ?? [])].filter((x): x is string => !!x),
    remote: /remote/i.test(j.workplaceType ?? "") || /remote/i.test(j.categories?.location ?? ""),
    url: j.hostedUrl,
    description: clip(
      [j.descriptionPlain ?? "", ...(j.lists ?? []).map((l) => `${l.text ?? ""}\n${htmlToText(l.content ?? "")}`), j.additionalPlain ?? ""].join("\n"),
    ),
    postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : undefined,
    watchlistId: c.id,
  }));
}

export async function fetchBoard(c: WatchlistCompany): Promise<Posting[]> {
  const b = encodeURIComponent(c.board);
  if (c.ats === "ashby") return parseAshby(await getJson(`https://api.ashbyhq.com/posting-api/job-board/${b}`), c);
  if (c.ats === "greenhouse") return parseGreenhouse(await getJson(`https://boards-api.greenhouse.io/v1/boards/${b}/jobs?content=true`), c);
  return parseLever(await getJson(`https://api.lever.co/v0/postings/${b}?mode=json`), c);
}

export function boardUrl(c: Pick<WatchlistCompany, "ats" | "board">): string {
  if (c.ats === "ashby") return `https://jobs.ashbyhq.com/${c.board}`;
  if (c.ats === "greenhouse") return `https://job-boards.greenhouse.io/${c.board}`;
  return `https://jobs.lever.co/${c.board}`;
}

// ---- Hacker News "Who is hiring?" ----

type HnComment = { id: number; text?: string | null; created_at?: string; children?: unknown[] };

/**
 * Turns a top-level "Who is hiring?" comment into a Posting. The first line is
 * usually "Company | Role(s) | Location | ...". The role used is the first SE-type
 * title mentioned anywhere in the comment.
 */
export function parseHnComment(c: HnComment): Posting | null {
  if (!c.text) return null;
  const text = htmlToText(c.text);
  const firstLine = text.split("\n")[0] ?? "";
  const company = (firstLine.split("|")[0] ?? "").trim().slice(0, 80);
  const role =
    text.match(/\b(senior |staff |lead |principal )?(solutions? engineer|sales engineer|solutions? consultant|pre-?\s?sales engineer|solutions? architect|forward[- ]deployed engineer)\b/i)?.[0] ?? "";
  if (!company || !role) return null;
  return {
    key: `hn:${c.id}`,
    source: "hn",
    company,
    title: role.replace(/\b\w/g, (m) => m.toUpperCase()),
    locations: [firstLine],
    remote: /\bremote\b/i.test(firstLine),
    url: `https://news.ycombinator.com/item?id=${c.id}`,
    description: clip(text),
    postedAt: c.created_at,
  };
}

export async function fetchHnWhoIsHiring(): Promise<Posting[]> {
  const search = (await getJson(
    "https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&hitsPerPage=10",
  )) as { hits?: { objectID: string; title?: string }[] };
  const story = search.hits?.find((h) => /who is hiring/i.test(h.title ?? ""));
  if (!story) throw new Error("No current Who is hiring? thread found");
  const thread = (await getJson(`https://hn.algolia.com/api/v1/items/${story.objectID}`)) as { children?: HnComment[] };
  return (thread.children ?? []).map(parseHnComment).filter((p): p is Posting => p !== null);
}

// ---- Notion job board (Aggregator) ----

export const NOTION_BOARD = {
  site: "https://better-career.notion.site",
  collectionId: "01bf2932-e565-4470-97e9-6c3e67a2aedf",
  viewId: "85935aa0-c6a9-4503-aae4-0634abead496", // "PreSales" tab
  spaceId: "014d4abe-10b0-4157-bbbd-c43efe96d804",
};

type NotionRecordMap = {
  block?: Record<string, { value?: { value?: NotionBlock } & NotionBlock }>;
  collection?: Record<string, { value?: { value?: { schema?: Record<string, { name: string }> }; schema?: Record<string, { name: string }> } }>;
};
type NotionBlock = { id?: string; properties?: Record<string, unknown[]>; created_time?: number };

/** Flattens a Notion rich-text / select property to text; dates to their start date. */
function notionText(value: unknown[] | undefined): string {
  if (!value) return "";
  const parts: string[] = [];
  for (const seg of value as [string, unknown[]?][]) {
    const date = (seg[1] as [string, { start_date?: string }][] | undefined)?.find((m) => m[0] === "d")?.[1]?.start_date;
    parts.push(date ?? seg[0]);
  }
  return parts.join("").trim();
}

export function parseNotionBoard(data: unknown): Posting[] {
  const result = data as { result?: { reducerResults?: { collection_group_results?: { blockIds?: string[] } } }; recordMap?: NotionRecordMap };
  const ids = result.result?.reducerResults?.collection_group_results?.blockIds ?? [];
  const rm = result.recordMap ?? {};
  const coll = Object.values(rm.collection ?? {})[0]?.value;
  const schema = coll?.value?.schema ?? coll?.schema ?? {};
  const nameOf = Object.fromEntries(Object.entries(schema).map(([k, v]) => [k, v.name]));

  const postings: Posting[] = [];
  for (const id of ids) {
    const raw = rm.block?.[id]?.value;
    const block = raw?.value ?? raw;
    if (!block?.properties) continue;
    const row: Record<string, string> = {};
    for (const [k, v] of Object.entries(block.properties)) row[nameOf[k] ?? k] = notionText(v);

    if (!/pre-?sales/i.test(row["Role Function"] ?? "")) continue;
    if (row["Job Status"] && !/active|open/i.test(row["Job Status"])) continue;
    if (/entry/i.test(row["Role Type"] ?? "")) continue;
    if (row["Region"] && !/united states/i.test(row["Region"])) continue;

    const url = row["Job Posting URL"] || row["LinkedIn Post URL"];
    if (!row["Role Title"] || !row["Company"] || !url) continue;
    postings.push({
      key: `notion:${id}`,
      source: "notion",
      company: row["Company"],
      title: row["Role Title"],
      locations: [row["Role Location (Remote or City)"], row["Region"]].filter(Boolean),
      remote: /remote/i.test(row["Location Type"] ?? ""),
      url: url.startsWith("http") ? url : `https://${url}`,
      // The board lists this under PreSales, which counts as the posting calling it pre-sales.
      description: `Listed under PreSales on the recruiting agency's job board. ${row["Point-of-Contact"] ? `Point of contact: ${row["Point-of-Contact"]}.` : ""}`.trim(),
      postedAt: row["Date Posted"] || (block.created_time ? new Date(block.created_time).toISOString() : undefined),
    });
  }
  return postings;
}

export async function fetchNotionBoard(): Promise<Posting[]> {
  const { site, collectionId, viewId, spaceId } = NOTION_BOARD;
  const body = {
    collection: { id: collectionId, spaceId },
    collectionView: { id: viewId, spaceId },
    loader: { type: "reducer", reducers: { collection_group_results: { type: "results", limit: 500 } }, searchQuery: "", userTimeZone: "America/Chicago" },
    source: { type: "collection", id: collectionId, spaceId },
  };
  const data = await getJson(`${site}/api/v3/queryCollection?src=initial_load`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseNotionBoard(data);
}
