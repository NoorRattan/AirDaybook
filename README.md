# AirDaybook

AirDaybook is a Delhi-NCR air-quality journal and planner. It shows the provenance of manually entered or imported readings, includes a dated Delhi replay, and compares outdoor waiting time around a fixed commitment.

## Run locally

Use Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). Use **Today** to choose a reading and **My Plan** to compare waiting estimates. Your reading and plan are stored in the browser. The optional 3D illustration is independent of AQI.

In **My Plan**, enter a fixed commitment and compare outdoor waiting times. Use the preferences, route comparison and group note sections as needed. The suggested actions use the preferences you confirm. The Delhi Metro CO₂ estimate uses your one-way rail distance and an average motorized road-trip baseline. Group notes support English and Hindi and include the reading and group details you enter in that section.

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

The AI proposes changes to four editable preferences. Apply a proposal explicitly to update them. Fixed commitments and readings stay in the planner. Run one app instance per SQLite quota disk. Postgres coordinates the daily, burst and concurrent limits across instances.

## Verify

```sh
npm run typecheck
npm run build
```

The included Dockerfile builds a standalone Linux image. Mount a writable volume at `/var/data` for the quota database and set the runtime variables when starting the container. `GET /api/health` reports core app readiness.

The release workflow runs browser checks against the built image, including keyboard interaction, axe WCAG checks, offline editing, unsafe reading URLs, and WebGL failure. To run locally, install Chromium with `npx playwright-core install chromium` and use `npm run test:browser` against a running production build. Set `AIRDAYBOOK_TEST_ORIGIN` if it listens somewhere other than `http://127.0.0.1:3000`.

## Deploy the free preview on Vercel

Import the GitHub repo into a Hobby workspace with Next.js as the preset. Use Node.js 24 and `npm run build` so the deployment includes the generated offline worker. Connect a Neon Free database to the production environment. Keep `GROQ_API_KEY` server-side in Vercel as a sensitive production variable. Set `AI_ENABLED=true` together with the three AI limits when the database and Groq key are ready. Preview deployments can keep AI disabled. The production domain can be inferred from Vercel's system environment variables, or set explicitly with `APP_ORIGIN`.

The Postgres adapter creates two quota tables on first use. They contain daily counts and short-lived request leases. The database connection fails closed, and quota failures leave the manual planner available. Verify the HTTPS release with `node scripts/smoke-release.mjs` followed by the deployment origin.

## Stage a release image

Build the candidate for `linux/amd64`. Start it with `AI_ENABLED=false` and run `node scripts/smoke-release.mjs http://127.0.0.1:3000` against the published port. The GitHub release check runs the same smoke test. It verifies the health response, both pages, and the bytes of each asset in the offline manifest.

Publish the tested image to the authorized registry and use its `repository@sha256:…` reference for the Render Singapore web service. Set the HTTP health check to `/api/health`, use one paid instance with a disk mounted at `/var/data`, and set `RELEASE_ID` to the candidate revision. Set the service’s HTTPS origin in `APP_ORIGIN`. Keep AI disabled until the quota disk, ingress controls, environment-specific secret, and usage caps are verified. Run the smoke script again against the Render HTTPS origin. Promote the same digest to production after staging passes. [Render prebuilt images](https://render.com/docs/deploying-an-image) · [Render persistent disks](https://render.com/docs/disks)

Use `ai_configuration` events to check whether the server accepted its runtime settings. Use `plan_revision` events to distinguish provider HTTP failures, timeouts, quota-store failures and usage limits. The core health endpoint stays independent of AI. Keep earlier image digests available for rollback, and retain the same quota disk when replacing an image.

## Offline planner

Run `npm run build` followed by `npm start` to test the offline planner. Open either page in a browser on localhost or an HTTPS origin. Wait for **Available offline** in the footer. Both pages, the Delhi replay, reading imports, manual edits, route comparisons and community notes work offline. Drafts stay in IndexedDB. AI suggestions require a connection.

The production build emits the versioned service worker. An installed update offers **Load saved update** once its complete shell has been downloaded and checked. The existing shell remains available while the next version installs.
