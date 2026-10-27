# CivicEco Final Audit

This archive is the final consolidated CivicEco source project.

## Consolidated features
- Real Leaflet + OpenStreetMap map
- Environmental issue reporting
- Browser location support for reports
- Optional image evidence
- Account creation, login, logout, and expiring sessions
- Persistent local JSON backend
- Community confirmations with one confirmation per account
- Issue following
- Community comments
- Notifications
- Evidence/confidence signals and duplicate indicators
- Public environmental context from NWS and USGS
- Explainable impact scoring
- Geographic hotspot detection
- Seven-day temporal trend detection
- Early-warning signals
- Insights analytics
- Community action plans
- Response participation
- Shared response tasks
- Progress check-ins
- Before/after observable outcome measurement
- Community Center
- Contribution history and milestones
- PWA manifest and offline shell
- Security headers, rate limiting, request IDs, input limits, atomic writes, optional backups
- README, architecture, privacy, security, and testing documentation
- Smoke tests

## Verification completed in this environment
- `node --check server.js` passed
- `node --check tests/smoke.mjs` passed
- `npm test` passed
- Package name and lockfile name are both `civiceco`
- No stale SchoolSync references remain in source/config files
- No nested duplicate project directory is included
- Required local imports were checked

## Important limitation
A complete `npm ci` / production Vite build could not be executed in this environment because dependency installation timed out. The archive therefore intentionally excludes `node_modules` and `dist`.

After extracting the project locally:

```bash
npm install
npm test
npm run lint
npm run build
```

Then run the backend and frontend as described in `README.md`.
