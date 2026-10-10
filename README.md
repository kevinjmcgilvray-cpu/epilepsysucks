# Epilepsy Sucks

Kevin's story site for the LA Marathon / CURE Epilepsy — hosted at [epilepsysucks.org](https://epilepsysucks.org).

A multi-page static site (19 real pages, listed below) backed by a small set of Vercel
serverless functions (`api/`) and a Neon Postgres database, powering the live fundraising
bar, weigh-in chart, training log (manually logged + auto-synced from Strava), milestones,
comments, and the "Live Track" race-day radar.

Every page shares the same nav/footer/race-clock chrome via `<!-- INCLUDE:partials/xxx.html -->`
markers, resolved by `scripts/build.js` before anything deploys — there's still exactly one
copy of each shared piece to edit, not 19. See "Project layout" below for the current page
list and `partials/` contents.

Also on the site: a seizure-frequency chart (2016–2026, static data in `js/04-charts-sims.js`),
a live Instagram feed (via a SociableKIT embed) and a Facebook Page feed on `/community`, an
interactive course-map/pace calculator for the marathon, and a mobile/desktop nav that adapts
for narrow screens, landscape phones, and wide-but-short viewports (e.g. iPhone Pro Max
landscape).

## Local preview

Unlike the frontend JS/CSS (which are plain, unbundled files you could once serve directly),
every HTML page now contains unresolved `<!-- INCLUDE:... -->` partial markers — so **you
need to build before previewing**, even locally:

```bash
npm run build                  # resolves partials + bundles styles/js into dist/
python3 -m http.server 4200 --directory dist
# then open http://localhost:4200
```

Anything that talks to `/api/*` (fundraising totals, weigh-ins, training runs, comments,
live track) needs the API layer running too — see "Backend setup" below.

## Production build

Deployed production runs the same build step (`npm run build`, configured as Vercel's
`buildCommand` in `vercel.json`), not the raw source files. For every page in `scripts/build.js`'s
`PAGES` list, it resolves each `<!-- INCLUDE:partials/xxx.html -->` marker, concatenates +
minifies `styles/*.css` into `dist/styles/app.min.css` and `js/*.js` into `dist/js/app.min.js`
(preserving the exact load order each page's `<link>`/`<script>` tags already use — this is
deliberately *not* a real module bundler, just fewer requests + a smaller payload), copies
every other static file through unchanged, and rewrites each page's bundle tags to match.
`api/` is untouched — Vercel deploys it as serverless functions regardless of `outputDirectory`.
See `scripts/build.js` for the full logic.

```bash
npm run build   # outputs to dist/ (19 pages)
```

## Tests

```bash
npm install
npx playwright install --with-deps chromium   # once per machine
npm test
```

`tests/` is a small Playwright-based suite (no test framework, just plain scripts +
`tests/_assert.js`) that spins up a static server for the built `dist/` output and checks:

- `regression.test.js` — thunder-sound toggle (muted/off by default, no confirmation step)
  and lightning-cursor toggle (off by default) behavior, persistence across reload,
  `prefers-reduced-motion` correctly gating the motion-based cursor toggle but *not* the
  audio-only thunder toggle, the 4 distinct thunder audio sources, nav dropdown behavior
  (direct link navigation + hover/tap-to-expand caret), and mobile header layout.
- `smoke.test.js` — scrolls every page (all 19 routes) in both themes, fails on any
  unexpected console/page error.
- `contrast.test.js` — WCAG AA contrast scan of every text node, every page, both themes.
- `touch-targets.test.js` — WCAG 2.5.8 scan ensuring every real interactive element has a
  48×48 CSS-pixel (or larger) tap target at mobile widths, across every page.
- `dist.test.js` — smoke test against the actual built/minified production bundle (see
  "Production build" above), not the unminified per-file sources — catches anything the
  build/bundle/minify step itself might break.

`npm test` runs `npm run build` first, so every test always has a real `dist/` to check.
On any test failure, a full-page screenshot is saved to `tests/_failure-artifacts/` and
uploaded as a CI artifact (see `.github/workflows/tests.yml`) for debugging without needing
to reproduce the failure locally.

Runs automatically on every PR via `.github/workflows/tests.yml`. These tests only exercise
the static frontend — they don't need `DATABASE_URL` or any other env var.

## Project layout

```
index.html, journey.html, recovery.html,  Top-level hub pages, each with its own set of
  marathon.html, community.html,          nested sub-pages (see below) — see
  resources.html, about.html, privacy.html  scripts/build.js's PAGES list for the full,
                                           authoritative list of all 19 built routes.
journey/                                  diagnosis.html, timeline.html, surgeries.html
recovery/                                 mindset.html, dbs-tuning.html, weight-loss.html
marathon/                                 mission.html, training-log.html, fundraising.html
community/                                guestbook.html, contact.html
partials/                                 Shared chrome, spliced into every page by
                                           scripts/build.js: head-assets.html, chrome-pre-
                                           nav.html, nav.html, chrome-bottom.html
sitemap.xml                               Lists every one of the 19 routes above
styles/                                   CSS, split into 6 ordered files (load order
                                           matters — see partials/head-assets.html)
js/                                        Frontend JS, split into 8 ordered files (load
                                           order matters — see partials/chrome-bottom.html).
                                           Classic (non-module) scripts sharing one global
                                           scope.
api/                                       Vercel serverless functions (Neon-backed)
  _db.js                                  Shared helpers: SQL client, CORS, password check,
                                           sanitizing, opt-in Sentry error reporting
  _strava.js                              Strava OAuth token refresh + activity sync,
                                           shared by training.js
  raised.js                               Fundraising totals (scrapes Haku, caches in Neon)
  donors.js                               Recent donor names for the "thank you" ticker
  training.js, weigh-ins.js               Training log (manual + Strava-synced) + weigh-in
                                           log (read + owner-password write)
  milestones.js                           Timeline milestones (read + owner-password write)
  update.js                               Owner status-update posts
  comments.js, moderate.js                Public comments + owner moderation
  live-track.js                           Race-day GPS "Live Track" radar
  marathon-route.js                       "Stadium to the Stars" route geometry for the map
  maps-config.js                          Bootstraps the map (Google Maps key, or MapLibre
                                           fallback)
sql/                                       Schema for each table (site, comments, live-track,
                                           route, Strava auth, login-attempt rate limiting)
scripts/                                   build.js (see above), plus one-off Node scripts to
                                           seed/import data into Neon (seed-site.js,
                                           seed-marathon-route.js, import-apple-runs.js)
data/                                      Static route data (LA Marathon course)
epilepsy-sucks-audio/, epilepsy-sucks-images/, qr-codes/   Static media assets
```

Notable client-only features (no backend, data/config lives in `js/*.js`/the HTML pages):
- **Seizure chart** — SVG bar chart of yearly seizure counts (2016–2026) with milestone
  callouts (surgery, VNS, DBS). Data is a static array in `js/04-charts-sims.js` — edit it
  directly to update.
- **Instagram + Facebook feeds** — embedded via [SociableKIT](https://sociablekit.com) and
  the Facebook Page Plugin respectively (`/community`). Feed content/connection for the
  Instagram one is managed in the SociableKIT dashboard, not in this repo.
- **Responsive nav** — collapses to a hamburger below 800px wide, and separately switches
  to a compact layout in landscape on short viewports (phones), including a JS-driven
  fallback for iOS Safari's `orientationchange` timing quirks (see `js/01-nav-theme-cursor.js`).
- **Thunder sound + lightning cursor toggles** — an optional, muted-by-default ambient
  thunder sound effect, and a separate optional lightning-shaped cursor replacement (also
  off by default). Both persist via `localStorage`. The cursor toggle (genuinely motion-
  based) is hidden under `prefers-reduced-motion` and on touch/coarse-pointer devices; the
  thunder toggle (audio, not motion) deliberately isn't gated by either, since an audio
  preference isn't a motion one. There is no flashing/strobing visual effect anywhere on
  the site — see `js/01-nav-theme-cursor.js` and `js/02-storm-raceclock.js`.
- **Hover/scroll-lift on card elements** — chapter photos, training stat cards, mechanism
  diagram panels, and chapter photo frames lift slightly with a soft shadow on hover (desktop)
  or scroll-into-view (touch), via a shared `.is-lifted` pattern — see
  `initPhotoLiftOnScroll()` in `js/07-admin-mermaid.js`.
- **"Behind the code" diagrams** (`/community`) — 3 lazy-loaded Mermaid.js diagrams (site
  architecture, the one-page-to-many-pages history, and a roadmap of the project's PR
  history) rendered client-side only once their `<details>` panel is actually opened.

## Backend setup (Neon + Vercel)

1. Create a [Neon](https://neon.tech) Postgres database and grab its connection string.
2. Apply the schema (run once per table you need):
   ```bash
   node --env-file=.env.local scripts/seed-site.js          # training/weigh-ins/fundraising/milestones/posts/donors
   psql "$DATABASE_URL" -f sql/comments.sql
   psql "$DATABASE_URL" -f sql/live-track.sql
   psql "$DATABASE_URL" -f sql/marathon-route.sql
   psql "$DATABASE_URL" -f sql/auth-attempts.sql             # rate limit for OWNER_UPDATE_PASSWORD (see api/_db.js)
   psql "$DATABASE_URL" -f sql/strava.sql                    # Strava OAuth token storage (optional)
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
| `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` | Optional — enables auto-syncing training runs from Strava (see `api/_strava.js`). The refresh token itself lives in the `strava_auth` DB row, not an env var, since Strava rotates it on every refresh. |
| `SENTRY_DSN` | Optional — enables error tracking for `api/*` serverless functions (see [`api/_db.js`](api/_db.js)'s `reportError`). Unset = no-op, nothing changes. **Currently force-disabled in code regardless of this variable** via the `SENTRY_DISABLED` constant at the top of `api/_db.js` — flip that back to `false` to re-enable even with a DSN already configured. |

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
