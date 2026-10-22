# Avora

Event management over WhatsApp. Weddings first, built to scale to other event types.

**Current phase: mocks only.** No external services are called. Data is seeded from
`src/mocks/data.ts` into a client-side Zustand store (`src/store/data-store.ts`) that
persists to `localStorage`, and every read/write goes through the service layer in
`src/services/`. Use "Reset demo data" in the header to wipe local changes and restore
the original seed data.

See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for phases and scope.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
