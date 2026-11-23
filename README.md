# AirDaybook

AirDaybook helps Delhi-NCR families and community groups plan around winter smog. Enter or import a dated air-quality reading, keep commitments such as school pickup fixed, and compare alternatives for outdoor waiting, travel, and errands. Copy a group note in English or Hindi with the reading and its source.

[Live demo](https://airdaybook.vercel.app/) · [GitHub release checks](https://github.com/NoorRattan/AirDaybook/actions/workflows/release-check.yml)

## Try the demo

1. On **Today**, choose **Try historical replay** to load the 6 November 2026 Delhi example. For your own plan, use **Enter a reading** or **Import JSON**. The selected reading shows its date and source.
2. Open **My Plan**. Enter 15 minutes for the current outdoor wait and 5 for the revised wait. The comparison shows **10 min less outside**, with the 3 pm pickup still in place.
3. Open **Travel** to compare door-to-door routes. With the average motorized road-trip baseline selected, a 12 km Delhi Metro trip shows an estimated **0.29–0.39 kg CO₂ avoided**. Use **Group note** to copy a dated summary.

The demo uses manual and historical readings. The core planner runs without an account, an API key, or a database. **Explore 3D** opens an optional neighbourhood illustration with still viewpoints available offline or when WebGL is unavailable.

## Run locally

Use Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). The website uses Next.js App Router, React, TypeScript, and React Three Fiber. IndexedDB stores readings and drafts locally. To test offline mode, run the production build below.

## AI preference suggestions

The manual planner works with AI disabled. To enable Groq, configure these variables in the server process. Store the credential in your local environment or hosting secret store.

| Variable | Value |
| --- | --- |
| `APP_ORIGIN` | Exact browser origin, such as `http://localhost:3000` locally or your HTTPS origin in staging |
| `RELEASE_ID` | Revision or image identifier written to redacted operational logs |
| `AI_ENABLED` | `true` to enable suggestions |
| `GROQ_API_KEY` | The server-side Groq credential |
| `GROQ_MODEL` | Defaults to `openai/gpt-oss-20b` |
| `AI_DAILY_LIMIT` | Positive daily cap on upstream requests |
| `AI_MAX_CONCURRENT` | Positive cap on simultaneous requests |
| `AI_BURST_PER_MINUTE` | Positive cap on requests per minute |
| `AI_QUOTA_DB_PATH` | Absolute path to a SQLite database in an existing writable directory |
| `AI_QUOTA_DATABASE_URL` | Shared Postgres quota database on Vercel. Also reads the integration's `DATABASE_URL` or `POSTGRES_URL`. |
| `AI_PROVIDER_TIMEOUT_MS` | Optional deadline in milliseconds, defaults to 8000 |

The AI proposes changes to four editable preferences and waits for confirmation before applying them. The request contains the follow-up text, four editable preference values, and an opaque revision ID. Fixed commitments, readings, and group notes stay in the browser. Run one app instance per SQLite quota disk. Postgres coordinates the daily, burst and concurrent limits across instances. The hosted demo currently runs in manual mode.

## Verify

```sh
npm run typecheck
npm test
npm run build
npm run test:api
```

The domain tests cover reading provenance and freshness, fixed commitments, wait and travel calculations, privacy in group notes, and the model response contract. Use `npm run test:coverage` to see coverage for the exercised domain modules. The API suite starts the production standalone server, uses a temporary SQLite quota database, and substitutes a local provider fixture. It covers validation, provider failures, timeouts, quotas, and redacted logs without sending requests to Groq.

Build and start the same standalone Linux image used by GitHub Actions.

```sh
docker build --platform linux/amd64 -t airdaybook .
docker run --rm -p 127.0.0.1:3000:3000 -e AI_ENABLED=false airdaybook
```

`GET /api/health` reports core app readiness. If you enable AI with SQLite in Docker, mount a writable volume at `/var/data` and set `AI_QUOTA_DB_PATH` to a file there.

With the production server running, use `node scripts/smoke-release.mjs http://127.0.0.1:3000` to verify both routes and the offline assets. Install Chromium with `npx playwright-core install chromium`, then run `npm run test:browser`. The browser suite checks keyboard focus, axe WCAG checks for opened tools, edits from two tabs, offline editing, unsafe reading URLs, the Metro estimate, bilingual notes, and WebGL fallbacks. Set `AIRDAYBOOK_TEST_ORIGIN` if the server uses a different origin. GitHub Actions verifies the domain and API contracts on Node 24 and runs the smoke and browser tests against the Linux image.

## Deploy the free preview on Vercel

Import the GitHub repo into a Vercel Hobby workspace with Next.js as the preset. Use Node.js 24 and `npm run build` so deployment includes the generated offline worker. Manual mode can deploy without environment variables. To enable AI on Vercel, attach a shared Postgres database such as Neon Free, save `GROQ_API_KEY` as a sensitive server-side variable, and set `AI_ENABLED=true` and the three AI limits. The production domain can be inferred from Vercel's system environment variables or set explicitly with `APP_ORIGIN`.

The Postgres adapter creates two quota tables on first use. They contain daily counts and short-lived request leases. The database connection fails closed, and quota failures leave the manual planner available. Verify the HTTPS release with `node scripts/smoke-release.mjs` followed by the deployment origin.

Use `ai_configuration` events to check whether the server accepted its runtime settings. Use `plan_revision` events to distinguish provider failures, timeouts, quota-store failures, and usage limits. The core health endpoint stays independent of AI.

## Offline planner

Open either page on the local production image or an HTTPS deployment. Wait for **Available offline** in the footer. Both pages, the Delhi replay, reading imports, manual edits, route comparisons and community notes work offline. Drafts stay in IndexedDB. AI suggestions require a connection.

The production build emits the versioned service worker. An installed update offers **Load saved update** once its complete shell has been downloaded and checked. The existing shell remains available while the next version installs.
