# Layla-style UX/UI Teardown

Date: 2026-05-25

V2 update: incorporate local Layla.ai app flow screenshots from `docs/app-screenshots`.

V2 priority: chat replication is the main work. Screenshots `01` through `09` define the product experience to match first; trip detail screenshots `10` through `15` are the generated output surface after the chat is right.

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

Observed patterns from local app screenshots:

- the app is designed as a phone-native chat funnel first;
- the initial screen has a simple top brand bar, organic travel image motif, large centered headline, and oversized composer;
- the chat screen keeps a `TRIP CHECKLIST` progress bar pinned near the top;
- progress is shown as both a thin lavender bar and text such as `1 of 5 captured`;
- the checklist expands into a rounded white sheet with a radial count and vertical stepper;
- completed checklist items use dark filled circular checks;
- incomplete checklist items use dotted circular markers and muted helper copy;
- user bubbles are right-aligned lavender blocks with rounded corners;
- assistant messages are mostly unboxed body text, which keeps the experience less chatbot-heavy;
- reply chips are small pill buttons above the composer;
- the composer is fixed at the bottom and contains attachment, calendar, mic, and send controls;
- the generation screen uses a lavender full-screen background, tilted card stack, and progressive task list;
- the trip result shifts to a map/timeline product surface with back, share, download, bottom navigation, route cards, hotel cards, and itinerary cards.

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

V2 should change this translation:

- keep a non-proprietary brand name, but the layout should be materially closer to Layla's captured mobile UI;
- replace exposed planner settings with inferred chat capture and context chips only when helpful;
- reduce dashboard-style framing around the chat;
- make the mobile chat frame the canonical product UI on desktop and mobile;
- use lavender as the dominant interaction accent for bubbles, progress, chips, and send states;
- preserve the lightweight white background, soft dividers, subtle shadows, and generous rounded sheets;
- make map and trip cards first-class after generation instead of secondary detail pages.

## Route-Level UX

### `/`

Purpose: immediate product proof.

Contains:

- top brand/action bar;
- organic destination image motif;
- large centered promise: `Your trip. Planned in minutes.`;
- oversized chat composer;
- quick-start chips;
- scroll cue for secondary help content.

Success condition:

- user can start planning in one action and the first viewport feels like `01_home_trip_prompt.png`.

### `/chat`

Purpose: focus the core planner loop.

Contains:

- top brand/action bar;
- collapsed trip checklist progress bar;
- expanded trip checklist sheet;
- right-aligned user bubbles;
- plain assistant response text;
- contextual reply chips;
- sticky bottom composer;
- summary confirmation state;
- generation progress state;
- generated trip handoff.

Success condition:

- user can generate a SQLite-backed itinerary.
- when an OpenAI key is configured, the backend agent calls the model for structured planning output before saving the itinerary.
- the chat progression visually follows screenshots `02` through `09`.

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

- top detail nav with back, share, and download controls;
- map-first trip overview;
- horizontal route selector;
- large destination/timeline heading;
- arrival and departure transport cards;
- stay card with rating, price, change/delete controls, and contextual note;
- itinerary day cards;
- bottom nav with Chat, Trip, and Book zones;
- fullscreen map modal.

Success condition:

- user can inspect and refine a saved plan.
- the result surface visually follows screenshots `10` through `15`.

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

- Desktop may use a centered phone-width app frame with restrained side context; the app frame remains the canonical UI.
- Mobile uses the app frame full-width.
- The chat composer is sticky at the bottom on both desktop app-frame and mobile layouts.
- Headings wrap aggressively to avoid overflow.
- Cards collapse from 3-4 columns to 1 column.
- Navigation scrolls horizontally on small screens.

## V2 Chat State Model

The chat should be implemented as a small state machine, not as loosely rendered messages. This is the most important V2 interaction to replicate.

The state machine should feel agentic and guided. The user should never feel like they are filling out a form alone; Layla-style AI should hold the user's hand through each missing planning decision until the itinerary is ready to build.

1. `home_prompt`
   - visible in `/`;
   - input composer and quick-start chips.
2. `collecting`
   - visible in `/chat`;
   - collapsed checklist with current count;
   - assistant asks for the next missing field.
3. `checklist_expanded`
   - same route;
   - progress sheet overlays the chat area.
4. `summary_confirmation`
   - assistant shows route, dates, style, and purpose;
   - chips: confirm summary, change dates, add more activities.
5. `generating`
   - full-screen lavender progress state;
   - task list shows completed/current/pending states.
6. `trip_ready`
   - user lands on map/timeline trip detail.

Checklist fields:

- `whereTo`
- `whereFrom`
- `who`
- `when`
- `intent`

The UI should show captured values as readable trip language, e.g. `Johor Bahru`, `Singapore`, `Solo`, `This weekend or next weekend, overnight stay`.

Agentic guidance rules:

- infer fields from natural language before asking more questions;
- ask one next-best question at a time;
- make each assistant turn explain what is already understood and what is still needed;
- use reply chips as shortcuts, not replacements for natural language;
- celebrate progress lightly through checklist movement rather than marketing copy;
- show the final brief as route, dates, style, and purpose before generating the itinerary.

## Trust and Compliance Choices

- Booking cards say `Demo handoff`.
- Recommendations include confidence labels.
- Activity notes tell users to verify live details.
- No real partner integrations are claimed.
- No proprietary Layla brand assets are copied.

V2 compliance note:

- The screenshots are used as interaction and layout references only.
- The implementation should avoid the exact Layla logo, proprietary imagery, exact partner claims, and misleading live-inventory language.
