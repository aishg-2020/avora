// Core domain types. Kept event-type agnostic so corporate events can reuse
// the same model later; type-specific fields go in `custom`.

export type EventType = "wedding" | "corporate";

export interface Event {
  id: string;
  name: string;
  type: EventType;
  city: string;
  startDate: string; // ISO date
  endDate: string;
  custom?: Record<string, unknown>;
}

export interface EventFunction {
  id: string;
  eventId: string;
  name: string;
  startsAt: string; // ISO datetime
  venue: string;
}

export type Side = "bride" | "groom" | "common";

export interface Party {
  id: string;
  eventId: string;
  name: string;
  side: Side;
  tags: string[];
}

export interface Guest {
  id: string;
  partyId: string;
  name: string;
  phone: string;
  isInternational: boolean;
  custom?: Record<string, unknown>;
}

export type RsvpStatus = "pending" | "attending" | "declined" | "maybe";

export interface Rsvp {
  guestId: string;
  functionId: string;
  status: RsvpStatus;
  headcount: number;
}

export type TravelMode = "flight" | "train" | "road";

export interface Travel {
  id: string;
  guestId: string;
  direction: "arrival" | "departure";
  mode: TravelMode;
  number: string;
  datetime: string;
  pickupNeeded: boolean;
}

export interface IdDocument {
  id: string;
  guestId: string;
  kind: "aadhaar" | "passport" | "driving_license" | "other";
  maskedNumber: string;
  sides: ("front" | "back")[];
  verified: boolean;
}

export interface Room {
  id: string;
  eventId: string;
  hotel: string;
  roomNo: string;
  type: string;
  capacity: number;
  guestIds: string[];
}

export type BaggageStatus = "at_airport" | "in_transit" | "in_room";

export interface Baggage {
  guestId: string;
  count: number;
  tags: string[];
  status: BaggageStatus;
}

export type CheckInStage = "airport" | "hotel" | "venue";

export interface CheckIn {
  id: string;
  guestId: string;
  stage: CheckInStage;
  at: string;
  by: string;
}

export type TemplateCategory = "marketing" | "utility";

export interface MessageTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  body: string;
}

export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent";

export interface Campaign {
  id: string;
  eventId: string;
  name: string;
  templateId: string;
  segment: string;
  recipients: number;
  status: CampaignStatus;
  estimatedCost: number; // INR
  sentAt?: string;
}

export interface CallLog {
  id: string;
  guestId: string;
  direction: "inbound" | "outbound";
  durationSec: number;
  at: string;
  summary: string;
}

export interface WhatsAppConnection {
  connected: boolean;
  phoneNumber: string;
  displayName: string;
  qualityRating: "green" | "yellow" | "red";
  messagingTier: number; // unique users per 24h
}
