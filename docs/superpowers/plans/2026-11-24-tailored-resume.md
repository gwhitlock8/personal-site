# Tailored Resumes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From a Job Match or an Application, generate a one-page resume tailored to the posting from Gavin's own true material, let him edit it with source and truth flags, and save designed + ATS PDFs to Vercel Blob.

**Architecture:** The general resume becomes structured data in `lib/resume/base.ts`; an Experience bank lives in the admin database. One Kimi structured-output call picks and rewords from numbered sources; pure server-side checks flag untraceable lines; `@react-pdf/renderer` renders both PDF layouts and trims to one page; drafts live in Upstash, saved PDFs in Vercel Blob.

**Tech Stack:** Next.js 16 (App Router, server actions), TypeScript, LangChain.js + Kimi K3 (Moonshot), Upstash Redis (`adminDb()`), `@react-pdf/renderer`, `@vercel/blob`, tsx test scripts.

**Spec:** `docs/superpowers/specs/2026-11-24-tailored-resume-design.md`

## Global Constraints

- Every resume line traces to a source id: B (base), S (stories/profile/skills content), E (Experience bank), N (Application notes).
- Titles, companies, locations, dates, earlier experience and education come only from `base.ts`; the model never generates them.
- Tagline is "Solutions Engineer | <focus>"; "architect" is blocked everywhere except the real job title "AI Solution Architect".
- Blocked terms (save refused until fixed): "American Express", "AmEx", "Amex", any phone number.
- Copy check: 6+ consecutive words shared with the posting are flagged.
- One page; body font sizes and margins stay as in the current design (body 8.6pt); over one page → drop lowest-priority bullets and report what was cut.
- Tailoring needs a job description of at least 200 characters.
- Model calls go through `takeModelBudget()` (shared `ADMIN_MODEL_RPM`); a 429 or exhausted budget becomes `RateLimited`.
- The Experience bank feeds admin tailoring and admin Fit Checks only, never `/api/chat` or `/api/fit`.
- Contact block: gavinswhitlock@gmail.com, gavinwhitlock.com, linkedin.com/in/gavin-whitlock, Austin, TX. No phone.
- Writing style: short, plain, not AI-sounding; no posting phrases.

## Review Focus

1. Kimi returns a role id not in base, omits a role, or returns 0 bullets for one → base roles always render in base order; unknown ids dropped; an omitted role falls back to its first base bullet (Task 4 test `mergeDraft fills missing roles`).
2. Edited text with `&`, `<`, curly quotes, en dashes, or a long URL renders without crashing and stays on one page or gets trimmed (Task 5 test `renders special characters`).
3. Copy-check false positives: Gavin's own base wording that happens to share a short common phrase (under 6 words) with the posting is not flagged; punctuation and case are ignored (Task 3 test `copy check ignores short overlaps and punctuation`).
4. Mark applied on a Job Match with a draft but no saved PDFs moves the draft; with no draft it's a no-op; marking twice doesn't duplicate (Task 6 test `moveOwner`).
5. Regenerate when the model budget is used up or Blob isn't configured → a plain message, and the existing draft is unchanged (Task 4 test `budget exhausted leaves draft`, Task 6 test `save without BLOB token`).

---

### Task 1: Base resume as data

**Files:**
- Create: `lib/resume/types.ts`, `lib/resume/base.ts`, `scripts/test-resume.ts`
- Modify: `package.json` (append `&& tsx scripts/test-resume.ts` to `test`)

**Interfaces:**
- Produces:
  - `type Role = { id: string; title: string; company: string; location: string; dates: string; bullets: { id: string; text: string }[] }`
  - `type Achievement = { id: string; title: string; text: string }`
  - `type SkillGroup = { group: string; items: string }`
  - `type BaseResume = { name: string; contact: string[]; tagline: string; summary: { id: string; text: string }; roles: Role[]; earlier: { title: string; company: string; dates: string }[]; achievements: Achievement[]; education: { degree: string; school: string; years: string; location?: string }[]; skills: SkillGroup[] }`
  - `export const BASE: BaseResume` in `base.ts`
  - Ids: roles `devrev`, `sn-ai`, `sn-asc`, `lm-se`, `lm-csm`; bullets `B-<role>-<n>`, summary `B-summary`, achievements `B-ach-<n>`.

- [ ] **Step 1: Write the failing tests** in `scripts/test-resume.ts` (same `ok()` helper style as `scripts/test-admin.ts`):
  - `base: ids unique` (all bullet, summary and achievement ids distinct)
  - `base: five roles in order` → `BASE.roles.map(r => r.id)` equals `["devrev","sn-ai","sn-asc","lm-se","lm-csm"]`
  - `base: no phone, no AmEx` → JSON of BASE has no match for `/american express|\bamex\b|\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/i`
  - `base: tagline` → `BASE.tagline === "Solutions Engineer | AI Solutions"`
- [ ] **Step 2: Run** `npx tsx scripts/test-resume.ts` → FAIL (module not found).
- [ ] **Step 3: Write `base.ts`** by transcribing the current general resume (`/home/claude/resume/resume.html` in the cloud workspace) verbatim: header, summary, 5 roles with bullets, 5 earlier roles, 4 achievements, 2 education entries, 6 skill groups.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(resume): general resume as structured data`.

### Task 2: Experience bank (storage, page, Fit Checks)

**Files:**
- Create: `lib/admin/experience.ts`, `app/admin/(app)/experience/page.tsx`, `app/admin/experience-actions.ts`
- Modify: `app/admin/(app)/layout.tsx` (nav link "Experience" after Watchlist), `lib/chains.ts` (`runFit` gains `extra?: string`), `app/admin/actions.ts` (`attachFit` passes bank), `lib/admin/job-scan.ts` (`fitJob` passes bank), `scripts/test-resume.ts`, `CONTEXT.md` (add **Experience bank** term)

**Interfaces:**
- Produces:
  - `type ExperienceEntry = { id: string; what: string; where: string; proof?: string; useWhen?: string; createdAt: string }`
  - `listExperience(): Promise<ExperienceEntry[]>`: seeds from `EXPERIENCE_SEED` on first read (key `experience`)
  - `saveExperience(entries: ExperienceEntry[]): Promise<void>`
  - `addExperience(e: Omit<ExperienceEntry,"id"|"createdAt">): Promise<ExperienceEntry>`
  - `experienceAsContext(entries: ExperienceEntry[]): string`: markdown, one `- [E<n>] what (where; proof; use when: …)` line each
  - `runFit(jd: string, extra?: string)`: when `extra` is set, it's appended to the context under "## Experience bank"
- `EXPERIENCE_SEED`: the six entries in the spec, worded exactly as written there, `where` values `certification`, `ServiceNow`, `LogicMonitor`, `LogicMonitor, ServiceNow, DevRev`, `DevRev`, `DevRev`; CSA `useWhen`: "ServiceNow-heavy roles or postings that mention the CMDB".

- [ ] **Step 1: Failing tests** (memory store, `ADMIN_STORE=memory`):
  - `experience: seeds six entries once` (two reads → same 6 ids)
  - `experience: add then list` (length 7, newest last)
  - `experience: context lines` → `experienceAsContext` contains `[E1] Certified ServiceNow Administrator (CSA)` and `use when: ServiceNow-heavy roles`
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `experience.ts`; the page lists entries with inline edit (what, where, proof, use when), delete and an add form; actions call `requireAdmin()` and `revalidatePath("/admin", "layout")`. Wire `runFit(jd, experienceAsContext(await listExperience()))` in `attachFit` and `fitJob` only.
- [ ] **Step 4: Run** tests → PASS; `npx tsc --noEmit` → clean.
- [ ] **Step 5: Commit** `feat(admin): Experience bank, used by admin Fit Checks`.

### Task 3: Sources and truth checks (pure)

**Files:**
- Create: `lib/resume/sources.ts`, `lib/resume/checks.ts`
- Modify: `scripts/test-resume.ts`

**Interfaces:**
- Consumes: `BASE`, `ExperienceEntry`, `loadKnowledge()` (for S sources: one per content section, ids `S1…` in load order)
- Produces:
  - `type SourceRef = { id: string; text: string; where?: string; useWhen?: string }`
  - `buildSources(input: { base: BaseResume; stories: { heading: string; text: string }[]; bank: ExperienceEntry[]; notes?: string }): SourceRef[]` (N sources: notes split on blank lines, `N1…`)
  - `type Line = { text: string; sources: string[]; priority?: number }`
  - `type Flag = { kind: "no-source" | "unknown-source" | "number" | "copied" | "blocked"; detail: string }`
  - `checkLine(line: Line, sources: Map<string, SourceRef>, posting: string): Flag[]`
  - `blockedTerms(text: string): string[]` (matches AmEx names, phone numbers, "architect" unless inside "AI Solution Architect")

- [ ] **Step 1: Failing tests:**
  - `checks: unknown and missing sources` → `{text:"x", sources:[]}` gives `no-source`; `["E99"]` gives `unknown-source`
  - `checks: numbers must appear in sources` → "Hit 135% of quota" citing a source containing "135%" → no flag; "Hit 140%" → `number`
  - `copy check ignores short overlaps and punctuation` → posting "Run discovery, build demos." vs line "Run discovery and build demos" → none; a line sharing "own the technical win with account executives" (6+ words, different case/punctuation) → `copied`
  - `blocked terms` → "AmEx deal" → `["AmEx"]`; "Solutions architect" → `["architect"]`; "AI Solution Architect at ServiceNow" → `[]`; "512-555-0100" → phone
  - `sources: ids and notes` → bank of 2 gives `E1,E2`; notes "a\n\nb" gives `N1,N2`; every base bullet id present
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Numbers: tokens matching `/\$?\d[\d,.]*\s?(%|k|K|m|M|x|×)?/` compared after normalizing commas; copy check on lowercase word arrays with punctuation stripped, sliding window of 6.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(resume): source ids and truth checks`.

### Task 4: Draft generation

**Files:**
- Create: `lib/resume/generate.ts`, `lib/resume/prompt.ts`
- Modify: `scripts/test-resume.ts`

**Interfaces:**
- Consumes: Task 3 types; `kimi()` from `lib/model.ts`; `takeModelBudget()`, `RateLimited`
- Produces:
  - `type TailoredResume = { tagline: string; summary: Line; roles: { roleId: string; bullets: Line[] }[]; achievements: { title: string; text: string; sources: string[] }[]; skills: SkillGroup[]; certifications?: string; emphasis: string; gaps: string[]; cut?: string[] }`
  - `DraftSchema` (zod) matching the model's part of `TailoredResume`
  - `mergeDraft(raw: z.infer<typeof DraftSchema>, base: BaseResume): TailoredResume` (role order from base; unknown roleIds dropped; missing or empty role → its first base bullet with `sources:[bulletId]`; tagline forced to start "Solutions Engineer | ")
  - `generateDraft(input: { posting: string; fit?: Fit; sources: SourceRef[] }, run?: (prompt: string) => Promise<unknown>): Promise<TailoredResume>`: throws `RateLimited` when the budget is used up or on 429
- Prompt rules (from the spec): reword only for length/emphasis; never add facts, numbers, tools or outcomes not in cited sources; never reuse posting phrasing; plain short style; 1–5 bullets per role with priority 1 = keep first; certifications line only when a source's "use when" applies; list gaps as short requirement names.

- [ ] **Step 1: Failing tests:**
  - `mergeDraft fills missing roles` (raw with only `devrev` and an unknown `foo` → 5 roles in base order, `sn-ai` has `B-sn-ai-1`)
  - `mergeDraft forces tagline` ("AI Architect" → "Solutions Engineer | AI Architect" then blocked by checks; plain "Presales AI" → "Solutions Engineer | Presales AI")
  - `generateDraft passes sources and posting` (stub `run` captures the prompt; it contains `[E1]` and the posting text)
  - `budget exhausted leaves draft` (`ADMIN_MODEL_RPM=1`, take the minute's call, `generateDraft` rejects with `RateLimited`)
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Production `run` uses `kimi().withStructuredOutput(DraftSchema, { name: "tailored_resume", method: "jsonSchema", strict: true })`; map 429s to `RateLimited` as `budgetedClassify` does.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(resume): tailored draft generation`.

### Task 5: PDF rendering and one-page fit

**Files:**
- Create: `lib/resume/pdf/Designed.tsx`, `lib/resume/pdf/Ats.tsx`, `lib/resume/pdf/render.ts`, `lib/resume/fonts/*` (Bitter 400, Roboto 400/500, from `@fontsource/bitter` and `@fontsource/roboto` woff files)
- Modify: `package.json` (deps `@react-pdf/renderer`), `next.config.ts` (`serverExternalPackages: ["@react-pdf/renderer"]`, `outputFileTracingIncludes` adds `./lib/resume/fonts/**/*` for `/admin/**` and `/api/admin/**`), `scripts/test-resume.ts`

**Interfaces:**
- Consumes: `BaseResume`, `TailoredResume`
- Produces:
  - `toRenderable(t: TailoredResume, base: BaseResume): RenderResume` (fixed facts + chosen lines)
  - `renderPdf(r: RenderResume, layout: "designed" | "ats"): Promise<Buffer>`
  - `pageCount(pdf: Buffer): number` (count `/Type /Page` objects, excluding `/Pages`)
  - `fitToOnePage(t: TailoredResume, base: BaseResume): Promise<{ resume: TailoredResume; designed: Buffer; ats: Buffer }>`: drops the lowest-priority bullet across roles (never a role's last bullet) until the designed PDF is one page, and records dropped texts in `cut`
- Layout values from the current HTML: Letter, columns 5.36in / 3.14in; sidebar `#243f5c` with `#1b2c41` top band of 0.17in; accent `#1585e6`; ink `#3b3b3b`; body 8.6pt Roboto; name 25pt Bitter; section heads 12.5pt Bitter uppercase with 1.2px rule; GW monogram circle 1.24in `#3d5874`, 30pt Bitter.

- [ ] **Step 1: Failing tests:**
  - `base renders to one page` (`toRenderable` of a TailoredResume built from BASE → designed and ATS each `pageCount === 1`)
  - `overlong is trimmed` (DevRev given 12 long bullets → result one page, `cut.length > 0`, every role keeps ≥1 bullet)
  - `renders special characters` (bullet `R&D <beta> “quotes” – en dash https://example.com/a/very/long/path/that/keeps/going` → renders, buffer starts with `%PDF`)
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** both layouts; ATS is one column, no sidebar, same content order (summary, experience, earlier, achievements, skills, education, certifications).
- [ ] **Step 4: Run** → PASS. Then render the base resume in the cloud workspace, convert the page to PNG (`pdftoppm -r 110`), and compare it side by side with `/home/claude/resume/page-1.png`; adjust spacing until it matches closely.
- [ ] **Step 5: Commit** `feat(resume): designed and ATS PDF templates with one-page fit`.

### Task 6: Drafts, saved files and Blob

**Files:**
- Create: `lib/resume/store.ts`, `app/api/admin/resume/preview/route.ts`, `app/api/admin/resume/file/route.ts` (only if private Blob access is used)
- Modify: `package.json` (dep `@vercel/blob`), `.env.example` (`BLOB_READ_WRITE_TOKEN=`), `app/admin/job-actions.ts` (`markApplied` calls `moveOwner`), `scripts/test-resume.ts`

**Interfaces:**
- Produces:
  - `type Owner = { kind: "app"; id: string } | { kind: "job"; key: string }`; key strings `resume:app:<id>` / `resume:job:<key>`
  - `type SavedResume = { at: string; designedUrl: string; atsUrl: string; fileBase: string }`
  - `type ResumeRecord = { draft?: TailoredResume; saved: SavedResume[] }`
  - `getResume(o: Owner): Promise<ResumeRecord>`, `saveDraft(o: Owner, d: TailoredResume)`
  - `savePdfs(o: Owner, files: { designed: Buffer; ats: Buffer }, put?: BlobPut): Promise<SavedResume>`: throws `BlobNotConfigured` when `BLOB_READ_WRITE_TOKEN` is unset; file names `Gavin-Whitlock-Resume-<Company>-<yyyy-mm-dd>.pdf` and `…-ATS.pdf`; Blob paths under `resumes/` with `addRandomSuffix: true`
  - `moveOwner(from: Owner, to: Owner): Promise<void>`: re-keys the record; no-op if `from` is empty
  - Preview route: `GET ?owner=app:<id>|job:<key>&layout=designed|ats` → `requireAdmin` (401 if not) → renders the current draft with `fitToOnePage` → `application/pdf`
- Blob access: check the installed `@vercel/blob` for private access; if supported, store private and serve through `file/route.ts` behind `requireAdmin`; otherwise use `access: "public"` with random suffix.

- [ ] **Step 1: Failing tests:**
  - `store: draft round trip per owner`
  - `moveOwner` (job draft moves to app; job key is then empty; second move is a no-op; moving an empty owner leaves the target untouched)
  - `save without BLOB token` (`savePdfs` with the env unset rejects `BlobNotConfigured`, and the record's `saved` is unchanged)
  - `savePdfs records both files` (stub `put` returns urls; `saved[0].designedUrl` set; file base contains company and date)
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** `markApplied` calls `moveOwner({kind:"job",key}, {kind:"app",id:app.id})` and sets `app.resumeVersion = "Tailored (<date>)"` when the moved record has saved files.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(resume): drafts, Blob storage, move on Mark applied`.

### Task 7: Editor and entry points

**Files:**
- Create: `app/admin/(app)/resume/Editor.tsx` (server component plus a small client part for the preview iframe refresh), `app/admin/(app)/items/[id]/resume/page.tsx`, `app/admin/(app)/jobs/[key]/resume/page.tsx`, `app/admin/resume-actions.ts`
- Modify: `app/admin/(app)/items/[id]/page.tsx` (Resume section), `app/admin/(app)/jobs/page.tsx` (Tailor resume button + "Tailored resume saved" note)

**Interfaces:**
- Consumes: everything above
- Produces server actions (all `requireAdmin`):
  - `tailor(owner: string)`: builds sources (base, stories, bank, the Application's notes), calls `generateDraft`, saves draft; on `RateLimited` → redirect `?error=rate-limit`; posting under 200 chars → `?error=no-jd`
  - `saveEdits(owner: string, form: FormData)`: rebuilds the TailoredResume from fields (`tagline`, `summary`, `role.<roleId>.<i>.text`, `role.<roleId>.<i>.sources`, `ach.<i>.*`, `skills.<i>.*`), keeps sources, saves draft
  - `savePdf(owner: string)`: refuses with `?error=blocked&terms=…` if any `blockedTerms`; else `fitToOnePage` → `savePdfs`; `BlobNotConfigured` → `?error=blob`
  - `addGapToBank(owner: string, form: FormData)` → `addExperience` with `where` from the form, then back to the editor
- Copy for errors: rate-limit "The model is busy this minute. Try again shortly."; no-jd "Paste the job description to tailor."; blob "Add a Blob store in Vercel (Storage → Blob) to save PDFs."; blocked "Remove these before saving: …".

- [ ] **Step 1:** Build the editor. Left: `<iframe src="/api/admin/resume/preview?…">` with a Designed/ATS toggle. Right: fields, each bullet with source chips (id + first 60 chars of the source on hover) and flags from `checkLine`; the emphasis note; gaps with add-to-bank boxes; `cut` list; Regenerate / Save edits / Save PDF buttons; saved files list with download links. Owner pages pass the posting (`jobDescription` or `job.description`) and title.
- [ ] **Step 2:** `npx tsc --noEmit` → clean; `next build` in the cloud workspace copy (font stub only there) → succeeds.
- [ ] **Step 3: Click-through** with the memory store, a fake Moonshot returning a fixed draft, and a stubbed Blob `put`: tailor from a Job Match → edit a bullet to add "AmEx" → Save PDF refused → fix → Save PDF → Mark applied → the Application shows the saved resume and "Tailored (<date>)"; tailor from an Application without a job description → no-jd message.
- [ ] **Step 4: Commit** `feat(admin): tailored resume editor from Job Matches and Applications`.

### Task 8: Docs and handoff

**Files:**
- Modify: `README.md` (Tailored resumes section: Blob setup, Experience page, how sources and flags work), `CONTEXT.md` (**Tailored resume** term)

- [ ] **Step 1:** Write the sections; full `npm test` → all suites pass.
- [ ] **Step 2: Commit** `docs: tailored resumes`. Gavin then pushes and creates the Blob store in Vercel.
