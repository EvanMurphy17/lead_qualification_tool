# Deploying Loadstone to Cloudflare

The app deploys to **Cloudflare Workers** via the OpenNext adapter
(`@opennextjs/cloudflare`). Three Cloudflare resources are used:

| Resource | Purpose | Binding |
|---|---|---|
| Worker `loadstone` | the Next.js app | — |
| D1 database `loadstone-db` | signups / leads (Prisma) | `DB` |
| R2 bucket `loadstone-data` | full building payload (auth-gated) | `DATA` |

The free preview payload and all static assets ship with the Worker; only the
full 4.4MB dataset lives in R2.

## One-time setup

```bash
cd web
npx wrangler login                       # opens browser, authorize Cloudflare

# 1. Leads database
npx wrangler d1 create loadstone-db
#    -> copy the database_id it prints into wrangler.jsonc (REPLACE_WITH_D1_DATABASE_ID)
npx wrangler d1 execute loadstone-db --remote --file deploy/schema.sql

# 2. Data bucket (requires R2 enabled on the account — free tier is fine)
npx wrangler r2 bucket create loadstone-data
npx wrangler r2 object put loadstone-data/buildings.json.gz --file private-data/buildings.json.gz --remote

# 3. Secrets
npx wrangler secret put AUTH_SECRET      # paste output of: openssl rand -base64 32
npx wrangler secret put ADMIN_EMAILS     # ap@alpengridanalytics.com
npx wrangler secret put NLR_API_KEY      # your developer.nlr.gov key (for REopt)
```

## Deploy

```bash
npm run deploy
```

That builds Next.js + the Worker bundle and publishes to
`https://loadstone.<your-subdomain>.workers.dev`. Attach a custom domain in
the Cloudflare dashboard (Workers & Pages → loadstone → Settings → Domains),
e.g. `loadstone.alpengridanalytics.com`.

## After a data refresh

```bash
python ../scripts/build_web_dataset.py     # rebuilds payloads (+ preview/stats)
npx wrangler r2 object put loadstone-data/buildings.json.gz --file private-data/buildings.json.gz --remote
npm run deploy                             # stats/preview are baked into the build
```

## Local testing of the Worker build

```bash
# simulate D1 + R2 locally (state persists in .wrangler/)
npx wrangler d1 execute loadstone-db --local --file deploy/schema.sql
npx wrangler r2 object put loadstone-data/buildings.json.gz --file private-data/buildings.json.gz --local
npm run preview                            # workerd at http://localhost:8787
```

Local `.dev.vars` supplies AUTH_SECRET/ADMIN_EMAILS/NLR_API_KEY for preview.
Note: `npm run dev` / `npm run start` still use the classic Node path
(SQLite via DATABASE_URL in `.env`, payload from `private-data/` on disk) —
the Cloudflare path activates only when DATABASE_URL is unset and the
D1/R2 bindings exist.

## Gotchas

- Building the Worker bundle requires Windows **Developer Mode** (symlinks).
- `wrangler.jsonc` `database_id` must be the real D1 id before deploying.
- Exporting the signup list: `/admin` in the app, or
  `npx wrangler d1 execute loadstone-db --remote --command "select email,name,company,role,createdAt from User"`.
