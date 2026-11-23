# AirDaybook

AirDaybook is a Delhi-NCR air-quality journal and planner. It shows the provenance of manually entered or imported readings, includes a dated Delhi replay, and compares outdoor waiting time around a fixed commitment.

## Run locally

Use Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). Use **Today** to choose a reading and **My Plan** to compare waiting estimates. Your reading and plan are stored in the browser. The optional 3D illustration is independent of AQI.

## Verify

```sh
npm run typecheck
npm run build
```
