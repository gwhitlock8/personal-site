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

`/admin` is a private area for tracking job Applications and Opportunities. It's protected by a password plus a 6-digit authenticator code, and its data lives in a separate Upstash database. Terms are defined in [CONTEXT.md](./CONTEXT.md).

Setup:

1. Run `npm run admin:setup`. It asks for a password and prints three environment variables plus an authenticator setup key.
2. Add the setup key to your authenticator app (Google Authenticator, 1Password, Authy).
3. In Vercel, add the three variables under **Settings > Environment Variables** (Production).
4. In Vercel's **Storage** tab, create a second Upstash for Redis database and connect it to this project with the environment variable prefix `ADMIN`, so it creates `ADMIN_KV_REST_API_URL` and `ADMIN_KV_REST_API_TOKEN`.
5. Redeploy, then sign in at `/admin`.

Five wrong attempts from one IP lock login for 15 minutes. Each authenticator code works only once.

To try it locally, put the three variables in `.env.local` along with `ADMIN_STORE=memory` (data resets when the server restarts).
