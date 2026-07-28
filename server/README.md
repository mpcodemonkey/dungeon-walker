# Dungeon Walker — Server

Node.js + TypeScript API. Handles auth, persistent game state, and
server-side validation of step counts / GPS positions (kept server-side
deliberately, since this is the primary anti-cheat surface for the game).

## Current state

Scaffold only: an Express app with a `/health` endpoint, and a Prisma
schema with a placeholder `User` model. No auth or game logic yet.

## Setup

```
npm install
cp .env.example .env   # then point DATABASE_URL at a real Postgres instance
npx prisma generate
npm run dev
```

`GET /health` should respond `{"status":"ok"}`.

## Notes

- Prisma is pinned to v6 rather than the current v7 line — v7 moved to a
  driver-adapter model (`prisma.config.ts` + `@prisma/adapter-pg`) that
  adds setup complexity not worth taking on before the data layer is
  actually being designed. Worth revisiting once schema/migrations work
  starts in earnest.
- No migrations have been run yet; `prisma/schema.prisma` currently holds
  a placeholder model only.
