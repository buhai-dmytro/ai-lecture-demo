# Agent Assist Dashboard

Internal customer support console that aggregates user profile details and recent activity logs to accelerate ticket resolution.

## Features

- Prominent search bar for email or userId lookups
- Profile card with account status, tier, device, and app version
- Activity log table with error highlighting
- Quick actions panel that logs actions to the console
- Mock data API that returns realistic profiles and recent activity

## Local Development

Install dependencies (already installed during scaffolding):

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open the app in your browser at localhost:3000.

## Mock API

The dashboard calls a mock API route at `/api/agent?query=...`.

Example queries:

- `alex@company.com`
- `usr_3a2f9b7c`
- `notfound@example.com` (returns a User Not Found state)
