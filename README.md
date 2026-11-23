# AirDaybook

AirDaybook is a Delhi-NCR air-quality journal and planner. It shows the provenance of manually entered or imported readings, includes a dated Delhi replay, and compares outdoor waiting time around a fixed commitment.

## Run locally

Use Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). Use **Today** to choose a reading and **My Plan** to compare waiting estimates. Your reading and plan are stored in the browser. The optional 3D illustration is independent of AQI.

In **My Plan**, enter door-to-door times for two routes. The Delhi Metro CO₂ estimate uses your one-way rail distance and an average motorized road-trip baseline, with both methods cited in the result. Use **Community share** to preview and copy a dated reading and group action in English or Hindi. The note starts with the selected reading. Add any group details you want to share.

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
| `AI_PROVIDER_TIMEOUT_MS` | Optional deadline in milliseconds, defaults to 8000 |

The AI proposes changes to four editable preferences. Apply a proposal explicitly to update them. Fixed commitments and readings stay in the planner. Run one app instance per quota disk.

## Verify

```sh
npm run typecheck
npm run build
```

The included Dockerfile builds a standalone Linux image. Mount a writable volume at `/var/data` for the quota database and set the runtime variables when starting the container. `GET /api/health` reports core app readiness.

## Stage a release image

Build the candidate for `linux/amd64`. Start it with `AI_ENABLED=false` and run `node scripts/smoke-release.mjs http://127.0.0.1:3000` against the published port. The GitHub release check runs the same smoke test. It verifies the health response, both pages, and the bytes of each asset in the offline manifest.

Publish the tested image to the authorized registry and use its `repository@sha256:…` reference for the Render Singapore web service. Set the HTTP health check to `/api/health`, use one paid instance with a disk mounted at `/var/data`, and set `RELEASE_ID` to the candidate revision. Set the service’s HTTPS origin in `APP_ORIGIN`. Keep AI disabled until the quota disk, ingress controls, environment-specific secret, and usage caps are verified. Run the smoke script again against the Render HTTPS origin. Promote the same digest to production after staging passes. [Render prebuilt images](https://render.com/docs/deploying-an-image) · [Render persistent disks](https://render.com/docs/disks)

Use `ai_configuration` events to check whether the server accepted its runtime settings. Use `plan_revision` events to distinguish provider HTTP failures, timeouts, quota-store failures and usage limits. The core health endpoint stays independent of AI. Keep earlier image digests available for rollback, and retain the same quota disk when replacing an image.

## Offline planner

Run `npm run build` followed by `npm start` to test the offline planner. Open either page in a browser on localhost or an HTTPS origin. Wait for **Available offline** in the footer. Both pages, the Delhi replay, reading imports, manual edits, route comparisons and community notes work offline. Drafts stay in IndexedDB. AI suggestions require a connection.

The production build emits the versioned service worker. An installed update offers **Load saved update** once its complete shell has been downloaded and checked. The existing shell remains available while the next version installs.
