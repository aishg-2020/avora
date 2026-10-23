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
- **Client-side mock store** ✅ Zustand (`src/store/data-store.ts`) persisted to `localStorage`, seeded
  from `src/mocks/data.ts`. It's intentionally "dumb" (state + persistence + reset only) — all business
  logic lives in `src/services/mock.ts`, the only module allowed to read/write it. Every page is a client
  component that calls `getServices()` (via the `useAsyncData` hook) and re-fetches after a mutation;
  nothing in `src/app` imports the store directly. A "Reset demo data" button lives in the global header
  (`src/components/app-header.tsx`) and calls `services.system.resetDemoData()`.
- **Guests:** ✅ add/edit/delete (`src/app/guests/guest-form-modal.tsx`), CSV import parsed in the browser
  with a column-mapping + preview step (`src/app/guests/import-csv-modal.tsx`, `src/lib/csv.ts`), search
  by name/phone, and filters by side/tag/RSVP status.
- **Guest profile page:** ✅ `/guests/[id]` (`src/app/guests/[id]/`), tabbed: Overview (all fields
  editable, phone shown masked), RSVP (inline status/headcount per function), Travel (add/edit/delete),
  ID documents (masked number, expiry, verified toggle, local-only photo preview), Room (read-only, managed
  from the Room Planner), Baggage (per-bag status + add form) and Messages (read-only campaign log).
  Rows in `/guests` and guest names on the other module pages link here. Check-ins still to come.
- **Functions:** ✅ create/edit/delete with confirmation (name, date, time, venue, description);
  delete cascades the function's RSVPs. List stays in running order.
- **RSVP:** ✅ guest × function matrix — clicking a cell cycles pending → attending → declined → maybe;
  filters by family/side/tag; totals row per function (attending/declined/pending, + maybe when present).
  Same `upsertRsvp` service call as the profile tab, so both stay in sync.
- **Campaigns:** ✅ 3-step create flow (template — pick or write a new one with `{{guest_name}}` /
  `{{function_name}}` placeholders → audience: all / function attendees / side / tag → review with
  recipient list and ₹0.85-per-recipient cost → confirm & send). The mock sender queues one message per
  recipient and advances it sent (1–2s) → delivered (3–5s) → read (8–12s); the detail view polls the
  service so statuses update live, and interrupted sends are fast-forwarded on the next read.
- **Mock WhatsApp simulator:** ✅ "Preview as guest" slide-over (`src/components/whatsapp-simulator.tsx`)
  with a fake phone screen, placeholders rendered for that guest, and RSVP quick replies that call
  `guests.upsertRsvp` (targeted function, or every function for broad campaigns) and answer back in the
  thread. Reachable from the campaign detail view and the guest profile's Messages tab.
- **Travel / IDs:** ✅ Travel Planner lists every leg with add/edit/delete (shared
  `components/travel-form-modal.tsx`, with a guest picker on the planner), filters by date / direction /
  pickup state, and a "Mark arranged" toggle (`Travel.pickupArranged`). ID Documents lists every guest
  with Verified / Review / Missing / Expired status (`lib/guest-helpers.ts#idStatus`), add/edit via the
  shared `components/id-document-form-modal.tsx` (number masked by the service, expiry, verified flag),
  filters by status, and photo "upload" that is a browser-memory preview only (`components/image-slot.tsx`).
- **Room Planner:** ✅ room cards with occupancy badges, native HTML5 drag-and-drop (unassigned → room,
  room → room, room → unassigned) plus a select-and-assign fallback, remove buttons, at-capacity and
  over-capacity warnings (capacity is not enforced — planners sometimes add a bed), and a separate
  Unassigned panel. Mutations: `logistics.assignGuestToRoom` / `unassignGuest`.
- **Check-In:** ✅ three stages in order (airport → hotel → venue), one-tap "Mark arrived" per guest ×
  stage (with undo), pending-per-stage cards that filter the list, and a mock notification log
  (`Notification` entity) showing what each arrival would have sent — hotel, driver, baggage team,
  WhatsApp to the masked number. `logistics.recordCheckIn` / `undoCheckIn` / `listNotifications`.
- **Baggage:** ✅ every bag with owner, tag, description and status (Checked In → On Belt → Collected),
  one-tap segmented status control (`components/bag-status-control.tsx`), add form with owner/tag/
  description, search + status filter. Same control in the profile's Baggage tab.
- **Exports:** ✅ in-browser CSV downloads (`lib/csv.ts#downloadCsv`, Blob + object URL, no server):
  `/rooms` rooming list (room, hotel, guest, family, bed type, notes), `/travel` transport manifest
  (respects the active filters; guest, direction, mode, number, IST time, airport, pickup required/
  arranged), `/guests` logistics sheet (guest, family, side, masked phone, RSVP per function).
- **Dashboard:** ✅ live from the store — RSVP funnel (attending / declined / pending / no response per
  guest), pending IDs (missing + needs review + expired), arrivals today in IST (with the next arrival
  when there are none), checked-in count, and mock message spend (messages sent × ₹0.85).

**Exit criteria:** a 10-minute client demo on an iPad, covering import → invite → RSVP → travel → room → check-in → export, all on mocks.

**Status:** every Phase 1 item above is built. `npm run build` passes (fonts moved to a system stack so
the build has no network dependency).

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
