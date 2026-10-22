// In-memory implementation of the service contracts, backed by the
// client-side Zustand store (`src/store/data-store.ts`), which itself is
// seeded from and resettable to `src/mocks/data.ts`.
//
// This is the ONLY module allowed to read/write the data store directly.
// UI code must always go through `getServices()`.

import { maskIdNumber } from "@/lib/format";
import { dataStoreReady, genId, useDataStore, type DataState } from "@/store/data-store";
import type {
  Baggage,
  Campaign,
  CampaignAudience,
  EventFunction,
  Guest,
  IdDocument,
  Message,
  MessageStatus,
  MessageTemplate,
  Party,
  Rsvp,
  Travel,
} from "@/lib/types";
import type { Services } from "./types";

// Flat illustrative rate (INR) for the cost preview. Real rates come from
// the provider in a later phase.
const PER_MESSAGE_RATE = 0.85;

const round2 = (n: number) => Math.round(n * 100) / 100;

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
type IdCollection = "functions" | "parties" | "guests" | "travel" | "idDocuments" | "baggage";
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

function resolveAudienceSync(eventId: string, audience: CampaignAudience): Guest[] {
  const { parties, guests, rsvps } = useDataStore.getState();
  const partyById = new Map(parties.filter((p) => p.eventId === eventId).map((p) => [p.id, p]));
  const eventGuests = guests.filter((g) => partyById.has(g.partyId));

  switch (audience.type) {
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
  switch (audience.type) {
    case "all":
      return "All guests";
    case "function": {
      const fn = useDataStore.getState().functions.find((f) => f.id === audience.functionId);
      return `Attending ${fn?.name ?? "function"}`;
    }
    case "side":
      return `${audience.side[0].toUpperCase()}${audience.side.slice(1)} side`;
    case "tag":
      return `Tag: ${audience.tag}`;
  }
}

// ---------------------------------------------------------------------------
// Delivery simulation. Timings (from send): sent after 1-2s, delivered after
// 3-5s, read after 8-12s. Each hop writes to the store, which notifies
// `messaging.subscribe` listeners. Pending hops are re-scheduled after a
// page reload so nothing gets stuck at "queued".
// ---------------------------------------------------------------------------
const NEXT_HOP: Partial<Record<MessageStatus, { status: MessageStatus; minMs: number; maxMs: number }>> = {
  queued: { status: "sent", minMs: 1000, maxMs: 2000 },
  sent: { status: "delivered", minMs: 2000, maxMs: 3000 }, // cumulative 3-5s
  delivered: { status: "read", minMs: 5000, maxMs: 7000 }, // cumulative 8-12s
};
const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);
const scheduled = new Set<string>();

function setMessageStatus(id: string, status: MessageStatus) {
  const now = new Date().toISOString();
  useDataStore.setState((s) => ({
    messages: s.messages.map((m) =>
      m.id === id
        ? {
            ...m,
            status,
            ...(status === "delivered" ? { deliveredAt: now } : {}),
            ...(status === "read" ? { readAt: now } : {}),
          }
        : m,
    ),
  }));
}

// A campaign counts as "sent" once every message has left the queue.
function settleCampaignStatus(campaignId: string) {
  const { messages, campaigns } = useDataStore.getState();
  const mine = messages.filter((m) => m.campaignId === campaignId);
  if (mine.length === 0 || mine.some((m) => m.status === "queued")) return;
  if (campaigns.find((c) => c.id === campaignId)?.status === "sent") return;
  useDataStore.setState((s) => ({
    campaigns: s.campaigns.map((c) => (c.id === campaignId ? { ...c, status: "sent" } : c)),
  }));
}

function scheduleHop(messageId: string) {
  if (typeof window === "undefined" || scheduled.has(messageId)) return;
  const message = useDataStore.getState().messages.find((m) => m.id === messageId);
  const hop = message && NEXT_HOP[message.status];
  if (!hop) return;
  scheduled.add(messageId);
  window.setTimeout(() => {
    scheduled.delete(messageId);
    const current = useDataStore.getState().messages.find((m) => m.id === messageId);
    if (!current || current.status !== message.status) return; // reset or changed meanwhile
    setMessageStatus(messageId, hop.status);
    if (hop.status === "sent") settleCampaignStatus(current.campaignId);
    scheduleHop(messageId);
  }, randomBetween(hop.minMs, hop.maxMs));
}

// Anything still mid-flight from a recent send gets its remaining hops
// re-scheduled. Older non-final messages (e.g. seed data that was only
// "delivered") are historical and left alone.
const RESUME_WINDOW_MS = 60_000;
function resumeDeliveries() {
  const cutoff = Date.now() - RESUME_WINDOW_MS;
  for (const m of useDataStore.getState().messages) {
    if (NEXT_HOP[m.status] && new Date(m.sentAt).getTime() > cutoff) scheduleHop(m.id);
  }
}
if (typeof window !== "undefined") {
  dataStoreReady.then(resumeDeliveries);
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
        };
        if (patch.airport !== undefined) {
          if (patch.airport.trim()) next.airport = patch.airport.trim();
          else delete next.airport;
        }
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
      const bag: Baggage = { id: genId("bag"), guestId: input.guestId, tag, status: input.status };
      useDataStore.setState((s) => ({ baggage: [...s.baggage, bag] }));
      return bag;
    },
    async updateBaggage(id, patch) {
      await ready();
      return updateById("baggage", id, (b) => ({
        ...b,
        ...(patch.tag !== undefined ? { tag: patch.tag.trim() } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
      }));
    },
    async deleteBaggage(id) {
      await ready();
      useDataStore.setState((s) => ({ baggage: s.baggage.filter((b) => b.id !== id) }));
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
    async createTemplate(input) {
      await ready();
      const name = input.name.trim();
      const body = input.body.trim();
      if (!name || !body) throw new Error("Template needs a name and a body.");
      const template: MessageTemplate = { id: genId("tpl"), name, category: input.category, body };
      useDataStore.setState((s) => ({ templates: [...s.templates, template] }));
      return template;
    },

    async listCampaigns(eventId) {
      await ready();
      return useDataStore
        .getState()
        .campaigns.filter((c) => c.eventId === eventId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async getCampaign(id) {
      await ready();
      return useDataStore.getState().campaigns.find((c) => c.id === id);
    },
    async resolveAudience(eventId, audience) {
      await ready();
      return resolveAudienceSync(eventId, audience);
    },
    async createCampaign(input) {
      await ready();
      if (!useDataStore.getState().templates.some((t) => t.id === input.templateId)) {
        throw new Error("Pick a template first.");
      }
      const recipients = resolveAudienceSync(input.eventId, input.audience);
      const campaign: Campaign = {
        id: genId("cmp"),
        eventId: input.eventId,
        name: input.name.trim() || "Untitled campaign",
        templateId: input.templateId,
        audience: input.audience,
        segment: audienceLabel(input.audience),
        recipients: recipients.length,
        status: "draft",
        estimatedCost: round2(recipients.length * PER_MESSAGE_RATE),
        createdAt: new Date().toISOString(),
      };
      useDataStore.setState((s) => ({ campaigns: [...s.campaigns, campaign] }));
      return campaign;
    },
    async sendCampaign(id) {
      await ready();
      const campaign = useDataStore.getState().campaigns.find((c) => c.id === id);
      if (!campaign) throw new Error(`Campaign ${id} not found`);
      if (campaign.status === "sending" || campaign.status === "sent") return campaign;

      // Re-resolve at send time so late RSVP changes are honoured.
      const recipients = resolveAudienceSync(campaign.eventId, campaign.audience);
      if (recipients.length === 0) throw new Error("This audience has no guests right now.");
      const now = new Date().toISOString();
      const queued: Message[] = recipients.map((g) => ({
        id: genId("msg"),
        campaignId: id,
        guestId: g.id,
        status: "queued",
        sentAt: now,
      }));
      const updated: Campaign = {
        ...campaign,
        status: "sending",
        sentAt: now,
        recipients: recipients.length,
        estimatedCost: round2(recipients.length * PER_MESSAGE_RATE),
      };
      useDataStore.setState((s) => ({
        campaigns: s.campaigns.map((c) => (c.id === id ? updated : c)),
        messages: [...s.messages, ...queued],
      }));
      queued.forEach((m) => scheduleHop(m.id));
      return updated;
    },

    async listMessages(eventId) {
      await ready();
      const { campaigns, messages } = useDataStore.getState();
      const ids = new Set(campaigns.filter((c) => c.eventId === eventId).map((c) => c.id));
      return messages.filter((m) => ids.has(m.campaignId));
    },
    async listMessagesForCampaign(campaignId) {
      await ready();
      return useDataStore.getState().messages.filter((m) => m.campaignId === campaignId);
    },
    async listMessagesForGuest(guestId) {
      await ready();
      return useDataStore
        .getState()
        .messages.filter((m) => m.guestId === guestId)
        .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    },

    subscribe(listener) {
      return useDataStore.subscribe((state, prev) => {
        if (state.messages !== prev.messages || state.campaigns !== prev.campaigns) listener();
      });
    },

    async listCallLogs(eventId) {
      await ready();
      const ids = guestIdsForEvent(eventId);
      return useDataStore.getState().callLogs.filter((c) => ids.has(c.guestId));
    },
    async getRatePerMessage() {
      return PER_MESSAGE_RATE;
    },
    async estimateCost(templateId, recipients) {
      await ready();
      if (!useDataStore.getState().templates.some((t) => t.id === templateId)) return 0;
      return round2(recipients.length * PER_MESSAGE_RATE);
    },
  },

  system: {
    async resetDemoData() {
      await ready();
      useDataStore.getState().resetDemoData();
    },
  },
};
