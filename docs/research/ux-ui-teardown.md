# Layla-style UX/UI Teardown

Date: 2026-05-25

## Product Pattern

Layla's pattern is not a normal travel search page. It is a consumer AI assistant wrapped around travel decision-making:

- start with natural-language intent;
- ask lightweight clarifying questions;
- return structured itinerary output;
- attach visual inspiration and booking-style cards;
- make the plan feel editable through chat.

## Core UX Jobs

1. Reduce blank-page anxiety.
   - Use quick-start prompts and visible examples.
   - Avoid forcing destination-first search.

2. Convert vague desire into travel constraints.
   - Ask about origin, budget, traveler type, pace, dates, and interests.
   - Let the destination be an output, not always an input.

3. Turn AI text into usable structure.
   - Day-by-day schedule.
   - Time blocks.
   - Costs.
   - Confidence labels.
   - Offers and handoff cards.

4. Maintain trust.
   - Signal what is simulated or needs verification.
   - Separate itinerary recommendations from booking claims.
   - Show confidence and source-style notes.

## Visual Language

Observed patterns from public Layla screenshots:

- white/light UI surfaces;
- very large heavy headlines;
- lavender emphasis text;
- teal action chips and buttons;
- vivid destination photography;
- phone/chat-first composition;
- rounded chat bubbles and soft shadows;
- friendly AI persona;
- booking partner/trust cues.

## Implemented Design Translation

The rebuilt demo uses:

- `Trip Genius` as a non-proprietary brand;
- black/white base UI;
- lavender emphasis for headings;
- teal primary actions;
- vivid travel cards using external image URLs;
- rounded 8px UI cards;
- app-first layout instead of a marketing-only landing page;
- mobile-responsive planner panels;
- no copied Layla logo or proprietary assets.

## Route-Level UX

### `/`

Purpose: immediate product proof.

Contains:

- headline;
- planner panel;
- quick-start modes;
- saved trip metrics;
- destination cards;
- saved itinerary preview.

Success condition:

- user can understand and start the trip-planning job without reading documentation.

### `/chat`

Purpose: focus the core planner loop.

Contains:

- chat planner;
- prompt field;
- live trip checklist with captured fields;
- quick destination and constraint chips;
- destination candidate cards;
- backend agent run trace;
- origin/budget/traveler controls;
- generation progress;
- generated trip card.

Success condition:

- user can generate a SQLite-backed itinerary.
- when an OpenAI key is configured, the backend agent calls the model for structured planning output before saving the itinerary.

### `/discover`

Purpose: inspiration and destination discovery.

Contains:

- destination cards;
- vibe, budget, and traveler filters.

Success condition:

- user can browse options without starting with a fixed destination.

### `/trips`

Purpose: saved itinerary management.

Contains:

- searchable trip list;
- trip cards;
- inline planner.

Success condition:

- generated trips are visible and reusable.

### `/trips/:tripId`

Purpose: make AI output operational.

Contains:

- hero summary;
- cost and schedule metrics;
- day-by-day itinerary;
- activities with confidence labels;
- refinement actions;
- chat log;
- booking-style options.

Success condition:

- user can inspect and refine a saved plan.

### `/book`

Purpose: simulated monetization layer.

Contains:

- flight, hotel, and activity cards;
- provider-like labels;
- perks;
- simulated handoff links.

Success condition:

- booking attachment point is obvious without pretending to be live inventory.

### `/dashboard`

Purpose: operator visibility.

Contains:

- summary metrics;
- TanStack Table trip pipeline;
- recent intent messages.

Success condition:

- founder/operator can inspect usage and trip intent signals.

## Responsive Rules

- Desktop uses a two-column hero: promise on the left, planner on the right.
- Mobile stacks hero and planner.
- Headings wrap aggressively to avoid overflow.
- Cards collapse from 3-4 columns to 1 column.
- Navigation scrolls horizontally on small screens.

## Trust and Compliance Choices

- Booking cards say `Demo handoff`.
- Recommendations include confidence labels.
- Activity notes tell users to verify live details.
- No real partner integrations are claimed.
- No proprietary Layla brand assets are copied.
