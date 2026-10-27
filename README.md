# CivicEco

CivicEco is a full-stack community environmental intelligence platform.

## Current features
- Interactive environmental issue map
- Community reports and evidence
- Accounts and persistent local JSON backend
- Community confirmations, follows, comments, and notifications
- Evidence verification signals
- Environmental context from public data services
- Priority scoring, temporal patterns, geographic hotspots, and early-warning signals
- Insights dashboard
- Community response plans
- Response participation with join/leave controls
- Shared response tasks
- Progress check-ins and measurement tracking
- Personal Community Center

## Run locally

Install dependencies:

```bash
npm install
```

Run the frontend:

```bash
npm run dev
```

Run the backend in another terminal:

```bash
npm run server
```

The Vite development server proxies `/api` requests to the backend.

## Response participation

Signed-in members can create response plans, join existing plans, complete shared tasks, and record progress check-ins. Response data is stored in the backend JSON database under `data/civiceco.json`.

## Note

This project uses explainable decision-support rules. It should not be presented as predicting environmental events or proving causation unless a validated model and supporting evidence are added later.


## Final engineering upgrades

- Environment-based server configuration via `.env.example`
- API rate limiting and request IDs
- Security headers and JSON size limits
- Session expiration
- Atomic database writes with optional backups
- API error handling
- Input validation for account creation
- Smoke tests via `npm test`
- Security, privacy, architecture, and testing documentation
- PWA manifest and offline shell fallback
- Clean `.gitignore` for secrets, local database files, and build artifacts

## Data-source note

Public environmental data is used as context. CivicEco's scoring is explainable decision support, not a certified environmental model.
