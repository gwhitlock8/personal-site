# gavin-whitlock-site

My personal site with an AI assistant that answers questions about my work. It's built with Next.js, LangChain.js and Kimi K3, an open-weight model from Moonshot AI, and deployed on Vercel.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for how it works and why.

## Run it locally

You need Node 20 or newer and a Moonshot API key.

1. Get a key at https://platform.moonshot.ai. You have to top up at least $1 before `kimi-k3` unlocks.
2. Install and configure:

   ```bash
   npm install
   cp .env.example .env.local   # then paste your MOONSHOT_API_KEY
   ```

3. Check the pipeline without the browser:

   ```bash
   npm test                                   # offline: retrieval + request-shape tests, no key needed
   npm run ask -- "What did Gavin do at ServiceNow?"   # real call to Kimi K3
   ```

4. Start the site at http://localhost:3000:

   ```bash
   npm run dev
   ```

## Edit the content

| What | Where |
| --- | --- |
| Headline, intro, stats, roles, references, suggested questions | `lib/profile.ts` |
| Assistant knowledge (one `##` section per topic) | `content/*.md` |
| Assistant rules and persona tone | `lib/prompts.ts` |
| Resume PDF | `public/Gavin-Whitlock-Resume.pdf` |

Search for `TODO(Gavin)` to find the gaps to fill, especially `content/career-notes.md`. The assistant can only tell stories that are written down there. After you edit, run `npm test` to make sure retrieval still finds the right sections.

## Put it on GitHub

```bash
git init && git add . && git commit -m "Initial site"
gh repo create personal-site --public --source=. --push
# or create an empty repo on github.com and:
# git remote add origin git@github.com:gwhitlock8/personal-site.git && git push -u origin main
```

`.env.local` is in `.gitignore`, so your key stays off GitHub.

## Deploy on Vercel

1. At https://vercel.com/new, import the GitHub repo. Vercel detects Next.js automatically.
2. Under **Environment Variables**, add `MOONSHOT_API_KEY`. Optionally add `KIMI_REASONING_EFFORT` (default `low`).
3. Deploy. Every later push to `main` redeploys.
4. For chat logs, leads and rate limiting, go to the project's **Storage** tab, pick **Upstash for Redis** from the Marketplace and connect it. It sets the env vars itself, so just redeploy.
5. For a custom domain, go to **Settings > Domains**.

To read logs, open the Upstash console's Data Browser and look at the `chats` and `leads` lists. Newest entries are first.

## Costs

Kimi K3 costs $3 per million input tokens ($0.30 when cached) and $15 per million output tokens. A typical question sends about 3,000 tokens and gets about 200 back, plus K3's hidden reasoning tokens, which bill as output. That works out to roughly 1 to 2 cents per message at low effort. The rate limit is 20 messages per visitor per 10 minutes and 5 fit checks. Moonshot also lets you set a spending cap.

## Admin: private job search tracker

`/admin` is a private area for tracking job Applications and Opportunities. It's protected by a password plus a 6-digit authenticator code, and its data lives in the site's Upstash database under an `admin:` key prefix. Terms are defined in [CONTEXT.md](./CONTEXT.md).

Setup:

1. Run `npm run admin:setup`. It asks for a password and prints three environment variables plus an authenticator setup key.
2. Add the setup key to your authenticator app (Google Authenticator, 1Password, Authy).
3. In Vercel, add the three variables under **Settings > Environment Variables** (Production).
4. Redeploy, then sign in at `/admin`.

Admin data shares the site's existing Upstash database, with every key prefixed `admin:`. To give it a separate database later, connect one with the env var prefix `ADMIN` and redeploy (existing admin data would need copying over).

Five wrong attempts from one IP lock login for 15 minutes. Each authenticator code works only once.

To try it locally, put the three variables in `.env.local` along with `ADMIN_STORE=memory` (data resets when the server restarts).

### Gmail sync (Apps Script)

A Google Apps Script in your own Gmail account sends job-search email to the tracker every 15 minutes: only the sender, subject, date, a short snippet and the Gmail ids. Kimi K3 turns each one into an Event and, where it implies a new Stage, a Proposed Change you approve under **Review**. Why Apps Script instead of the Gmail API: [docs/adr/0001](./docs/adr/0001-apps-script-for-gmail.md).

1. Run `npm run admin:ingest-secret` and add the printed `ADMIN_INGEST_SECRET` in Vercel (Production). Redeploy.
2. In Gmail, create a label named **Job Search**. Put it on recruiter threads that don't come from an applicant tracking system.
3. Go to [script.google.com](https://script.google.com), create a project, and paste in `scripts/gmail-sync.gs`.
4. In the project's **Project Settings > Script Properties**, add `INGEST_SECRET` with the same value as step 1.
5. Run `testConnection` once and approve the permissions. Then run `installTrigger` once.

The first runs work back to October 1, 2026, 50 messages per run. Moonshot's rate limit is shared by the whole account, so email classification is capped at `ADMIN_MODEL_RPM` calls a minute (default 50, half of the Tier 2 limit of 100), leaving the rest for the public chat; anything over the cap is retried next run. If your Moonshot tier changes, set `ADMIN_MODEL_RPM` in Vercel to about half the new RPM. `resetCursor` starts over; the site skips messages it has already seen. When `scripts/gmail-sync.gs` changes, paste the new version in by hand.

### Weekday Digest

Each weekday around 7:30 a.m. Central, the same Apps Script fetches the Digest from `/api/admin/digest` (same secret as the sync) and emails it to you from your own Gmail: follow-ups due, Proposed Changes to review, and a Pipeline summary. On days with nothing to act on, no email is sent.

Setup: paste the updated `scripts/gmail-sync.gs` into the Apps Script project and run `installDigestTrigger` once. `previewDigest` shows today's Digest in the log without sending it.
