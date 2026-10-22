// In-memory implementation of the service contracts, backed by src/mocks.

import * as db from "@/mocks/data";
import type { Services } from "./types";

// Illustrative per-message rates (INR) for the cost preview. Placeholder
// numbers only; real rates come from the provider in a later phase.
const MOCK_RATES = {
  marketing: { domestic: 0.88, international: 2.0 },
  utility: { domestic: 0.15, international: 0.5 },
} as const;

const guestIdsForEvent = (eventId: string) => {
  const partyIds = new Set(db.parties.filter((p) => p.eventId === eventId).map((p) => p.id));
  return new Set(db.guests.filter((g) => partyIds.has(g.partyId)).map((g) => g.id));
};

export const mockServices: Services = {
  events: {
    async getEvent(id) {
      return db.events.find((e) => e.id === id);
    },
    async listFunctions(eventId) {
      return db.functions.filter((f) => f.eventId === eventId);
    },
  },

  guests: {
    async listParties(eventId) {
      return db.parties.filter((p) => p.eventId === eventId);
    },
    async listGuests(eventId) {
      const ids = guestIdsForEvent(eventId);
      return db.guests.filter((g) => ids.has(g.id));
    },
    async listRsvps(eventId) {
      const ids = guestIdsForEvent(eventId);
      return db.rsvps.filter((r) => ids.has(r.guestId));
    },
    async listIdDocuments(eventId) {
      const ids = guestIdsForEvent(eventId);
      return db.idDocuments.filter((d) => ids.has(d.guestId));
    },
  },

  logistics: {
    async listTravel(eventId) {
      const ids = guestIdsForEvent(eventId);
      return db.travel.filter((t) => ids.has(t.guestId));
    },
    async listRooms(eventId) {
      return db.rooms.filter((r) => r.eventId === eventId);
    },
    async listBaggage(eventId) {
      const ids = guestIdsForEvent(eventId);
      return db.baggage.filter((b) => ids.has(b.guestId));
    },
    async listCheckIns(eventId) {
      const ids = guestIdsForEvent(eventId);
      return db.checkIns.filter((c) => ids.has(c.guestId));
    },
  },

  messaging: {
    async getConnection() {
      return db.whatsapp;
    },
    async listTemplates() {
      return db.templates;
    },
    async listCampaigns(eventId) {
      return db.campaigns.filter((c) => c.eventId === eventId);
    },
    async listCallLogs(eventId) {
      const ids = guestIdsForEvent(eventId);
      return db.callLogs.filter((c) => ids.has(c.guestId));
    },
    async estimateCost(templateId, recipients) {
      const template = db.templates.find((t) => t.id === templateId);
      if (!template) return 0;
      const rates = MOCK_RATES[template.category];
      return recipients.reduce(
        (sum, g) => sum + (g.isInternational ? rates.international : rates.domestic),
        0,
      );
    },
  },
};
