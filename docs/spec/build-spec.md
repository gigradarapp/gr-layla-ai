# Build Spec

Date: 2026-05-25

Status: Initial demo implemented. V2 spec added for Layla.ai chat and trip-result overhaul using `docs/app-screenshots` as the primary UI/UX reference.

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

## V2 Product Objective

Overhaul the chat and generated-trip experience so the demo matches the captured Layla.ai mobile UI/UX as closely as practical while keeping non-proprietary branding and simulated data.

Priority: chat fidelity is the main V2 goal. Screenshots `01` through `09` are the primary implementation reference. Screenshots `10` through `15` are secondary and should support the chat journey by showing a credible generated-trip handoff.

Primary screenshot references:

- `docs/app-screenshots/01_home_trip_prompt.png`
- `docs/app-screenshots/02_chat_intro_questions.png`
- `docs/app-screenshots/03_checklist_destination_captured.png`
- `docs/app-screenshots/04_chat_dates_input.png`
- `docs/app-screenshots/05_chat_solo_overnight_input.png`
- `docs/app-screenshots/06_checklist_core_details_captured.png`
- `docs/app-screenshots/07_chat_budget_trip_summary.png`
- `docs/app-screenshots/08_chat_summary_confirmation.png`
- `docs/app-screenshots/09_trip_generation_progress.png`
- `docs/app-screenshots/10_trip_overview_map.png`
- `docs/app-screenshots/11_trip_arrival_transport_top.png`
- `docs/app-screenshots/12_trip_arrival_transport_detail.png`
- `docs/app-screenshots/13_trip_stay_hotel_card.png`
- `docs/app-screenshots/14_trip_itinerary_departure.png`
- `docs/app-screenshots/15_trip_fullscreen_map.png`

## V2 Chat UX Requirements

These requirements are the highest priority for V2. The app can keep existing discovery, booking, dashboard, and broad trip-detail behavior temporarily, but the chat funnel should be rebuilt until it feels materially close to the screenshots.

The chat must also handhold the user through the 5-step itinerary-building process with agentic AI. The assistant should infer what it can, ask only the next useful question, explain progress through the checklist, and keep the user moving toward a complete dream itinerary instead of exposing a static form.

### App Shell

- Use a centered mobile app frame as the canonical UI on desktop.
- On mobile, the frame becomes full viewport width and height.
- Top bar:
  - left brand wordmark substitute;
  - right plus action;
  - right profile/account action;
  - subtle white background and no heavy border.
- Avoid dashboard panels, metrics, large sidebars, and visible agent trace in the default consumer chat.

### Home Prompt State

Reference: `01_home_trip_prompt.png`.

- Center an organic travel image motif above the headline.
- Use a large centered headline: `Your trip. Planned in minutes.` or equivalent non-proprietary copy.
- Render a large rounded composer with:
  - text input area;
  - attachment icon;
  - mic icon;
  - circular send icon;
  - soft shadow.
- Render quick chips below:
  - `Create a new trip`;
  - `Inspire me where to go`.
- Secondary content should sit below the fold.

### Chat Collection State

References: `02_chat_intro_questions.png` through `06_checklist_core_details_captured.png`.

- Pin a collapsed `TRIP CHECKLIST` bar above the chat:
  - label;
  - text count such as `1 of 5 captured`;
  - lavender progress bar;
  - chevron expand/collapse action.
- Expanded checklist:
  - rounded white sheet;
  - circular progress count such as `4/5`;
  - title: `Your trip is taking shape`;
  - vertical stepper;
  - completed rows use filled check circles;
  - incomplete rows use dotted circles and muted helper text.
- Checklist fields:
  - `Where to`;
  - `Where from`;
  - `Who's coming`;
  - `When you'd go`;
  - `What you're after`.
- Agentic handholding behavior:
  - acknowledge what the user already provided;
  - infer obvious fields from natural language;
  - ask one focused follow-up for the highest-value missing field;
  - keep the tone specific and travel-agent-like, e.g. `Johor Bahru is a great quick escape. I have the destination; next I need when you want to go.`;
  - avoid dumping all remaining questions at once after the first assistant response;
  - offer 2-3 reply chips that map directly to the active checklist field;
  - update the checklist immediately after every user answer;
  - make the user feel guided from rough idea to complete itinerary.
- User messages:
  - right-aligned lavender rounded bubbles;
  - compact width;
  - optional copy icon beneath or beside the bubble.
- Assistant messages:
  - mostly unboxed dark body text;
  - short paragraphs;
  - bold key terms only where useful.
- Suggestion chips:
  - small white pills with border;
  - sit immediately above the sticky composer;
  - horizontally scroll when needed.
- Composer:
  - sticky bottom;
  - rounded white input container;
  - attachment, calendar, mic, send controls;
  - send icon becomes purple when ready.

### Summary Confirmation State

References: `07_chat_budget_trip_summary.png` and `08_chat_summary_confirmation.png`.

- Assistant summarizes route, dates, style, and purpose before generation.
- Assistant should frame this as the final checkpoint before building the dream itinerary.
- User can answer naturally or tap chips:
  - `Confirm summary`;
  - `Change dates`;
  - `Add more activities`.
- The checklist should show `5 of 5 captured` before final generation.

### Generation State

Reference: `09_trip_generation_progress.png`.

- Replace the chat with a lavender progress screen.
- Show generated trip title at the top.
- Show tilted vertical cards with travel imagery.
- Show task checklist:
  - `Optimizing your route, end to end`;
  - `Scanning 2000+ airlines for best value` or simulated equivalent;
  - `Reading review signals for you`;
  - `Finding hotels with demo-only deals`;
  - `Tailoring the plan to you`.
- Completed steps use green check marks; pending steps use muted spinner/ring.
- Transition to trip detail when generation completes.

## V2 Trip Result Requirements

References: `10_trip_overview_map.png` through `15_trip_fullscreen_map.png`.

- Detail top bar:
  - back to Chat;
  - share icon;
  - `Download` button.
- Map overview:
  - route from origin to destination;
  - pins for key places;
  - expandable map control.
- Title block:
  - `2-Day Solo Johor Bahru Budget Escape`-style trip title;
  - traveler count;
  - date range.
- Horizontal route selector:
  - origin label;
  - transport icon;
  - destination/date pill;
  - repeated route markers as needed.
- Timeline sections:
  - destination intro;
  - `Arrive`;
  - `Stay`;
  - `Itinerary`;
  - `Depart`.
- Transport cards:
  - origin and destination;
  - date labels;
  - transport icon and progress line;
  - travel time;
  - mode;
  - `Change` action.
- Stay card:
  - hotel image;
  - rating stars;
  - room type and policy details;
  - review score;
  - nightly/from price;
  - `Change` and delete actions;
  - contextual note strip.
- Itinerary cards:
  - day badge;
  - experience count;
  - date;
  - title;
  - thumbnail;
  - chevron.
- Bottom nav:
  - Chat;
  - Trip selected;
  - Book.
- Fullscreen map modal:
  - title bar;
  - close control;
  - route line and pins;
  - home marker;
  - play/route control.

## V2 Data and API Additions

Current APIs can stay, but the frontend needs a richer view model.

Add or derive these fields:

- trip checklist state:
  - `whereTo`
  - `whereFrom`
  - `who`
  - `when`
  - `intent`
  - `capturedCount`
  - `missingField`
- chat session state:
  - `home_prompt`
  - `collecting`
  - `checklist_expanded`
  - `summary_confirmation`
  - `generating`
  - `trip_ready`
- trip route:
  - `originLabel`
  - `destinationLabel`
  - `transportMode`
  - `travelTime`
  - `routePins`
  - `mapCenter`
- stay recommendation:
  - `name`
  - `imageUrl`
  - `rating`
  - `reviewScore`
  - `reviewCount`
  - `roomType`
  - `priceFrom`
  - `policyNotes`
- itinerary card metadata:
  - `dayNumber`
  - `experienceCount`
  - `thumbnailUrl`

## V2 Component Targets

- `MobileAppFrame`
- `LaylaTopBar`
- `HomeTripPrompt`
- `TripChecklistBar`
- `TripChecklistSheet`
- `ChatMessageList`
- `ReplyChipRow`
- `StickyComposer`
- `SummaryConfirmation`
- `GenerationProgressScreen`
- `TripDetailShell`
- `TripMapPreview`
- `RouteSelector`
- `TripTimeline`
- `TransportCard`
- `StayCard`
- `ItineraryDayCard`
- `TripBottomNav`
- `FullscreenMapModal`

## V2 Acceptance Criteria

- `/` visually maps to screenshot `01`.
- `/chat` can reproduce the screenshot flow from `02` through `09` with deterministic demo data.
- Chat screens receive implementation priority over `/discover`, `/book`, `/dashboard`, and non-critical trip-detail polish.
- The assistant handholds the user through the 5 checklist steps with one clear next question at a time.
- Natural-language answers update checklist state without forcing form input.
- Checklist count and expanded rows update as the user answers naturally.
- The summary confirmation step appears before generation.
- The generation progress screen replaces chat temporarily and then routes to the generated trip.
- `/trips/:tripId` visually maps to screenshots `10` through `15`.
- Desktop screenshots show a centered mobile app frame, not a wide dashboard planner.
- Mobile screenshots have no horizontal overflow and keep the composer reachable.
- Existing API smoke and build checks still pass.
- No exact Layla logo, proprietary images, or live booking claims are used.

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

## V2 Verification To Perform

- `npm run build`
- `npm run smoke:api`
- Playwright screenshot comparison against:
  - `01_home_trip_prompt.png`;
  - `02_chat_intro_questions.png`;
  - `03_checklist_destination_captured.png`;
  - `06_checklist_core_details_captured.png`;
  - `09_trip_generation_progress.png`;
  - `10_trip_overview_map.png`;
  - `13_trip_stay_hotel_card.png`;
  - `15_trip_fullscreen_map.png`.
- Manual visual QA for:
  - progress bar/checklist behavior;
  - sticky composer;
  - chip wrapping/scrolling;
  - mobile viewport height;
  - text overflow in bubbles, cards, and buttons;
  - map modal open/close behavior.
