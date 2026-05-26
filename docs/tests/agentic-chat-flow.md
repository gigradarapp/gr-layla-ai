# Agentic chat flow tests

Automated coverage for the Layla checklist chat **before** manual QA.

## What is covered

| Layer | Command | Validates |
|-------|---------|-----------|
| API (mocked OpenAI) | `npm run test:agentic` | Checklist order, field-correct pills, no scripted JB copy, more-suggestions, offline fallback |
| UI (mocked `/api/agent/chat`) | `npm run test:e2e` | Pill taps through 5/5, summary action pills, send enabled during in-flight chat |

## Run API tests (fast, no browser)

```bash
cd gr-layla-ai
npm run test:agentic
```

Uses a queued OpenAI mock — no real API key spend.

## Run UI tests (Playwright)

```bash
cd gr-layla-ai
npx playwright install chromium   # first time only
npm run test:e2e
```

Starts API + Vite on **port 5193** (avoids clashing with other apps on 5173), opens mobile viewport, mocks agent responses.

## Johor Bahru scenario (both suites)

1. User plans Johor Bahru → asks **when** with date pills  
2. Picks `Fri 29 May – Sun 31 May` → asks **who** (traveler pills only)  
3. Picks `Solo trip` → asks **intent**  
4. Picks café-hop intent → **summary** (Johor infers `Singapore` as origin once checklist fields are filled)  
5. Summary pills: Confirm / Change dates / Add more activities  

## Adding cases

- API: extend `server/tests/helpers/agent-fixtures.ts` and add a `describe` block in `server/tests/agent-chat-flow.test.ts`
- UI: extend `e2e/fixtures/chat-agent.ts` and `e2e/chat-agentic-flow.spec.ts`
