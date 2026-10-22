# Avora

Event management over WhatsApp. Weddings first, built to scale to other event types.

**Current phase: mocks only.** No external services are called; all data comes from
`src/mocks/data.ts` through the service layer in `src/services/`.

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
