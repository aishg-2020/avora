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
  Message,
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
  { id: "fn_1", eventId: "evt_1", name: "Haldi", startsAt: "2026-12-12T10:00:00+05:30", venue: "Poolside Lawn", description: "Close family only. Yellow dress code." },
  { id: "fn_2", eventId: "evt_1", name: "Mehendi", startsAt: "2026-12-12T15:00:00+05:30", venue: "Courtyard", description: "Henna artists from 2 pm; light snacks." },
  { id: "fn_3", eventId: "evt_1", name: "Sangeet", startsAt: "2026-12-12T20:00:00+05:30", venue: "Grand Ballroom", description: "Performances and DJ until midnight." },
  { id: "fn_4", eventId: "evt_1", name: "Pheras", startsAt: "2026-12-13T19:00:00+05:30", venue: "Palace Gardens", description: "Main ceremony followed by dinner." },
];

export const parties: Party[] = [
  { id: "pty_1", eventId: "evt_1", name: "Sharma Family", side: "bride", tags: ["VIP"] },
  { id: "pty_2", eventId: "evt_1", name: "Gupta Family", side: "groom", tags: [] },
  { id: "pty_3", eventId: "evt_1", name: "Patel Family", side: "groom", tags: ["NRI"] },
  { id: "pty_4", eventId: "evt_1", name: "College Friends", side: "common", tags: [] },
];

export const guests: Guest[] = [
  { id: "g_1", partyId: "pty_1", name: "Rajesh Sharma", phone: "+91 98290 11111", isInternational: false, tags: ["Vegetarian"], notes: "Bride's uncle. Needs a wheelchair-accessible room." },
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
  { id: "tr_1", guestId: "g_1", direction: "arrival", mode: "flight", number: "6E 204", datetime: "2026-12-11T14:30:00+05:30", airport: "Jaipur (JAI)", pickupNeeded: true },
  { id: "tr_2", guestId: "g_3", direction: "arrival", mode: "train", number: "12956", datetime: "2026-12-11T09:15:00+05:30", airport: "Jaipur Junction", pickupNeeded: true },
  { id: "tr_3", guestId: "g_5", direction: "arrival", mode: "flight", number: "AI 112", datetime: "2026-12-11T23:50:00+05:30", airport: "Jaipur (JAI)", pickupNeeded: true },
  { id: "tr_4", guestId: "g_8", direction: "arrival", mode: "flight", number: "EK 572", datetime: "2026-12-12T03:40:00+05:30", airport: "Jaipur (JAI)", pickupNeeded: false },
  { id: "tr_5", guestId: "g_1", direction: "departure", mode: "flight", number: "6E 205", datetime: "2026-12-14T11:00:00+05:30", airport: "Jaipur (JAI)", pickupNeeded: true },
];

export const idDocuments: IdDocument[] = [
  { id: "id_1", guestId: "g_1", kind: "aadhaar", maskedNumber: "XXXX XXXX 4821", sides: ["front", "back"], verified: true },
  { id: "id_2", guestId: "g_3", kind: "aadhaar", maskedNumber: "XXXX XXXX 1937", sides: ["front"], verified: false },
  { id: "id_3", guestId: "g_5", kind: "passport", maskedNumber: "XXXXX6723", expiresAt: "2031-03-14", sides: ["front"], verified: true },
];

export const rooms: Room[] = [
  { id: "rm_1", eventId: "evt_1", hotel: "Rambagh Palace", roomNo: "101", type: "Deluxe", capacity: 2, guestIds: ["g_1", "g_2"] },
  { id: "rm_2", eventId: "evt_1", hotel: "Rambagh Palace", roomNo: "102", type: "Deluxe", capacity: 2, guestIds: ["g_3", "g_4"] },
  { id: "rm_3", eventId: "evt_1", hotel: "Rambagh Palace", roomNo: "201", type: "Suite", capacity: 3, guestIds: ["g_5", "g_6"] },
  { id: "rm_4", eventId: "evt_1", hotel: "Rambagh Palace", roomNo: "202", type: "Deluxe", capacity: 2, guestIds: [] },
];

export const baggage: Baggage[] = [
  { id: "bag_1", guestId: "g_1", tag: "AV-001", status: "in_room" },
  { id: "bag_2", guestId: "g_1", tag: "AV-002", status: "in_room" },
  { id: "bag_3", guestId: "g_1", tag: "AV-003", status: "in_room" },
  { id: "bag_4", guestId: "g_3", tag: "AV-004", status: "in_transit" },
  { id: "bag_5", guestId: "g_3", tag: "AV-005", status: "in_transit" },
  { id: "bag_6", guestId: "g_5", tag: "AV-006", status: "at_airport" },
  { id: "bag_7", guestId: "g_5", tag: "AV-007", status: "at_airport" },
  { id: "bag_8", guestId: "g_5", tag: "AV-008", status: "at_airport" },
  { id: "bag_9", guestId: "g_5", tag: "AV-009", status: "at_airport" },
];

export const checkIns: CheckIn[] = [
  { id: "ci_1", guestId: "g_1", stage: "airport", at: "2026-12-11T14:45:00+05:30", by: "Staff: Pooja" },
  { id: "ci_2", guestId: "g_1", stage: "hotel", at: "2026-12-11T15:40:00+05:30", by: "Staff: Pooja" },
  { id: "ci_3", guestId: "g_3", stage: "airport", at: "2026-12-11T09:30:00+05:30", by: "Staff: Arjun" },
];

// Placeholders: {{guest_name}}, {{function_name}}, {{event_name}}.
export const templates: MessageTemplate[] = [
  { id: "tpl_1", name: "Save the date + RSVP", category: "marketing", body: "Hi {{guest_name}}, you're invited to {{function_name}}! Tap below to let us know if you can make it." },
  { id: "tpl_2", name: "Travel details request", category: "utility", body: "Hi {{guest_name}}, please share your arrival details for {{event_name}} so we can arrange your pickup." },
  { id: "tpl_3", name: "ID upload request", category: "utility", body: "Hi {{guest_name}}, please send front and back photos of your ID for hotel check-in." },
  { id: "tpl_4", name: "Function reminder", category: "utility", body: "Hi {{guest_name}}, a reminder that {{function_name}} starts soon. See you there!" },
];

export const campaigns: Campaign[] = [
  { id: "cmp_1", eventId: "evt_1", name: "Save the date", templateId: "tpl_1", audience: { type: "all" }, segment: "All guests", recipients: 8, status: "sent", estimatedCost: 6.8, createdAt: "2026-10-20T10:45:00+05:30", sentAt: "2026-10-20T11:00:00+05:30" },
  { id: "cmp_2", eventId: "evt_1", name: "Collect travel", templateId: "tpl_2", audience: { type: "function", functionId: "fn_4" }, segment: "Attending Pheras", recipients: 2, status: "draft", estimatedCost: 1.7, createdAt: "2026-10-21T09:30:00+05:30" },
  { id: "cmp_3", eventId: "evt_1", name: "Collect IDs", templateId: "tpl_3", audience: { type: "tag", tag: "NRI" }, segment: "Tag: NRI", recipients: 2, status: "draft", estimatedCost: 1.7, createdAt: "2026-10-21T09:40:00+05:30" },
];

// Per-guest delivery log for campaigns that have actually gone out.
export const messages: Message[] = [
  { id: "msg_1", campaignId: "cmp_1", guestId: "g_1", status: "read", sentAt: "2026-10-20T11:00:05+05:30", deliveredAt: "2026-10-20T11:00:09+05:30", readAt: "2026-10-20T11:04:12+05:30" },
  { id: "msg_2", campaignId: "cmp_1", guestId: "g_2", status: "delivered", sentAt: "2026-10-20T11:00:06+05:30", deliveredAt: "2026-10-20T11:00:10+05:30" },
  { id: "msg_3", campaignId: "cmp_1", guestId: "g_3", status: "read", sentAt: "2026-10-20T11:00:07+05:30", deliveredAt: "2026-10-20T11:00:11+05:30", readAt: "2026-10-20T12:30:00+05:30" },
  { id: "msg_4", campaignId: "cmp_1", guestId: "g_4", status: "delivered", sentAt: "2026-10-20T11:00:08+05:30", deliveredAt: "2026-10-20T11:00:12+05:30" },
  { id: "msg_5", campaignId: "cmp_1", guestId: "g_5", status: "read", sentAt: "2026-10-20T11:00:09+05:30", deliveredAt: "2026-10-20T11:00:15+05:30", readAt: "2026-10-20T19:05:00+05:30" },
  { id: "msg_6", campaignId: "cmp_1", guestId: "g_6", status: "sent", sentAt: "2026-10-20T11:00:10+05:30" },
  { id: "msg_7", campaignId: "cmp_1", guestId: "g_7", status: "read", sentAt: "2026-10-20T11:00:11+05:30", deliveredAt: "2026-10-20T11:00:14+05:30", readAt: "2026-10-20T11:20:00+05:30" },
  { id: "msg_8", campaignId: "cmp_1", guestId: "g_8", status: "failed", sentAt: "2026-10-20T11:00:12+05:30" },
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
