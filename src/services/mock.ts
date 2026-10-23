// In-memory implementation of the service contracts, backed by the
// client-side Zustand store (`src/store/data-store.ts`), which itself is
// seeded from and resettable to `src/mocks/data.ts`.
//
// This is the ONLY module allowed to read/write the data store directly.
// UI code must always go through `getServices()`.

import { maskIdNumber, maskPhone } from "@/lib/format";
import { COST_PER_RECIPIENT_INR } from "@/lib/pricing";
import { dataStoreReady, genId, useDataStore, type DataState } from "@/store/data-store";
import type {
  Baggage,
  Campaign,
  CampaignAudience,
  CheckIn,
  CheckInStage,
  EventFunction,
  Guest,
  IdDocument,
  Message,
  MessageStatus,
  MessageTemplate,
  Notification,
  Party,
  Room,
  Rsvp,
  Travel,
} from "@/lib/types";
import type { Services } from "./types";


// Every mutating/reading method awaits this first so we never race the
// async rehydration of localStorage on first load.
const ready = () => dataStoreReady;

const guestIdsForEvent = (eventId: string) => {
  const { parties, guests } = useDataStore.getState();
  const partyIds = new Set(parties.filter((p) => p.eventId === eventId).map((p) => p.id));
  return new Set(guests.filter((g) => partyIds.has(g.partyId)).map((g) => g.id));
};

const normalizeTags = (tags: string[]): string[] =>
  Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)));

// Applies `update` to the one record in `collection` whose id matches and
// writes the new array back to the store. Throws if nothing matched.
type IdCollection =
  | "functions"
  | "parties"
  | "guests"
  | "travel"
  | "idDocuments"
  | "baggage"
  | "campaigns"
  | "messages"
  | "checkIns";
type Item<K extends IdCollection> = DataState[K][number];

function updateById<K extends IdCollection>(collection: K, id: string, update: (current: Item<K>) => Item<K>): Item<K> {
  let updated: Item<K> | undefined;
  useDataStore.setState((s) => ({
    [collection]: (s[collection] as Item<K>[]).map((item) => {
      if (item.id !== id) return item;
      updated = update(item);
      return updated;
    }),
  }));
  if (!updated) throw new Error(`${collection} record ${id} not found`);
  return updated;
}

// ---------------------------------------------------------------------------
// Campaign delivery simulation.
// ---------------------------------------------------------------------------

const MESSAGE_RANK: Record<MessageStatus, number> = { queued: 0, sent: 1, delivered: 2, read: 3, failed: 3 };

const randomBetween = (minMs: number, maxMs: number) => minMs + Math.random() * (maxMs - minMs);

// Resolves an audience into concrete guests, reading current store state.
function resolveAudience(eventId: string, audience: CampaignAudience): Guest[] {
  const { parties, guests, rsvps } = useDataStore.getState();
  const partyIds = new Set(parties.filter((p) => p.eventId === eventId).map((p) => p.id));
  const eventGuests = guests.filter((g) => partyIds.has(g.partyId));
  const partyById = new Map(parties.map((p) => [p.id, p]));

  switch (audience.kind) {
    case "all":
      return eventGuests;
    case "function": {
      const attending = new Set(
        rsvps.filter((r) => r.functionId === audience.functionId && r.status === "attending").map((r) => r.guestId),
      );
      return eventGuests.filter((g) => attending.has(g.id));
    }
    case "side":
      return eventGuests.filter((g) => partyById.get(g.partyId)?.side === audience.side);
    case "tag":
      if (audience.tag === "International") return eventGuests.filter((g) => g.isInternational);
      return eventGuests.filter(
        (g) => (partyById.get(g.partyId)?.tags ?? []).includes(audience.tag) || (g.tags ?? []).includes(audience.tag),
      );
  }
}

function audienceLabel(audience: CampaignAudience): string {
  switch (audience.kind) {
    case "all":
      return "All guests";
    case "function": {
      const fn = useDataStore.getState().functions.find((f) => f.id === audience.functionId);
      return `Attending: ${fn?.name ?? audience.functionId}`;
    }
    case "side":
      return `Side: ${audience.side}`;
    case "tag":
      return `Tag: ${audience.tag}`;
  }
}

// Upgrades one message's status (never downgrades), then marks the campaign
// "sent" once every recipient has at least left the queue.
function bumpMessage(messageId: string, status: MessageStatus) {
  let campaignId: string | undefined;
  useDataStore.setState((s) => ({
    messages: s.messages.map((m) => {
      if (m.id !== messageId || MESSAGE_RANK[m.status] >= MESSAGE_RANK[status]) return m;
      campaignId = m.campaignId;
      return { ...m, status };
    }),
  }));
  if (campaignId) maybeCompleteCampaign(campaignId);
}

function maybeCompleteCampaign(campaignId: string) {
  const { campaigns, messages } = useDataStore.getState();
  const campaign = campaigns.find((c) => c.id === campaignId);
  if (!campaign || campaign.status !== "sending") return;
  const mine = messages.filter((m) => m.campaignId === campaignId);
  if (mine.length > 0 && mine.every((m) => MESSAGE_RANK[m.status] >= MESSAGE_RANK.sent)) {
    useDataStore.setState((s) => ({
      campaigns: s.campaigns.map((c) => (c.id === campaignId ? { ...c, status: "sent" as const } : c)),
    }));
  }
}

// Timed status progression per the spec: queued → sent after 1–2s,
// delivered after 3–5s, read after 8–12s.
function scheduleDelivery(messageId: string) {
  setTimeout(() => bumpMessage(messageId, "sent"), randomBetween(1000, 2000));
  setTimeout(() => bumpMessage(messageId, "delivered"), randomBetween(3000, 5000));
  setTimeout(() => bumpMessage(messageId, "read"), randomBetween(8000, 12000));
}

// If the page was closed mid-simulation the timers die with it, leaving
// messages stuck. On the next read, fast-forward anything whose schedule
// clearly elapsed. "queued" is never a legitimate historical state, so it
// always advances; "sent"/"delivered" only advance within a minute of
// sending so old seed data (mixed sent/delivered/read) keeps its variety.
function catchUpDelivery(campaignId: string) {
  const now = Date.now();
  const stale = useDataStore
    .getState()
    .messages.filter((m) => m.campaignId === campaignId && m.status !== "read" && m.status !== "failed")
    .map((m) => ({ m, elapsed: now - new Date(m.sentAt).getTime() }))
    .filter(({ m, elapsed }) => elapsed > 2000 && (m.status === "queued" || elapsed < 60_000));
  for (const { m, elapsed } of stale) {
    const expected: MessageStatus = elapsed > 12_000 ? "read" : elapsed > 5000 ? "delivered" : "sent";
    bumpMessage(m.id, expected);
  }
}

// Catch-up for campaigns that may have been interrupted, so list/detail
// reads always see a consistent status.
function catchUpCampaigns(campaigns: Campaign[]) {
  for (const c of campaigns) {
    if (c.status !== "sending") continue;
    catchUpDelivery(c.id);
    maybeCompleteCampaign(c.id);
  }
}

// ---------------------------------------------------------------------------
// Check-in notifications: what each arrival stage *would* send.
// ---------------------------------------------------------------------------

function mockNotificationsFor(guestId: string, stage: CheckInStage, at: string): Notification[] {
  const { guests, rooms, travel, baggage } = useDataStore.getState();
  const guest = guests.find((g) => g.id === guestId);
  if (!guest) return [];
  const room = rooms.find((r) => r.guestIds.includes(guestId));
  const phone = maskPhone(guest.phone);
  const bags = baggage.filter((b) => b.guestId === guestId).length;
  const arrival = travel.find((t) => t.guestId === guestId && t.direction === "arrival");

  const out: Omit<Notification, "id" | "at">[] = [];
  switch (stage) {
    case "airport":
      out.push({
        guestId,
        stage,
        kind: "hotel",
        text: room
          ? `Hotel notified: ${guest.name} has landed — room ${room.roomNo} at ${room.hotel} to be readied.`
          : `Hotel notified: ${guest.name} has landed (no room assigned yet).`,
      });
      if (arrival?.pickupNeeded) {
        out.push({
          guestId,
          stage,
          kind: "driver",
          text: `Driver messaged to meet ${guest.name} at ${arrival.airport ?? "arrivals"}${arrival.pickupArranged ? "" : " (pickup not yet arranged!)"}.`,
        });
      }
      out.push({ guestId, stage, kind: "whatsapp", text: `Welcome message sent to ${phone}.` });
      break;
    case "hotel":
      out.push({
        guestId,
        stage,
        kind: "whatsapp",
        text: room
          ? `Room details sent to ${phone}: room ${room.roomNo}, ${room.hotel}.`
          : `Check-in confirmation sent to ${phone} (room still to be allocated).`,
      });
      if (bags > 0) {
        out.push({ guestId, stage, kind: "baggage", text: `Baggage team notified: ${bags} bag${bags === 1 ? "" : "s"} for ${guest.name} to go up to ${room ? `room ${room.roomNo}` : "the lobby"}.` });
      }
      break;
    case "venue":
      out.push({ guestId, stage, kind: "host", text: `Hosts notified: ${guest.name} has arrived at the venue.` });
      out.push({ guestId, stage, kind: "whatsapp", text: `Schedule for the evening sent to ${phone}.` });
      break;
  }
  // Stagger timestamps by a second so the log reads in send order.
  return out.map((n, i) => ({ ...n, id: genId("ntf"), at: new Date(new Date(at).getTime() + (i + 1) * 1000).toISOString() }));
}

export const mockServices: Services = {
  events: {
    async getEvent(id) {
      await ready();
      return useDataStore.getState().events.find((e) => e.id === id);
    },
    async listFunctions(eventId) {
      await ready();
      return useDataStore
        .getState()
        .functions.filter((f) => f.eventId === eventId)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    },

    async createFunction(input) {
      await ready();
      const fn: EventFunction = {
        id: genId("fn"),
        eventId: input.eventId,
        name: input.name.trim(),
        startsAt: input.startsAt,
        venue: input.venue.trim(),
        ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      };
      useDataStore.setState((s) => ({ functions: [...s.functions, fn] }));
      return fn;
    },

    async updateFunction(id, patch) {
      await ready();
      return updateById("functions", id, (f) => {
        const next: EventFunction = {
          ...f,
          ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
          ...(patch.startsAt !== undefined ? { startsAt: patch.startsAt } : {}),
          ...(patch.venue !== undefined ? { venue: patch.venue.trim() } : {}),
        };
        if (patch.description !== undefined) {
          if (patch.description.trim()) next.description = patch.description.trim();
          else delete next.description;
        }
        return next;
      });
    },

    async deleteFunction(id) {
      await ready();
      useDataStore.setState((s) => ({
        functions: s.functions.filter((f) => f.id !== id),
        rsvps: s.rsvps.filter((r) => r.functionId !== id),
      }));
    },
  },

  guests: {
    async listParties(eventId) {
      await ready();
      return useDataStore.getState().parties.filter((p) => p.eventId === eventId);
    },
    async listGuests(eventId) {
      await ready();
      const ids = guestIdsForEvent(eventId);
      return useDataStore.getState().guests.filter((g) => ids.has(g.id));
    },
    async listRsvps(eventId) {
      await ready();
      const ids = guestIdsForEvent(eventId);
      return useDataStore.getState().rsvps.filter((r) => ids.has(r.guestId));
    },
    async listIdDocuments(eventId) {
      await ready();
      const ids = guestIdsForEvent(eventId);
      return useDataStore.getState().idDocuments.filter((d) => ids.has(d.guestId));
    },

    async getGuest(id) {
      await ready();
      return useDataStore.getState().guests.find((g) => g.id === id);
    },
    async getParty(id) {
      await ready();
      return useDataStore.getState().parties.find((p) => p.id === id);
    },
    async listRsvpsForGuest(guestId) {
      await ready();
      return useDataStore.getState().rsvps.filter((r) => r.guestId === guestId);
    },
    async listIdDocumentsForGuest(guestId) {
      await ready();
      return useDataStore.getState().idDocuments.filter((d) => d.guestId === guestId);
    },

    async upsertRsvp(input) {
      await ready();
      const rsvp: Rsvp = {
        guestId: input.guestId,
        functionId: input.functionId,
        status: input.status,
        headcount: Math.max(0, Math.floor(input.headcount)),
      };
      useDataStore.setState((s) => {
        const others = s.rsvps.filter(
          (r) => !(r.guestId === input.guestId && r.functionId === input.functionId),
        );
        return { rsvps: [...others, rsvp] };
      });
      return rsvp;
    },

    async createIdDocument(input) {
      await ready();
      const doc: IdDocument = {
        id: genId("id"),
        guestId: input.guestId,
        kind: input.kind,
        maskedNumber: maskIdNumber(input.number),
        ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
        sides: input.sides ?? [],
        verified: input.verified ?? false,
      };
      useDataStore.setState((s) => ({ idDocuments: [...s.idDocuments, doc] }));
      return doc;
    },

    async updateIdDocument(id, patch) {
      await ready();
      return updateById("idDocuments", id, (d) => {
        const next: IdDocument = {
          ...d,
          ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
          ...(patch.number !== undefined ? { maskedNumber: maskIdNumber(patch.number) } : {}),
          ...(patch.sides !== undefined ? { sides: Array.from(new Set(patch.sides)) } : {}),
          ...(patch.verified !== undefined ? { verified: patch.verified } : {}),
        };
        if (patch.expiresAt === null) delete next.expiresAt;
        else if (patch.expiresAt !== undefined) next.expiresAt = patch.expiresAt;
        return next;
      });
    },

    async deleteIdDocument(id) {
      await ready();
      useDataStore.setState((s) => ({ idDocuments: s.idDocuments.filter((d) => d.id !== id) }));
    },

    async createParty(input) {
      await ready();
      const party: Party = {
        id: genId("pty"),
        eventId: input.eventId,
        name: input.name.trim(),
        side: input.side,
        tags: normalizeTags(input.tags),
      };
      useDataStore.setState((s) => ({ parties: [...s.parties, party] }));
      return party;
    },

    async updateParty(id, patch) {
      await ready();
      let updated: Party | undefined;
      useDataStore.setState((s) => ({
        parties: s.parties.map((p) => {
          if (p.id !== id) return p;
          updated = {
            ...p,
            ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
            ...(patch.side !== undefined ? { side: patch.side } : {}),
            ...(patch.tags !== undefined ? { tags: normalizeTags(patch.tags) } : {}),
          };
          return updated;
        }),
      }));
      if (!updated) throw new Error(`Party ${id} not found`);
      return updated;
    },

    async deleteParty(id) {
      await ready();
      useDataStore.setState((s) => {
        const guestIds = new Set(s.guests.filter((g) => g.partyId === id).map((g) => g.id));
        return {
          parties: s.parties.filter((p) => p.id !== id),
          guests: s.guests.filter((g) => g.partyId !== id),
          rsvps: s.rsvps.filter((r) => !guestIds.has(r.guestId)),
          travel: s.travel.filter((t) => !guestIds.has(t.guestId)),
          idDocuments: s.idDocuments.filter((d) => !guestIds.has(d.guestId)),
          baggage: s.baggage.filter((b) => !guestIds.has(b.guestId)),
          checkIns: s.checkIns.filter((c) => !guestIds.has(c.guestId)),
          callLogs: s.callLogs.filter((c) => !guestIds.has(c.guestId)),
          messages: s.messages.filter((m) => !guestIds.has(m.guestId)),
          notifications: s.notifications.filter((n) => !guestIds.has(n.guestId)),
          rooms: s.rooms.map((r) => ({ ...r, guestIds: r.guestIds.filter((gid) => !guestIds.has(gid)) })),
        };
      });
    },

    async createGuest(input) {
      await ready();
      const guest: Guest = {
        id: genId("g"),
        partyId: input.partyId,
        name: input.name.trim(),
        phone: input.phone.trim(),
        isInternational: input.isInternational,
      };
      useDataStore.setState((s) => ({ guests: [...s.guests, guest] }));
      return guest;
    },

    async updateGuest(id, patch) {
      await ready();
      let updated: Guest | undefined;
      useDataStore.setState((s) => ({
        guests: s.guests.map((g) => {
          if (g.id !== id) return g;
          updated = {
            ...g,
            ...(patch.partyId !== undefined ? { partyId: patch.partyId } : {}),
            ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
            ...(patch.phone !== undefined ? { phone: patch.phone.trim() } : {}),
            ...(patch.isInternational !== undefined ? { isInternational: patch.isInternational } : {}),
            ...(patch.tags !== undefined ? { tags: normalizeTags(patch.tags) } : {}),
            ...(patch.notes !== undefined ? { notes: patch.notes.trim() } : {}),
          };
          return updated;
        }),
      }));
      if (!updated) throw new Error(`Guest ${id} not found`);
      return updated;
    },

    async deleteGuest(id) {
      await ready();
      useDataStore.setState((s) => ({
        guests: s.guests.filter((g) => g.id !== id),
        rsvps: s.rsvps.filter((r) => r.guestId !== id),
        travel: s.travel.filter((t) => t.guestId !== id),
        idDocuments: s.idDocuments.filter((d) => d.guestId !== id),
        baggage: s.baggage.filter((b) => b.guestId !== id),
        checkIns: s.checkIns.filter((c) => c.guestId !== id),
        callLogs: s.callLogs.filter((c) => c.guestId !== id),
        messages: s.messages.filter((m) => m.guestId !== id),
        notifications: s.notifications.filter((n) => n.guestId !== id),
        rooms: s.rooms.map((r) => ({ ...r, guestIds: r.guestIds.filter((gid) => gid !== id) })),
      }));
    },

    async importGuests(eventId, rows) {
      await ready();
      const errors: { row: number; message: string }[] = [];
      let partiesCreated = 0;
      let guestsCreated = 0;

      useDataStore.setState((s) => {
        const parties = [...s.parties];
        const guests = [...s.guests];

        rows.forEach((row, i) => {
          const name = row.name?.trim();
          const phone = row.phone?.trim();
          if (!name || !phone) {
            errors.push({ row: i + 1, message: "Missing name or phone — row skipped." });
            return;
          }

          const familyName = (row.familyName || "Unassigned").trim() || "Unassigned";
          const side = row.side;
          const tags = normalizeTags(row.tags ?? []);

          let party = parties.find(
            (p) => p.eventId === eventId && p.side === side && p.name.toLowerCase() === familyName.toLowerCase(),
          );
          if (!party) {
            party = { id: genId("pty"), eventId, name: familyName, side, tags };
            parties.push(party);
            partiesCreated += 1;
          } else if (tags.length > 0) {
            const merged = normalizeTags([...party.tags, ...tags]);
            party = { ...party, tags: merged };
            parties[parties.findIndex((p) => p.id === party!.id)] = party;
          }

          guests.push({
            id: genId("g"),
            partyId: party.id,
            name,
            phone,
            isInternational: row.isInternational,
          });
          guestsCreated += 1;
        });

        return { parties, guests };
      });

      return { guestsCreated, partiesCreated, errors };
    },
  },

  logistics: {
    async listTravel(eventId) {
      await ready();
      const ids = guestIdsForEvent(eventId);
      return useDataStore.getState().travel.filter((t) => ids.has(t.guestId));
    },
    async listRooms(eventId) {
      await ready();
      return useDataStore.getState().rooms.filter((r) => r.eventId === eventId);
    },
    async listBaggage(eventId) {
      await ready();
      const ids = guestIdsForEvent(eventId);
      return useDataStore.getState().baggage.filter((b) => ids.has(b.guestId));
    },
    async listCheckIns(eventId) {
      await ready();
      const ids = guestIdsForEvent(eventId);
      return useDataStore.getState().checkIns.filter((c) => ids.has(c.guestId));
    },

    async listTravelForGuest(guestId) {
      await ready();
      return useDataStore
        .getState()
        .travel.filter((t) => t.guestId === guestId)
        .sort((a, b) => a.datetime.localeCompare(b.datetime));
    },
    async findRoomForGuest(guestId) {
      await ready();
      return useDataStore.getState().rooms.find((r) => r.guestIds.includes(guestId));
    },
    async listBaggageForGuest(guestId) {
      await ready();
      return useDataStore.getState().baggage.filter((b) => b.guestId === guestId);
    },

    async createTravel(input) {
      await ready();
      const travel: Travel = {
        id: genId("tr"),
        guestId: input.guestId,
        direction: input.direction,
        mode: input.mode,
        number: input.number.trim(),
        datetime: input.datetime,
        ...(input.airport?.trim() ? { airport: input.airport.trim() } : {}),
        pickupNeeded: input.pickupNeeded,
        ...(input.pickupNeeded && input.pickupArranged ? { pickupArranged: true } : {}),
      };
      useDataStore.setState((s) => ({ travel: [...s.travel, travel] }));
      return travel;
    },
    async updateTravel(id, patch) {
      await ready();
      return updateById("travel", id, (t) => {
        const next: Travel = {
          ...t,
          ...(patch.direction !== undefined ? { direction: patch.direction } : {}),
          ...(patch.mode !== undefined ? { mode: patch.mode } : {}),
          ...(patch.number !== undefined ? { number: patch.number.trim() } : {}),
          ...(patch.datetime !== undefined ? { datetime: patch.datetime } : {}),
          ...(patch.pickupNeeded !== undefined ? { pickupNeeded: patch.pickupNeeded } : {}),
          ...(patch.pickupArranged !== undefined ? { pickupArranged: patch.pickupArranged } : {}),
        };
        if (patch.airport !== undefined) {
          if (patch.airport.trim()) next.airport = patch.airport.trim();
          else delete next.airport;
        }
        // "Arranged" only makes sense while a pickup is needed.
        if (!next.pickupNeeded) delete next.pickupArranged;
        return next;
      });
    },
    async deleteTravel(id) {
      await ready();
      useDataStore.setState((s) => ({ travel: s.travel.filter((t) => t.id !== id) }));
    },

    async createBaggage(input) {
      await ready();
      const tag = input.tag.trim();
      if (!tag) throw new Error("A bag needs a tag.");
      const bag: Baggage = {
        id: genId("bag"),
        guestId: input.guestId,
        tag,
        ...(input.description?.trim() ? { description: input.description.trim() } : {}),
        status: input.status,
      };
      useDataStore.setState((s) => ({ baggage: [...s.baggage, bag] }));
      return bag;
    },
    async updateBaggage(id, patch) {
      await ready();
      return updateById("baggage", id, (b) => {
        const next: Baggage = {
          ...b,
          ...(patch.tag !== undefined ? { tag: patch.tag.trim() } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
        };
        if (patch.description !== undefined) {
          if (patch.description.trim()) next.description = patch.description.trim();
          else delete next.description;
        }
        return next;
      });
    },
    async deleteBaggage(id) {
      await ready();
      useDataStore.setState((s) => ({ baggage: s.baggage.filter((b) => b.id !== id) }));
    },

    async assignGuestToRoom(roomId, guestId) {
      await ready();
      const { rooms, guests } = useDataStore.getState();
      if (!rooms.some((r) => r.id === roomId)) throw new Error(`Room ${roomId} not found`);
      if (!guests.some((g) => g.id === guestId)) throw new Error(`Guest ${guestId} not found`);
      let updated: Room | undefined;
      useDataStore.setState((s) => ({
        rooms: s.rooms.map((r) => {
          const without = r.guestIds.filter((id) => id !== guestId);
          if (r.id !== roomId) return without.length === r.guestIds.length ? r : { ...r, guestIds: without };
          updated = { ...r, guestIds: [...without, guestId] };
          return updated;
        }),
      }));
      return updated!;
    },

    async unassignGuest(guestId) {
      await ready();
      useDataStore.setState((s) => ({
        rooms: s.rooms.map((r) =>
          r.guestIds.includes(guestId) ? { ...r, guestIds: r.guestIds.filter((id) => id !== guestId) } : r,
        ),
      }));
    },

    async recordCheckIn(guestId, stage) {
      await ready();
      const state = useDataStore.getState();
      const existing = state.checkIns.find((c) => c.guestId === guestId && c.stage === stage);
      if (existing) return existing;
      const guest = state.guests.find((g) => g.id === guestId);
      if (!guest) throw new Error(`Guest ${guestId} not found`);

      const at = new Date().toISOString();
      const checkIn: CheckIn = { id: genId("ci"), guestId, stage, at, by: "Staff: You" };
      const notifications = mockNotificationsFor(guest.id, stage, at);
      useDataStore.setState((s) => ({
        checkIns: [...s.checkIns, checkIn],
        notifications: [...s.notifications, ...notifications],
      }));
      return checkIn;
    },

    async undoCheckIn(id) {
      await ready();
      useDataStore.setState((s) => ({ checkIns: s.checkIns.filter((c) => c.id !== id) }));
    },

    async listNotifications(eventId) {
      await ready();
      const ids = guestIdsForEvent(eventId);
      return useDataStore
        .getState()
        .notifications.filter((n) => ids.has(n.guestId))
        .sort((a, b) => b.at.localeCompare(a.at));
    },
  },

  messaging: {
    async getConnection() {
      await ready();
      return useDataStore.getState().whatsapp;
    },
    async listTemplates() {
      await ready();
      return useDataStore.getState().templates;
    },
    async listCampaigns(eventId) {
      await ready();
      catchUpCampaigns(useDataStore.getState().campaigns.filter((c) => c.eventId === eventId));
      return useDataStore.getState().campaigns.filter((c) => c.eventId === eventId);
    },
    async listCallLogs(eventId) {
      await ready();
      const ids = guestIdsForEvent(eventId);
      return useDataStore.getState().callLogs.filter((c) => ids.has(c.guestId));
    },
    async listMessagesForGuest(guestId) {
      await ready();
      const campaignIds = new Set(
        useDataStore.getState().messages.filter((m) => m.guestId === guestId).map((m) => m.campaignId),
      );
      for (const id of campaignIds) catchUpDelivery(id);
      return useDataStore
        .getState()
        .messages.filter((m) => m.guestId === guestId)
        .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    },
    async estimateCost(_templateId, recipients) {
      await ready();
      return recipients.length * COST_PER_RECIPIENT_INR;
    },

    async getCampaign(id) {
      await ready();
      const current = useDataStore.getState().campaigns.find((c) => c.id === id);
      if (current) catchUpCampaigns([current]);
      return useDataStore.getState().campaigns.find((c) => c.id === id);
    },

    async listMessages(campaignId) {
      await ready();
      catchUpDelivery(campaignId);
      return useDataStore
        .getState()
        .messages.filter((m) => m.campaignId === campaignId)
        .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
    },

    async previewRecipients(eventId, audience) {
      await ready();
      return resolveAudience(eventId, audience);
    },

    async createTemplate(input) {
      await ready();
      const name = input.name.trim();
      const body = input.body.trim();
      if (!name || !body) throw new Error("A template needs a name and a body.");
      const template: MessageTemplate = { id: genId("tpl"), name, category: input.category, body };
      useDataStore.setState((s) => ({ templates: [...s.templates, template] }));
      return template;
    },

    async createCampaign(input) {
      await ready();
      const recipients = resolveAudience(input.eventId, input.audience);
      const campaign: Campaign = {
        id: genId("cmp"),
        eventId: input.eventId,
        name: input.name.trim() || "Untitled campaign",
        templateId: input.templateId,
        segment: audienceLabel(input.audience),
        audience: input.audience,
        recipients: recipients.length,
        status: "draft",
        estimatedCost: recipients.length * COST_PER_RECIPIENT_INR,
      };
      useDataStore.setState((s) => ({ campaigns: [...s.campaigns, campaign] }));
      return campaign;
    },

    async sendCampaign(id) {
      await ready();
      const campaign = useDataStore.getState().campaigns.find((c) => c.id === id);
      if (!campaign) throw new Error(`Campaign ${id} not found`);
      if (!campaign.audience) throw new Error("This campaign has no structured audience to send to.");
      if (campaign.status === "sending" || campaign.status === "sent") return campaign;

      const recipients = resolveAudience(campaign.eventId, campaign.audience);
      if (recipients.length === 0) throw new Error("No recipients match this audience.");

      const sentAt = new Date().toISOString();
      const outgoing: Message[] = recipients.map((g) => ({
        id: genId("msg"),
        campaignId: campaign.id,
        guestId: g.id,
        status: "queued",
        sentAt,
      }));

      let updated: Campaign | undefined;
      useDataStore.setState((s) => ({
        messages: [...s.messages, ...outgoing],
        campaigns: s.campaigns.map((c) => {
          if (c.id !== id) return c;
          updated = {
            ...c,
            status: "sending" as const,
            sentAt,
            recipients: recipients.length,
            estimatedCost: recipients.length * COST_PER_RECIPIENT_INR,
          };
          return updated;
        }),
      }));
      for (const m of outgoing) scheduleDelivery(m.id);
      return updated!;
    },
  },

  system: {
    async resetDemoData() {
      await ready();
      useDataStore.getState().resetDemoData();
    },
  },
};
