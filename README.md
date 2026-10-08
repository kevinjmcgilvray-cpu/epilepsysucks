# Epilepsy Sucks

Kevin's story site for the LA Marathon / CURE Epilepsy — hosted at [epilepsysucks.org](https://epilepsysucks.org).

A single-page story site (`index.html` + `styles/*.css` + `js/*.js`) backed by a small set of
Vercel serverless functions (`api/`) and a Neon Postgres database, powering the live
fundraising bar, weigh-in chart, training log, milestones, comments, and the "Live Track"
race-day radar.

Also on the page: a seizure-frequency chart (2016–2026, static data in `js/04-charts-sims.js`),
a live Instagram feed (via a SociableKIT embed), and a mobile/desktop nav that adapts for
narrow screens, landscape phones, and wide-but-short viewports (e.g. iPhone Pro Max landscape).

## Local preview

The source files (`styles/*.css`, `js/*.js`) are plain, unbundled static files, so you can
preview them directly without any build step:

```bash
python3 -m http.server 4200
# then open http://localhost:4200
```

Anything that talks to `/api/*` (fundraising totals, weigh-ins, training runs, comments,
live track) needs the API layer running too — see below.

## Production build

Deployed production runs a build step (`npm run build`, configured as Vercel's
`buildCommand` in `vercel.json`), not the raw source files. It concatenates + minifies
`styles/*.css` into `dist/styles/app.min.css` and `js/*.js` into `dist/js/app.min.js`
(preserving the exact load order `index.html`'s `<link>`/`<script>` tags already use — this
is deliberately *not* a real module bundler, just fewer requests + a smaller payload), copies
every other static file through unchanged, and rewrites `dist/index.html`'s tags to match.
`api/` is untouched — Vercel deploys it as serverless functions regardless of
`outputDirectory`. See `scripts/build.js` for the full logic.

```bash
npm run build   # outputs to dist/
```

## Tests

```bash
npm install
npx playwright install --with-deps chromium   # once per machine
npm test
```

`tests/` is a small Playwright-based suite (no test framework, just plain scripts +
`tests/_assert.js`) that spins up a static server for the frontend and checks:

- `regression.test.js` — storm effects (on by default) + lightning cursor (off by default)
  toggle behavior, persistence across reload, `prefers-reduced-motion` override, entry-warning
  copy, the 4 distinct thunder audio sources.
- `smoke.test.js` — scrolls the full page in both themes, fails on any unexpected
  console/page error.
- `contrast.test.js` — WCAG AA contrast scan of every text node in both themes.
- `dist.test.js` — smoke test against the actual built/minified production bundle (see
  "Production build" above), not the source files the other tests check — catches anything
  the build/minify step itself might break.

`npm test` runs `npm run build` first, so `dist.test.js` always has something to test.
On any test failure, a full-page screenshot is saved to `tests/_failure-artifacts/` and
uploaded as a CI artifact (see `.github/workflows/tests.yml`) for debugging without needing
to reproduce the failure locally.

Runs automatically on every PR via `.github/workflows/tests.yml`. These tests only exercise
the static frontend — they don't need `DATABASE_URL` or any other env var.

## Project layout

```
index.html                         Frontend — the whole site is one page
styles/                           CSS, split into 6 ordered files (load order matters — see
                                   the <link> tags in index.html); was one 4,300-line styles.css
js/                                Frontend JS, split into 8 ordered files (load order matters —
                                   see the <script> tags in index.html); was one 3,760-line app.js.
                                   Classic (non-module) scripts sharing one global scope, same as
                                   when this was a single file.
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

Notable client-only features (no backend, data/config lives in `js/*.js`/`index.html`):
- **Seizure chart** — SVG bar chart of yearly seizure counts (2016–2026) with milestone
  callouts (surgery, VNS, DBS). Data is a static array in `js/04-charts-sims.js` — edit it
  directly to update.
- **Instagram feed** — embedded via [SociableKIT](https://sociablekit.com) (`data-embed-id`
  in `index.html`). Feed content/connection is managed in the SociableKIT dashboard, not
  in this repo.
- **Responsive nav** — collapses to a hamburger below 800px wide, and separately switches
  to a compact layout in landscape on short viewports (phones), including a JS-driven
  fallback for iOS Safari's `orientationchange` timing quirks (see `js/01-nav-theme-cursor.js`).
- **Storm effects + lightning cursor** — ambient thunder/lightning visuals (on by default,
  toggle button in the nav) and an optional lightning-shaped cursor replacement (off by
  default, separate toggle button). Both persist via `localStorage`, both fully disable under
  `prefers-reduced-motion`, and the cursor toggle is hidden entirely on touch/coarse-pointer
  devices. See `js/01-nav-theme-cursor.js` and `js/02-storm-raceclock.js`.
- **Hover/scroll-lift on card elements** — chapter photos, training stat cards, mechanism
  diagram panels, and chapter photo frames lift slightly with a soft shadow on hover (desktop)
  or scroll-into-view (touch), via a shared `.is-lifted` pattern — see
  `initPhotoLiftOnScroll()` in `js/07-admin-mermaid.js`.

## Backend setup (Neon + Vercel)

1. Create a [Neon](https://neon.tech) Postgres database and grab its connection string.
2. Apply the schema (run once per table you need):
   ```bash
   node --env-file=.env.local scripts/seed-site.js          # training/weigh-ins/fundraising/milestones/posts/donors
   psql "$DATABASE_URL" -f sql/comments.sql
   psql "$DATABASE_URL" -f sql/live-track.sql
   psql "$DATABASE_URL" -f sql/marathon-route.sql
   psql "$DATABASE_URL" -f sql/auth-attempts.sql             # rate limit for OWNER_UPDATE_PASSWORD (see api/_db.js)
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
| `SENTRY_DSN` | Optional — enables error tracking for `api/*` serverless functions (see [`api/_db.js`](api/_db.js)'s `reportError`). Unset = no-op, nothing changes. Create a free project at [sentry.io](https://sentry.io), grab its DSN, and set it in Vercel to turn this on. |

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
