# gr-layla-ai

Layla-style AI travel planner demo.

This repo implements the research and replication plan in `docs/`.

## Stack

- React + Vite + TypeScript
- TanStack Router, TanStack Query, TanStack Table
- Express API
- SQLite local database

## Run

```bash
npm install
npm run db:seed
npm run dev
```

Frontend: http://localhost:5173  
API: http://localhost:4000

## Notes

Environment files such as `.env`, `.env.*`, and `,env` are ignored and should not be committed.
