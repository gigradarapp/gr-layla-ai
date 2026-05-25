# Layla.ai Research and Replication Plan

Date: 2026-05-25  
Repo: `gr-layla-ai`  
Mode: Planning only. No app scaffold or implementation in this step.

## Objective

Create a credible Layla-style AI travel planner demo by first building a strong research base, then replicating the product experience with a simple full-stack web app.

The goal is not to copy Layla's proprietary brand or live integrations. The goal is to reproduce the product pattern:

- chat-first travel planning;
- inspiration-to-itinerary flow;
- destination/video-style discovery;
- flight, hotel, and activity recommendation cards;
- saved trips;
- operator-facing visibility into generated trips and user intent.

## Current Repo State

The repo currently contains:

- `README.md`
- `docs/research/layla-ai-product-study.md`
- `docs/research/assets/*` reference screenshots
- untracked local `,env`

There is no existing app implementation to preserve.

## Track A: Research Plan

### Research Questions

1. What problem does Layla solve better than a generic chatbot?
2. Which user segments are most likely to use and pay for an AI travel planner?
3. What UX/UI patterns make Layla feel fast, friendly, and trustworthy?
4. Which features are core to the product experience versus nice-to-have polish?
5. What monetization paths are realistic for a small team?
6. What should the demo prove to a user, investor, or potential customer?

### Sources to Study

Primary product sources:

- Layla homepage.
- Layla about page.
- Layla FAQ.
- Apple App Store listing.
- Google Play listing.
- Public app screenshots.

Market and competitor sources:

- Layla press and growth announcements.
- TechCrunch coverage on launch and Roam Around acquisition.
- AI travel adoption research from Kaspersky, Phocuswright/PhocusWire, McKinsey/Skift.
- Competitor public surfaces: Mindtrip, GuideGeek, Wanderlog, KAYAK/Expedia AI features where relevant.

Reference assets:

- Existing screenshots in `docs/research/assets`.
- Additional screenshots if needed for desktop/mobile web surfaces.

### Research Outputs

1. Product study
   - Problem, solution, audience, positioning, UX/UI, monetization, risks.
   - Existing file: `docs/research/layla-ai-product-study.md`.

2. UX/UI teardown
   - Visual language.
   - Navigation model.
   - Chat flow.
   - Destination card anatomy.
   - Booking card anatomy.
   - Trust signals.
   - Mobile and desktop behavior.

3. Competitor matrix
   - Layla vs Mindtrip vs GuideGeek vs Wanderlog vs general chatbots.
   - Compare on discovery, planning, maps, collaboration, booking, grounding, and monetization.

4. Product scope map
   - MVP features.
   - Demo features.
   - Deferred production features.
   - Explicit non-goals.

5. Build spec
   - Routes.
   - Components.
   - Data model.
   - API endpoints.
   - Seed data scenarios.
   - QA checklist.

### Research Acceptance Criteria

Research is considered complete when:

- all major claims in the product study have source links;
- at least four reference screenshots are saved locally;
- target audience and wedge strategy are explicit;
- core flows are mapped from landing to saved itinerary;
- MVP feature list is separated from future production features;
- the replication plan can be executed without guessing the app structure.

### Research Risks

- Public screenshots may not show the full in-app product.
- Layla's actual internal AI and booking integrations are not observable.
- Public marketing claims may not reflect actual retained usage.
- Market reports can overstate AI adoption; the demo should still be grounded in actual user jobs.

Mitigation:

- Build a demo that proves workflow quality, not unverified scale.
- Mark live data, booking, payment, and account systems as simulated.
- Avoid making claims the demo cannot support.

## Track B: Replication Plan

### Product Direction

Build a Layla-style web demo called `Layla-style AI Trip Planner Demo`.

The demo should feel like a working travel-planning product, not a marketing landing page. The first screen should let users plan a trip immediately.

### Design Direction

Use the observed Layla UI language without copying proprietary assets:

- white/light background;
- bold high-contrast typography;
- lavender emphasis for key words;
- teal/turquoise action buttons and chat chips;
- vivid travel imagery;
- rounded chat bubbles and soft shadows;
- mobile-inspired panels inside a responsive desktop layout;
- friendly assistant persona;
- destination and booking cards as the primary visual objects.

Do not directly copy:

- Layla logo;
- proprietary brand illustrations;
- partner logos as if they are real integrations;
- exact marketing claims that imply live booking partnerships.

### Simple Tech Stack

Frontend:

- React
- Vite
- TypeScript
- TanStack Router
- TanStack Query
- TanStack Table
- lucide-react
- CSS with shared design tokens

Backend:

- Node.js
- Express
- SQLite
- `better-sqlite3`
- Zod for request validation

QA:

- TypeScript build
- API smoke checks
- Playwright browser smoke test and screenshots

Reasoning:

- TanStack Router covers typed client routing.
- TanStack Query handles API state and cache invalidation.
- TanStack Table gives the operator dashboard real table behavior.
- Express + SQLite is faster and simpler than introducing a heavier full-stack framework now.
- TanStack Start can be revisited after the demo proves the product flow.

## Proposed App Structure

```text
.
├── docs/
│   ├── plan/
│   └── research/
├── server/
│   ├── db/
│   │   ├── schema.sql
│   │   ├── seed.ts
│   │   └── sqlite.ts
│   ├── routes/
│   │   ├── destinations.ts
│   │   ├── offers.ts
│   │   └── trips.ts
│   └── index.ts
├── src/
│   ├── components/
│   ├── features/
│   │   ├── booking/
│   │   ├── chat/
│   │   ├── dashboard/
│   │   ├── discover/
│   │   └── trips/
│   ├── lib/
│   │   ├── api.ts
│   │   ├── format.ts
│   │   └── queryClient.ts
│   ├── routes/
│   ├── styles/
│   │   └── app.css
│   ├── main.tsx
│   └── routeTree.gen.ts
├── package.json
└── vite.config.ts
```

## Planned Routes

1. `/`
   - App-first planning home.
   - Chat prompt, quick-start modes, inspiration cards, saved trip preview.

2. `/chat`
   - Full chat planner.
   - Clarifying questions.
   - Simulated generation progress.
   - Generated trip preview.

3. `/discover`
   - Destination inspiration cards.
   - Filters for vibe, budget, weather, traveler type, duration.

4. `/trips`
   - Saved trips list.
   - Search/filter/sort.
   - Trip status and cost summary.

5. `/trips/:tripId`
   - Day-by-day itinerary.
   - Activities, timings, estimates, confidence labels.
   - Refinement actions.

6. `/book`
   - Flight, hotel, activity cards.
   - Simulated provider handoff.

7. `/dashboard`
   - Operator view.
   - TanStack Table for trips/messages/segments.
   - Basic conversion and intent metrics from SQLite seed data.

## Planned SQLite Schema

Tables:

- `users`
- `trips`
- `trip_days`
- `activities`
- `chat_messages`
- `destinations`
- `offers`
- `trip_refinements`

The schema should support:

- saving generated trips;
- showing trip detail pages;
- showing chat history;
- listing destination inspiration;
- surfacing simulated flight/hotel/activity offers;
- powering an operator dashboard.

## Planned API Endpoints

Destinations:

- `GET /api/destinations`
- `GET /api/destinations/:id`

Trips:

- `GET /api/trips`
- `POST /api/trips`
- `GET /api/trips/:id`
- `PATCH /api/trips/:id`
- `POST /api/trips/:id/refine`

Chat:

- `GET /api/trips/:id/messages`
- `POST /api/trips/:id/messages`

Offers:

- `GET /api/offers`
- `GET /api/offers?tripId=:tripId`

Dashboard:

- `GET /api/dashboard/summary`
- `GET /api/dashboard/trips`
- `GET /api/dashboard/messages`

## Demo Data Plan

Seed trips:

- Singapore to Tokyo/Kyoto food and culture trip.
- Singapore to Bali wellness weekend.
- Singapore to Seoul friends trip.
- Singapore to New Zealand road trip.
- Europe family trip with low walking tolerance.

Seed destination cards:

- Tokyo
- Kyoto
- Bali
- Seoul
- Queenstown
- Lisbon
- Amman/Jordan
- Maldives

Seed offers:

- flights with provider, price, layover, duration;
- hotels with rating, nightly price, perks;
- activities with duration, cost, and category.

## Implementation Milestones

### Phase 0: Setup

Deliverables:

- `package.json`
- Vite React TypeScript setup
- Express dev server
- SQLite database files
- base scripts

Acceptance criteria:

- `npm install` succeeds;
- `npm run dev` starts frontend and API;
- health endpoint responds.

### Phase 1: Database and API

Deliverables:

- schema;
- seed script;
- API route modules;
- Zod validation;
- typed frontend API client.

Acceptance criteria:

- destinations, trips, trip detail, messages, offers, and dashboard endpoints return seeded data;
- creating a trip writes to SQLite;
- refining a trip updates SQLite.

### Phase 2: Design System

Deliverables:

- global CSS tokens;
- typography scale;
- button/chip/input/card primitives;
- app shell;
- responsive layout rules;
- icon rules.

Acceptance criteria:

- UI matches the planned Layla-inspired visual system;
- no browser-default controls;
- mobile layout is intentionally designed.

### Phase 3: Planner Experience

Deliverables:

- home planner module;
- quick-start modes;
- chat interface;
- simulated assistant planning flow;
- generated trip preview;
- save trip flow.

Acceptance criteria:

- user can enter a prompt and generate a saved trip;
- generated trip appears in `/trips`;
- chat history is saved.

### Phase 4: Trip and Discovery Views

Deliverables:

- `/discover`;
- `/trips`;
- `/trips/:tripId`;
- refinement buttons;
- visual itinerary cards.

Acceptance criteria:

- user can browse inspiration;
- user can open a saved trip;
- user can refine a trip and see updated state.

### Phase 5: Booking and Operator Views

Deliverables:

- `/book`;
- flight/hotel/activity offer cards;
- `/dashboard`;
- TanStack Table for operator trip/message data.

Acceptance criteria:

- booking cards are clearly simulated;
- dashboard table supports sorting/filtering;
- operator view exposes useful product signals.

### Phase 6: QA and Demo Polish

Deliverables:

- build check;
- API smoke check;
- desktop browser screenshot;
- mobile browser screenshot;
- interaction smoke test;
- final README usage instructions.

Acceptance criteria:

- `npm run build` passes;
- no console errors in core routes;
- planner, save trip, trip detail, discover, booking, and dashboard flows work;
- responsive layout has no obvious overflow or text overlap.

## Visual QA Plan

Check against:

- `docs/research/assets/layla-appstore-01.png`
- `docs/research/assets/layla-appstore-02.png`
- `docs/research/assets/layla-appstore-03.png`
- `docs/research/assets/layla-appstore-04.png`
- browser screenshots from the implemented app.

Compare:

- first-screen task clarity;
- typography weight and scale;
- lavender/teal accent use;
- chat bubble anatomy;
- destination card anatomy;
- booking card anatomy;
- spacing and responsive behavior;
- visual trust cues.

## Non-Goals for First Build

- real AI provider integration;
- real flight/hotel/activity booking inventory;
- authentication;
- payments;
- native mobile app;
- PDF export;
- real-time collaboration;
- production deployment;
- scraping or copying Layla proprietary assets.

## Risks and Mitigations

Risk: The app becomes a static clone instead of a working product demo.  
Mitigation: Build the planner, saved trips, trip detail, and dashboard as real interactive flows backed by SQLite.

Risk: The scope expands into a full OTA product.  
Mitigation: Keep booking as simulated recommendation cards and partner handoff placeholders.

Risk: Chat UX becomes generic.  
Mitigation: Add structured itinerary outputs, quick actions, prompt chips, and visible saved state.

Risk: UI looks like a dashboard instead of a consumer travel app.  
Mitigation: Use vivid imagery, mobile-inspired chat panels, bold headings, and travel-card surfaces.

Risk: AI recommendations appear untrustworthy.  
Mitigation: Use confidence labels, source-style notes, and clearly simulated data.

## Decision Log

- Use SQLite now for speed and local persistence.
- Use Express instead of TanStack Start for a simpler first demo.
- Use TanStack Router, Query, and Table to satisfy the TanStack requirement without overcomplicating the backend.
- Treat Layla as product inspiration, not a brand to copy.
- Build the actual app experience first, not a marketing-only landing page.

## Immediate Next Steps After This Plan

1. Confirm this plan is acceptable.
2. Scaffold the Vite React + Express + SQLite project.
3. Add schema and seed data.
4. Build the API.
5. Build the planner-first UI.
6. Test and iterate against reference screenshots.

