# Phase 6: Tailored resumes

Status: approved by Gavin (2026-11-24)

## Why

Gavin applies to Solutions Engineer and presales roles. One general resume can't lead with what each role and industry cares most about. A tailored version picks and orders his true experience to match a posting. Everything on it must be true: no invented facts, no phrases copied from the posting, one page.

Later phases, each designed separately: interview prep from Fit Check gaps, outreach drafts, and source tracking.

## Goals

- Before applying (from a Job Match) or from an Application, produce a one-page resume tailored to the posting in one click. Gavin reviews and edits it, then saves.
- Every line traces to Gavin's own material. Anything that can't be traced is flagged, not hidden.
- Keep a growing **Experience bank** of true details that are too much for the general resume, so later resumes and Fit Checks can use them.
- Save the PDF to Vercel Blob, linked from the Application, and record which version was used.

## Non-goals

- Sending or uploading resumes anywhere. Gavin downloads the PDF and applies himself.
- Cover letters (outreach drafts come later).
- Regenerating the public resume on gavinwhitlock.com. It stays as it is.
- Changing job titles, dates, companies or education. Those are fixed facts and are never generated.

## Anti-goals (a failure even if it works)

- A claim Gavin can't defend in an interview: a skill, number or result that isn't in his material.
- Wording lifted from the job posting. It reads as keyword stuffing and isn't in his voice.
- "Architect" in the headline or summary. Architect reads as professional services. The real job title "AI Solution Architect" at ServiceNow stays as it is.
- The American Express name. It's always "a large US credit card issuer".
- The phone number on the resume.
- A resume that spills onto a second page.

## The pieces

### 1. Base resume (in the repo)

The current general resume moves from the HTML I keep in my workspace into the repo as structured data in `lib/resume/base.ts`:
- header: name, contact (email, site, LinkedIn, Austin; no phone)
- the default tagline ("Solutions Engineer | AI Solutions") and summary
- roles: title, company, location and dates (all fixed), plus their bullets
- earlier experience (fixed)
- Key Achievements (four in the general version)
- education (fixed)
- skill groups

This is the canonical, already-approved wording. Each bullet gets a stable id.

### 2. Experience bank

A list of extra true details, stored in the admin database and edited on a new **Experience** page in the admin nav. Each entry has:
- **What**: one or two sentences in Gavin's words
- **Where**: the role it belongs to (DevRev, ServiceNow, LogicMonitor, ClearDATA, an earlier job), or "certification" or "general"
- **Proof** (optional): a number or result
- **Use when** (optional): when to include it, e.g. "ServiceNow-heavy roles or postings that mention the CMDB"

Seeded with what Gavin has said (he reviews the wording on the page):
- Certified ServiceNow Administrator (CSA). Certification. Use when: ServiceNow-heavy roles or postings that mention the CMDB.
- Navigated ServiceNow CSDM and the CMDB. ServiceNow.
- Wrote custom DataSources in Groovy that used protocols like SNMP to pull specific metrics from infrastructure. They ran on the LogicMonitor Collector, a lightweight Java app installed on a host inside the customer's environment that polls network-connected devices. LogicMonitor.
- Built custom dashboards. LogicMonitor, ServiceNow and DevRev.
- Built an AI skill that creates accurate, useful dashboards using DevRev's internal API. DevRev.
- Troubleshot issues and worked out DevRev's API using Chrome DevTools and Postman. DevRev.

The bank also grows from gaps: when a tailored draft finds a posting requirement nothing backs up, it offers a box to add a true detail. The detail is saved to the bank, and the draft can be regenerated.

Admin Fit Checks (Job Matches and Applications) also read the bank, so a detail like the CMDB stops showing up as a false gap.

### 3. Sources the tailoring may use

Each source gets a short id the model must cite:
- **B**: base resume bullets, summary and achievements
- **S**: career stories (`content/career-notes.md` sections), profile and skills (`content/*.md`)
- **E**: Experience bank entries
- **N**: this Application's notes (details for this application only)

### 4. Generating a draft

The input is the posting (the Application's job description), its Fit Check if there is one, and the numbered sources.

One Kimi call with structured output (same setup as Fit Checks: `withStructuredOutput`, reasoning low, held to `ADMIN_MODEL_RPM`) returns:
- **tagline**: "Solutions Engineer | <focus>". The focus is a short phrase in Gavin's terms, never "architect".
- **summary**: 2–3 sentences, with sources
- **bullets per role**: for each fixed role, 1–5 bullets, each with the source ids it draws on and a priority rank
- **achievements**: four, chosen from the base achievements and sources, each citing sources
- **skills**: the groups re-ordered and trimmed to what matters for this posting, with items only from his skills content and the bank
- **certifications line**: only when a bank entry's "use when" applies (the CSA rule)
- **emphasis**: one or two sentences for Gavin on what it led with and why (shown in the editor, not on the resume)
- **gaps**: posting requirements with no supporting source

The prompt says: reword only for length and emphasis; never add facts, numbers, tools or outcomes not in the cited sources; never reuse the posting's phrasing; keep Gavin's plain, short style.

### 5. Truth checks (server-side, after generation and after every edit)

Each line gets a flag the editor shows. Flags never block saving; Gavin decides.
- Every cited id must exist; uncited lines are flagged "no source".
- Any number in a line (percentages, dollar amounts, counts, years) must appear in its cited sources, or it's flagged.
- Copy check: six or more consecutive words shared with the posting are flagged.
- A blocked-terms check (the AmEx names, a phone number, "architect" outside the real job title) blocks saving until fixed.

### 6. Editor

A page at `/admin/items/[id]/resume`:
- left: a live PDF preview
- right: editable fields (tagline, summary, each bullet, achievements, skills), each bullet showing its source chips and any flags
- add, remove or reorder bullets; "Regenerate" (keeps nothing) and "Save PDF"
- the gaps list, with an "Add to Experience bank" box for each
- a page-fit indicator

Tailoring starts from either place:
- **Job Match** (before applying): "Tailor resume" uses the posting text the scan already pulled. The editor lives at `/admin/jobs/[key]/resume`. When Gavin clicks "Mark applied", the draft and saved PDFs move to the new Application.
- **Application** (roles that didn't come through Job Matches, like a recruiter or a referral): add the Application with its job description, then tailor from its Resume section.

The Application page gets a Resume section: "Tailor resume" (or "Edit tailored resume"), plus the saved PDFs with dates. Job Match cards get a "Tailor resume" button and show when a tailored resume is saved.

### 7. One page

After rendering, the server counts pages. If the result is over one page, it drops the lowest-priority bullets one at a time until it fits, and tells Gavin what was cut so he can swap something back in. Font size and margins stay as in the current design.

### 8. PDF

Built on the server without a browser (the approach Gavin approved). The current two-column design is rebuilt as a PDF template (`@react-pdf/renderer` or similar): GW monogram, sidebar, Bitter and Roboto fonts (both open-licensed, files committed to the repo).

From the same draft, it also produces the plain one-column ATS version, because two-column layouts parse badly in some applicant tracking systems. Gavin downloads whichever the employer's system suits.

Before building on the template, a side-by-side check against the current PDF.

### 9. Storage

- Drafts: in the admin database, keyed by owner (`resume:app:<applicationId>` or `resume:job:<jobKey>`), latest draft only. Mark applied re-keys a Job Match's draft and saved files to the new Application.
- Saved PDFs: in Vercel Blob, under random, unguessable paths, linked only from the admin.
  - Prefer private access if the Blob store supports it, served through an admin-only route. Otherwise use public blobs with random paths. The PDF holds only what's already public on the site (no phone).
- Each save is listed on the Application, with date and file names.
- The Application's "Resume version" becomes "Tailored (<date>)".
- Gavin creates the Blob store in the Vercel dashboard himself, which adds `BLOB_READ_WRITE_TOKEN`.

## Approaches considered

1. **Server builds the PDF with a JavaScript PDF library (chosen).** Fast, works on the Hobby plan, can count pages. Costs a one-time rebuild of the template; the result may differ slightly from the current Chrome-made PDF.
2. **Headless Chrome on Vercel.** Reuses the existing HTML exactly, but it's a large, slow-starting add-on near the plan's size limits and breaks easily with updates.
3. **Print from the browser.** Simplest to build, but two manual steps (Save as PDF, then upload) every time.

## Constraints

- Vercel Hobby: 60-second functions, 1-hour log retention.
- Kimi K3 via Moonshot, shared rate limit (`ADMIN_MODEL_RPM`).
- Admin auth as today (password + TOTP).
- The existing style rules for Gavin's writing: short, plain, not AI-sounding.

## Left to the builder

- The PDF library and font file sourcing.
- The exact prompt wording and schema field names.
- Editor layout details within the admin's current look.
- Whether the preview re-renders on each edit or on a "Preview" click.

## My calls (Gavin to check)

- The Experience bank feeds admin tailoring and Fit Checks only, not the public site's assistant, so private details never show up for visitors.
- Each tailored resume produces both the designed and the ATS PDF.
- Over-one-page drafts are trimmed automatically by priority, rather than shrinking text.
- Truth flags warn but don't block, except the blocked terms.
- Tailoring needs a job description of at least 200 characters (agency-board Job Matches usually don't have one: paste it, or add the Application with it). Applications without one (for example, those created from email) show "Paste the job description to tailor".
