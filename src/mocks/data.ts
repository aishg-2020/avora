// Seed data for the mock phase. Everything the UI shows comes from here.

import type {
  Baggage,
  CallLog,
  Campaign,
  CheckIn,
  Event,
  EventFunction,
  Guest,
  IdDocument,
  MessageTemplate,
  Party,
  Room,
  Rsvp,
  Travel,
  WhatsAppConnection,
} from "@/lib/types";

export const events: Event[] = [
  {
    id: "evt_1",
    name: "Aarav & Meera Wedding",
    type: "wedding",
    city: "Jaipur",
    startDate: "2026-12-12",
    endDate: "2026-12-13",
  },
];

export const functions: EventFunction[] = [
  { id: "fn_1", eventId: "evt_1", name: "Haldi", startsAt: "2026-12-12T10:00:00+05:30", venue: "Poolside Lawn" },
  { id: "fn_2", eventId: "evt_1", name: "Mehendi", startsAt: "2026-12-12T15:00:00+05:30", venue: "Courtyard" },
  { id: "fn_3", eventId: "evt_1", name: "Sangeet", startsAt: "2026-12-12T20:00:00+05:30", venue: "Grand Ballroom" },
  { id: "fn_4", eventId: "evt_1", name: "Pheras", startsAt: "2026-12-13T19:00:00+05:30", venue: "Palace Gardens" },
];

export const parties: Party[] = [
  { id: "pty_1", eventId: "evt_1", name: "Sharma Family", side: "bride", tags: ["VIP"] },
  { id: "pty_2", eventId: "evt_1", name: "Gupta Family", side: "groom", tags: [] },
  { id: "pty_3", eventId: "evt_1", name: "Patel Family", side: "groom", tags: ["NRI"] },
  { id: "pty_4", eventId: "evt_1", name: "College Friends", side: "common", tags: [] },
];

export const guests: Guest[] = [
  { id: "g_1", partyId: "pty_1", name: "Rajesh Sharma", phone: "+91 98290 11111", isInternational: false },
  { id: "g_2", partyId: "pty_1", name: "Sunita Sharma", phone: "+91 98290 22222", isInternational: false },
  { id: "g_3", partyId: "pty_2", name: "Vikram Gupta", phone: "+91 99280 33333", isInternational: false },
  { id: "g_4", partyId: "pty_2", name: "Anjali Gupta", phone: "+91 99280 44444", isInternational: false },
  { id: "g_5", partyId: "pty_3", name: "Nikhil Patel", phone: "+1 415 555 0100", isInternational: true },
  { id: "g_6", partyId: "pty_3", name: "Riya Patel", phone: "+1 415 555 0101", isInternational: true },
  { id: "g_7", partyId: "pty_4", name: "Kabir Singh", phone: "+91 97720 55555", isInternational: false },
  { id: "g_8", partyId: "pty_4", name: "Ishita Rao", phone: "+971 50 123 4567", isInternational: true },
];

export const rsvps: Rsvp[] = [
  { guestId: "g_1", functionId: "fn_1", status: "attending", headcount: 2 },
  { guestId: "g_1", functionId: "fn_3", status: "attending", headcount: 2 },
  { guestId: "g_1", functionId: "fn_4", status: "attending", headcount: 2 },
  { guestId: "g_3", functionId: "fn_3", status: "attending", headcount: 2 },
  { guestId: "g_3", functionId: "fn_4", status: "maybe", headcount: 2 },
  { guestId: "g_5", functionId: "fn_4", status: "attending", headcount: 2 },
  { guestId: "g_7", functionId: "fn_3", status: "declined", headcount: 0 },
  { guestId: "g_8", functionId: "fn_4", status: "pending", headcount: 1 },
];

export const travel: Travel[] = [
  { id: "tr_1", guestId: "g_1", direction: "arrival", mode: "flight", number: "6E 204", datetime: "2026-12-11T14:30:00+05:30", pickupNeeded: true },
  { id: "tr_2", guestId: "g_3", direction: "arrival", mode: "train", number: "12956", datetime: "2026-12-11T09:15:00+05:30", pickupNeeded: true },
  { id: "tr_3", guestId: "g_5", direction: "arrival", mode: "flight", number: "AI 112", datetime: "2026-12-11T23:50:00+05:30", pickupNeeded: true },
  { id: "tr_4", guestId: "g_8", direction: "arrival", mode: "flight", number: "EK 572", datetime: "2026-12-12T03:40:00+05:30", pickupNeeded: false },
  { id: "tr_5", guestId: "g_1", direction: "departure", mode: "flight", number: "6E 205", datetime: "2026-12-14T11:00:00+05:30", pickupNeeded: true },
];

export const idDocuments: IdDocument[] = [
  { id: "id_1", guestId: "g_1", kind: "aadhaar", maskedNumber: "XXXX XXXX 4821", sides: ["front", "back"], verified: true },
  { id: "id_2", guestId: "g_3", kind: "aadhaar", maskedNumber: "XXXX XXXX 1937", sides: ["front"], verified: false },
  { id: "id_3", guestId: "g_5", kind: "passport", maskedNumber: "XXXXX6723", sides: ["front"], verified: true },
];

export const rooms: Room[] = [
  { id: "rm_1", eventId: "evt_1", hotel: "Rambagh Palace", roomNo: "101", type: "Deluxe", capacity: 2, guestIds: ["g_1", "g_2"] },
  { id: "rm_2", eventId: "evt_1", hotel: "Rambagh Palace", roomNo: "102", type: "Deluxe", capacity: 2, guestIds: ["g_3", "g_4"] },
  { id: "rm_3", eventId: "evt_1", hotel: "Rambagh Palace", roomNo: "201", type: "Suite", capacity: 3, guestIds: ["g_5", "g_6"] },
  { id: "rm_4", eventId: "evt_1", hotel: "Rambagh Palace", roomNo: "202", type: "Deluxe", capacity: 2, guestIds: [] },
];

export const baggage: Baggage[] = [
  { guestId: "g_1", count: 3, tags: ["AV-001", "AV-002", "AV-003"], status: "in_room" },
  { guestId: "g_3", count: 2, tags: ["AV-004", "AV-005"], status: "in_transit" },
  { guestId: "g_5", count: 4, tags: ["AV-006", "AV-007", "AV-008", "AV-009"], status: "at_airport" },
];

export const checkIns: CheckIn[] = [
  { id: "ci_1", guestId: "g_1", stage: "airport", at: "2026-12-11T14:45:00+05:30", by: "Staff: Pooja" },
  { id: "ci_2", guestId: "g_1", stage: "hotel", at: "2026-12-11T15:40:00+05:30", by: "Staff: Pooja" },
  { id: "ci_3", guestId: "g_3", stage: "airport", at: "2026-12-11T09:30:00+05:30", by: "Staff: Arjun" },
];

export const templates: MessageTemplate[] = [
  { id: "tpl_1", name: "Save the date + RSVP", category: "marketing", body: "Hi {{name}}, you're invited to {{event}}! Tap below to RSVP." },
  { id: "tpl_2", name: "Travel details request", category: "utility", body: "Hi {{name}}, please share your arrival details for {{event}}." },
  { id: "tpl_3", name: "ID upload request", category: "utility", body: "Hi {{name}}, please send front and back photos of your ID for hotel check-in." },
  { id: "tpl_4", name: "Welcome + room details", category: "utility", body: "Welcome {{name}}! Your room is {{room}} at {{hotel}}." },
];

export const campaigns: Campaign[] = [
  { id: "cmp_1", eventId: "evt_1", name: "Save the date", templateId: "tpl_1", segment: "All guests", recipients: 8, status: "sent", estimatedCost: 9.4, sentAt: "2026-10-20T11:00:00+05:30" },
  { id: "cmp_2", eventId: "evt_1", name: "Collect travel", templateId: "tpl_2", segment: "Attending", recipients: 5, status: "scheduled", estimatedCost: 1.2 },
  { id: "cmp_3", eventId: "evt_1", name: "Collect IDs", templateId: "tpl_3", segment: "Missing ID", recipients: 5, status: "draft", estimatedCost: 1.2 },
];

export const callLogs: CallLog[] = [
  { id: "call_1", guestId: "g_3", direction: "inbound", durationSec: 142, at: "2026-10-21T17:10:00+05:30", summary: "Asked to change train arrival to 11 Dec morning; needs pickup for 2." },
  { id: "call_2", guestId: "g_5", direction: "outbound", durationSec: 88, at: "2026-10-21T19:30:00+05:30", summary: "Confirmed attending Pheras only; requested vegetarian meals." },
];

export const whatsapp: WhatsAppConnection = {
  connected: true,
  phoneNumber: "+91 90000 00000 (mock)",
  displayName: "Avora Events",
  qualityRating: "green",
  messagingTier: 1000,
};
