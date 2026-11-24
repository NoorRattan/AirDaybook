# Security policy

Use [GitHub private vulnerability reporting](https://github.com/NoorRattan/AirDaybook/security/advisories/new) for a suspected vulnerability in AirDaybook. Include the affected release, the impacted component, the expected and observed behavior, and enough detail for a maintainer to investigate. Use synthetic examples and omit credentials, household data and other people's information.

This policy covers the source in this repository and the [official hosted demo](https://airdaybook.vercel.app/). Use a local instance with synthetic data for testing controls that could affect availability, service costs or other people. Reports about upstream providers should go to the affected provider unless AirDaybook's integration contributes to the issue.

## Security boundaries

- Readings, household options, saved activities and fixed commitments stay in browser storage. A user can explicitly submit up to 500 characters and four planning preferences to the AI revision endpoint. A separate city lookup sends the selected city to the configured data service.
- Treat external data, imported JSON and AI output as untrusted. A revision can propose supported preferences and activities grounded in the submitted text. Saved plan changes require user confirmation, and revisions preserve fixed commitments and existing activities.
- Provider and database credentials stay on the server. Quota storage tracks counters and salted identifiers, independent of submitted revision text or saved plans.

Report issues that cross these boundaries, expose data or credentials, modify plans without consent, or create material service disruption. Ordinary product bugs can go through GitHub Issues with synthetic examples.
