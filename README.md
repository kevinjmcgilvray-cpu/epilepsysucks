# Epilepsy Sucks

Kevin's story site for the LA Marathon / CURE Epilepsy — hosted at [epilepsysucks.org](https://epilepsysucks.org).

A single-page story site (`index.html` + `styles.css` + `app.js`) backed by a small set of
Vercel serverless functions (`api/`) and a Neon Postgres database, powering the live
fundraising bar, weigh-in chart, training log, milestones, comments, and the "Live Track"
race-day radar.

## Local preview

The frontend is static, so you can preview it without any build step:

```bash
python3 -m http.server 4200
# then open http://localhost:4200
```

Anything that talks to `/api/*` (fundraising totals, weigh-ins, training runs, comments,
live track) needs the API layer running too — see below.

## Project layout

```
index.html, styles.css, app.js   Frontend — the whole site is one page
api/                              Vercel serverless functions (Neon-backed)
  _db.js                         Shared helpers: SQL client, CORS, password check, sanitizing
  raised.js                      Fundraising totals (scrapes Haku, caches in Neon)
  donors.js                      Recent donor names for the "thank you" ticker
  training.js, weigh-ins.js      Training log + weigh-in log (read + owner-password write)
  milestones.js                  Timeline milestones (read + owner-password write)
  update.js                      Owner status-update posts
  comments.js, moderate.js       Public comments + owner moderation
  live-track.js                  Race-day GPS "Live Track" radar
  marathon-route.js               "Stadium to the Stars" route geometry for the map
  maps-config.js                 Bootstraps the map (Google Maps key, or MapLibre fallback)
sql/                              Schema for each table (site, comments, live-track, route)
scripts/                          One-off Node scripts to seed/import data into Neon
data/                             Static route data (LA Marathon course)
```

## Backend setup (Neon + Vercel)

1. Create a [Neon](https://neon.tech) Postgres database and grab its connection string.
2. Apply the schema (run once per table you need):
   ```bash
   node --env-file=.env.local scripts/seed-site.js          # training/weigh-ins/fundraising/milestones/posts/donors
   psql "$DATABASE_URL" -f sql/comments.sql
   psql "$DATABASE_URL" -f sql/live-track.sql
   psql "$DATABASE_URL" -f sql/marathon-route.sql
   ```
3. Copy `.env.local` (see below for the variables it expects) and set the same values in
   **Vercel → Project → Settings → Environment Variables**.
4. Owner-only actions (logging runs/weigh-ins/milestones, posting updates, moderating
   comments) are gated behind `OWNER_UPDATE_PASSWORD` — set it, then use it in the
   password-protected forms on the live site.

### Environment variables

| Variable | Used for |
| --- | --- |
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` | Neon Postgres connection (via `@neondatabase/serverless`) |
| `OWNER_UPDATE_PASSWORD` | Gate for all owner-only write endpoints |
| `COMMENTS_GITHUB_TOKEN`, `COMMENTS_ISSUE_NUMBER`, `OWNER_UPDATE_ISSUE_NUMBER` | Optional GitHub-issue mirroring for comments/updates |
| `GOOGLE_MAPS_API_KEY` | Optional — enables Google Maps for the route map (falls back to MapLibre if unset) |

## Deploy (GitHub → Vercel)

1. Push this repo to GitHub.
2. In [vercel.com](https://vercel.com): **Add New Project** → import the GitHub repo.
3. Framework preset: **Other** (static + serverless functions). Root directory: `.`
4. Add the environment variables above, then deploy.
5. Add domain `epilepsysucks.org` under **Project → Settings → Domains**, and point DNS at
   your registrar to Vercel's records (Vercel shows the exact values).

## Workflow

Changes ship as feature branches → PR → Vercel preview → merge:

```bash
git checkout -b feat/my-change
# ...edit, commit...
git push -u origin feat/my-change
gh pr create
gh pr checks <number>       # wait for the Vercel preview to pass
gh pr merge <number> --squash --delete-branch --admin   # once approved
```
