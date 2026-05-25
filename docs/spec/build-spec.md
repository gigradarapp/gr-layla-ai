# Build Spec

Date: 2026-05-25

## Implemented Stack

- React
- Vite
- TypeScript
- TanStack Router
- TanStack Query
- TanStack Table
- Express
- SQLite via `better-sqlite3`
- Zod
- lucide-react
- Playwright for local QA

## Implemented Routes

- `/`
- `/chat`
- `/discover`
- `/trips`
- `/trips/:tripId`
- `/book`
- `/dashboard`

## Implemented API

- `GET /health`
- `GET /api/destinations`
- `GET /api/destinations/:id`
- `GET /api/trips`
- `POST /api/trips`
- `GET /api/trips/:id`
- `PATCH /api/trips/:id`
- `POST /api/trips/:id/refine`
- `GET /api/trips/:id/messages`
- `POST /api/trips/:id/messages`
- `GET /api/offers`
- `GET /api/dashboard/summary`
- `GET /api/dashboard/trips`
- `GET /api/dashboard/messages`
- `POST /api/agent/chat`
- `POST /api/agent/plan`

## Implemented SQLite Tables

- `users`
- `destinations`
- `trips`
- `trip_days`
- `activities`
- `chat_messages`
- `offers`
- `trip_refinements`

## Implemented Demo Data

Seed trips:

- Singapore to Tokyo/Kyoto food and culture trip.
- Singapore to Bali wellness weekend.
- Singapore to Seoul friends trip.

Seed destinations:

- Tokyo
- Kyoto
- Bali
- Seoul
- Queenstown
- Lisbon
- Jordan
- Maldives

Seed offer types:

- flights
- hotels
- activities

## Implemented Core Flows

1. Plan a trip from `/` or `/chat`.
2. Capture or infer checklist fields from chat.
3. Run backend travel agent.
4. Call OpenAI Responses API when `OPENAI_API_KEY` is configured, with local deterministic fallback.
5. Execute local tool-style steps against SQLite: parse intent, search destinations, rank options, scan offers, save trip.
6. Save generated trip to SQLite.
7. Open generated trip from the generated card or `/trips`.
8. Inspect itinerary by day/activity.
9. Refine itinerary from `/trips/:tripId`.
10. Browse destination cards from `/discover`.
11. Inspect booking-style offers from `/book`.
12. Inspect operator metrics and table from `/dashboard`.

## Scripts

```bash
npm install
npm run db:seed
npm run dev
npm run build
npm run smoke:api
```

## Environment Handling

The app can run without API keys through deterministic fallbacks.

Agentic chat and trip generation use these optional local env keys when present:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`

Ignored by Git:

- `.env`
- `.env.*`
- `,env`
- `data/*.db`
- `docs/qa/*.png`

## Verification Performed

- `npm install`
- `npm run db:seed`
- `npm run build`
- API smoke checks against a running API server
- Playwright screenshots:
  - desktop home
  - mobile home
  - desktop dashboard
- Playwright interaction smoke:
  - load home;
  - create trip;
  - open itinerary;
  - refine itinerary;
  - load discover;
  - load book;
  - load dashboard;
  - fail if console errors appear.
