# AirDaybook

AirDaybook is a Delhi-NCR air-quality journal and planner. It shows the provenance of manually entered or imported readings, includes a dated Delhi replay, and compares outdoor waiting time around a fixed commitment.

## Run locally

Use Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). Use **Today** to choose a reading and **My Plan** to compare waiting estimates. Your reading and plan are stored in the browser. The optional 3D illustration is independent of AQI.

## AI preference suggestions

The manual planner works with AI disabled. To enable Groq, configure these variables in the server process. Store the credential in your local environment or hosting secret store.

| Variable | Value |
| --- | --- |
| `APP_ORIGIN` | Exact browser origin, such as `http://localhost:3000` locally or your HTTPS origin in staging |
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
