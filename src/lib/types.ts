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
  description?: string;
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
  /** Guest-level tags (e.g. "Vegetarian"); family-level tags live on the Party. */
  tags?: string[];
  /** Free-text planner notes about this guest. */
  notes?: string;
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

export type TravelDirection = "arrival" | "departure";

export interface Travel {
  id: string;
  guestId: string;
  direction: TravelDirection;
  mode: TravelMode;
  number: string; // flight / train number, or vehicle for road
  datetime: string;
  /** Airport, station or pickup point. */
  airport?: string;
  pickupNeeded: boolean;
  /** Set once the planner has organised the pickup/drop. Only meaningful when pickupNeeded. */
  pickupArranged?: boolean;
}

export type IdDocumentKind = "aadhaar" | "passport" | "driving_license" | "other";
export type IdDocumentSide = "front" | "back";

export interface IdDocument {
  id: string;
  guestId: string;
  kind: IdDocumentKind;
  maskedNumber: string;
  /** ISO date. Optional: Aadhaar has no expiry. */
  expiresAt?: string;
  /** Which sides the guest has sent a photo of. Images themselves are never
   * stored in the mock phase. */
  sides: IdDocumentSide[];
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

export type BaggageStatus = "checked_in" | "on_belt" | "collected";

// One record per bag so each can be tracked individually.
export interface Baggage {
  id: string;
  guestId: string;
  tag: string; // printed luggage tag, e.g. AV-001
  description?: string; // "Black Samsonite, red ribbon"
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

export type NotificationKind = "hotel" | "whatsapp" | "driver" | "baggage" | "host";

// Mock outbound notification triggered by a check-in: what *would* have
// been sent to the hotel, the guest, the driver, etc.
export interface Notification {
  id: string;
  guestId: string;
  stage: CheckInStage;
  kind: NotificationKind;
  text: string;
  at: string;
}

export type TemplateCategory = "marketing" | "utility";

export interface MessageTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  body: string;
}

export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent";

// Structured targeting for a campaign. `segment` on Campaign stays the
// human-readable label derived from this.
export type CampaignAudience =
  | { kind: "all" }
  | { kind: "function"; functionId: string } // guests attending that function
  | { kind: "side"; side: Side }
  | { kind: "tag"; tag: string }; // family/guest tag, or "International"

export interface Campaign {
  id: string;
  eventId: string;
  name: string;
  templateId: string;
  segment: string;
  /** Missing on legacy/seed drafts that only have a label. */
  audience?: CampaignAudience;
  recipients: number;
  status: CampaignStatus;
  estimatedCost: number; // INR
  sentAt?: string;
}

export type MessageStatus = "queued" | "sent" | "delivered" | "read" | "failed";

// One WhatsApp message delivered to one guest as part of a campaign.
export interface Message {
  id: string;
  campaignId: string;
  guestId: string;
  status: MessageStatus;
  sentAt: string;
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
