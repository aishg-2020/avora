# Avora: implementation plan

Avora is an event-management platform run over WhatsApp. Weddings come first; the data
model is event-type agnostic so corporate events can follow.

## Guiding rule for the current phase: **mocks only**

No WhatsApp/Meta integration, no webhooks, no real database, no third-party APIs.
Every external dependency is represented by a **service interface** (`src/services/types.ts`)
with an **in-memory mock implementation** (`src/services/mock.ts`) reading seed data from
`src/mocks/data.ts`. Pages only call `getServices()`, so later phases swap in real
implementations without touching the UI.

## Modules (based on Evona's home screen)

| Module | Route | Phase 1 (mock) |
|---|---|---|
| Guest List | `/guests` | List families, guests, tags |
| Functions | `/functions` | List sub-events |
| RSVP | `/rsvp` | Guest × function matrix |
| Campaigns | `/campaigns` | Campaign + template lists, mock cost estimate |
| Travel Planner | `/travel` | Arrivals/departures, pickup flags |
| ID Documents | `/ids` | Masked IDs, missing/verified status |
| Room Planner | `/rooms` | Room cards + unassigned guests |
| Check-In | `/check-in` | Airport / hotel / venue stages |
| Baggage | `/baggage` | Bag count, tags, status |
| Call Logs | `/call-logs` | Call list with summaries |
| Connect WhatsApp | `/whatsapp` | Fake connection status |

---

## Phase 0: Boilerplate ✅ (this commit)
- Next.js 16 (App Router) + TypeScript + Tailwind 4
- Domain types (`src/lib/types.ts`), seed data, service interfaces + mock implementation
- Tablet-friendly home screen with tile grid and summary stats
- Read-only page for every module

## Phase 1: Interactive mock prototype
All still mock data, but the app *behaves* like the real thing.
- **Client-side mock store** (e.g. Zustand with localStorage persistence) so changes survive reloads; a "Reset demo data" button
- **Guests:** add/edit/delete, CSV import parsed in the browser, search and filters (side, tag, RSVP status)
- **Guest profile page:** RSVP, travel, ID, room, baggage, check-ins, messages on one screen
- **Functions:** create/edit
- **RSVP:** change status per function from the UI
- **Campaigns:** create flow (template → segment → cost preview → "send"); mock sender marks messages sent/delivered/read on a timer
- **Mock WhatsApp simulator:** a fake phone panel showing what a guest would receive, with clickable RSVP buttons that update the dashboard
- **Travel / IDs:** forms to add details; ID "upload" uses local image preview only
- **Room Planner:** drag-and-drop guests into rooms, capacity warnings
- **Check-In:** one-tap "Arrived at airport / hotel"; mock notification log ("hotel notified", "welcome message sent")
- **Baggage:** add bags, change status
- **Exports:** rooming list, transport manifest, logistics sheet as CSV
- **Dashboard:** RSVP funnel, pending IDs, arrivals today, mock message spend

**Exit criteria:** a 10-minute client demo on an iPad, covering import → invite → RSVP → travel → room → check-in → export, all on mocks.

## Phase 2: Real backend (no WhatsApp yet)
- Database (Postgres, e.g. Supabase) behind the same service interfaces
- Login for planners and staff; roles (owner, staff)
- Multiple events and multiple planners (organisation scoping)
- File storage for ID images, encrypted; masked numbers only
- Data retention: auto-delete guest data 60 days after an event

## Phase 3: WhatsApp integration
- WhatsApp Business Cloud API: real `MessagingService` implementation
- Webhooks for inbound messages and delivery status
- Throttled send queue respecting messaging tiers and quality rating (avoids the number blocking seen with Evona)
- RSVP buttons / WhatsApp Flows for travel details; ID photos received via chat
- Real cost tracking and prepaid wallet

## Phase 4: Automation and AI
- Rules ("when guest arrives at airport → notify hotel + send welcome")
- AI parsing of free-text replies into RSVP/travel data
- OCR + automatic masking for ID documents
- Calls with automatic summaries

## Phase 5: Scale
- Corporate event type (registration, QR badges, sessions)
- Self-serve onboarding, billing plans, white-label branding

---

## Folder structure
```
src/
  app/            routes (one folder per module)
  components/     shared UI (PageHeader, DataTable, Badge, Stat)
  lib/            domain types, module registry, formatters
  mocks/          seed data
  services/       interfaces + mock implementation + getServices() switch
docs/             this plan
```

## Conventions
- UI never imports from `src/mocks` directly; always go through `getServices()`.
- New integrations = new implementation of an existing interface, not changes to pages.
- Event-type-specific fields go in `custom`, not new columns.
