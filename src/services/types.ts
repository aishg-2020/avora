// Service contracts. Pages only talk to these interfaces, so swapping the
// mock implementation for a real backend later doesn't touch the UI.

import type {
  Baggage,
  BaggageStatus,
  CallLog,
  Campaign,
  CampaignAudience,
  CheckIn,
  Event,
  EventFunction,
  Guest,
  IdDocument,
  IdDocumentKind,
  IdDocumentSide,
  Message,
  MessageTemplate,
  Party,
  Room,
  Rsvp,
  RsvpStatus,
  Side,
  TemplateCategory,
  Travel,
  TravelDirection,
  TravelMode,
  WhatsAppConnection,
} from "@/lib/types";

export interface CreateFunctionInput {
  eventId: string;
  name: string;
  startsAt: string; // ISO datetime
  venue: string;
  description?: string;
}

export type UpdateFunctionInput = Partial<Omit<CreateFunctionInput, "eventId">>;

export interface EventService {
  getEvent(id: string): Promise<Event | undefined>;
  /** Sorted chronologically by start time. */
  listFunctions(eventId: string): Promise<EventFunction[]>;

  createFunction(input: CreateFunctionInput): Promise<EventFunction>;
  updateFunction(id: string, patch: UpdateFunctionInput): Promise<EventFunction>;
  /** Also removes every RSVP recorded against the function. */
  deleteFunction(id: string): Promise<void>;
}

// Input payloads for the mutating guest/party endpoints. Kept separate from
// the domain types so the UI never has to fabricate ids.
export interface CreatePartyInput {
  eventId: string;
  name: string;
  side: Side;
  tags: string[];
}

export interface UpdatePartyInput {
  name?: string;
  side?: Side;
  tags?: string[];
}

export interface CreateGuestInput {
  partyId: string;
  name: string;
  phone: string;
  isInternational: boolean;
}

export interface UpdateGuestInput {
  partyId?: string;
  name?: string;
  phone?: string;
  isInternational?: boolean;
  tags?: string[];
  notes?: string;
}

export interface UpsertRsvpInput {
  guestId: string;
  functionId: string;
  status: RsvpStatus;
  headcount: number;
}

export interface CreateIdDocumentInput {
  guestId: string;
  kind: IdDocumentKind;
  /** Raw or already-masked number; the service always stores it masked. */
  number: string;
  expiresAt?: string;
  sides?: IdDocumentSide[];
  verified?: boolean;
}

export interface UpdateIdDocumentInput {
  kind?: IdDocumentKind;
  /** Raw or already-masked number; the service always stores it masked. */
  number?: string;
  expiresAt?: string | null; // null clears it
  sides?: IdDocumentSide[];
  verified?: boolean;
}

export interface CreateTravelInput {
  guestId: string;
  direction: TravelDirection;
  mode: TravelMode;
  number: string;
  datetime: string;
  airport?: string;
  pickupNeeded: boolean;
}

export type UpdateTravelInput = Partial<Omit<CreateTravelInput, "guestId">>;

export interface CreateBaggageInput {
  guestId: string;
  tag: string;
  status: BaggageStatus;
}

export interface UpdateBaggageInput {
  tag?: string;
  status?: BaggageStatus;
}

// One row of a CSV import, already mapped to our domain shape by the UI's
// column-mapping step. `familyName`/`side` are used to find-or-create the
// guest's party.
export interface GuestImportRow {
  name: string;
  phone: string;
  isInternational: boolean;
  familyName: string;
  side: Side;
  tags: string[];
}

export interface GuestImportError {
  row: number; // 1-based index into the rows passed to importGuests
  message: string;
}

export interface GuestImportResult {
  guestsCreated: number;
  partiesCreated: number;
  errors: GuestImportError[];
}

export interface GuestService {
  listParties(eventId: string): Promise<Party[]>;
  listGuests(eventId: string): Promise<Guest[]>;
  listRsvps(eventId: string): Promise<Rsvp[]>;
  listIdDocuments(eventId: string): Promise<IdDocument[]>;

  // Single-guest reads used by the profile page.
  getGuest(id: string): Promise<Guest | undefined>;
  getParty(id: string): Promise<Party | undefined>;
  listRsvpsForGuest(guestId: string): Promise<Rsvp[]>;
  listIdDocumentsForGuest(guestId: string): Promise<IdDocument[]>;

  /** Creates or updates the RSVP for one guest × function pair. */
  upsertRsvp(input: UpsertRsvpInput): Promise<Rsvp>;

  createIdDocument(input: CreateIdDocumentInput): Promise<IdDocument>;
  updateIdDocument(id: string, patch: UpdateIdDocumentInput): Promise<IdDocument>;
  deleteIdDocument(id: string): Promise<void>;

  createParty(input: CreatePartyInput): Promise<Party>;
  updateParty(id: string, patch: UpdatePartyInput): Promise<Party>;
  deleteParty(id: string): Promise<void>;

  createGuest(input: CreateGuestInput): Promise<Guest>;
  updateGuest(id: string, patch: UpdateGuestInput): Promise<Guest>;
  deleteGuest(id: string): Promise<void>;

  /** Parses already happened in the browser (UI); this just commits the
   * mapped rows, finding-or-creating a party per row. */
  importGuests(eventId: string, rows: GuestImportRow[]): Promise<GuestImportResult>;
}

export interface LogisticsService {
  listTravel(eventId: string): Promise<Travel[]>;
  listRooms(eventId: string): Promise<Room[]>;
  listBaggage(eventId: string): Promise<Baggage[]>;
  listCheckIns(eventId: string): Promise<CheckIn[]>;

  // Single-guest reads used by the profile page.
  listTravelForGuest(guestId: string): Promise<Travel[]>;
  /** Room assignments are managed from the Room Planner; this is read-only. */
  findRoomForGuest(guestId: string): Promise<Room | undefined>;
  listBaggageForGuest(guestId: string): Promise<Baggage[]>;

  createTravel(input: CreateTravelInput): Promise<Travel>;
  updateTravel(id: string, patch: UpdateTravelInput): Promise<Travel>;
  deleteTravel(id: string): Promise<void>;

  createBaggage(input: CreateBaggageInput): Promise<Baggage>;
  updateBaggage(id: string, patch: UpdateBaggageInput): Promise<Baggage>;
  deleteBaggage(id: string): Promise<void>;
}

export interface CreateTemplateInput {
  name: string;
  category: TemplateCategory;
  body: string;
}

export interface CreateCampaignInput {
  eventId: string;
  name: string;
  templateId: string;
  audience: CampaignAudience;
}

export interface MessagingService {
  getConnection(): Promise<WhatsAppConnection>;

  listTemplates(): Promise<MessageTemplate[]>;
  createTemplate(input: CreateTemplateInput): Promise<MessageTemplate>;

  listCampaigns(eventId: string): Promise<Campaign[]>;
  getCampaign(id: string): Promise<Campaign | undefined>;
  /** The concrete guests an audience currently resolves to. */
  resolveAudience(eventId: string, audience: CampaignAudience): Promise<Guest[]>;
  /** Creates a draft; recipients and cost are snapshotted from the audience. */
  createCampaign(input: CreateCampaignInput): Promise<Campaign>;
  /** Queues one message per recipient and starts (simulated) delivery.
   * Status changes are pushed to `subscribe` listeners. */
  sendCampaign(id: string): Promise<Campaign>;

  listMessages(eventId: string): Promise<Message[]>;
  listMessagesForCampaign(campaignId: string): Promise<Message[]>;
  /** Read-only delivery log of campaign messages sent to one guest. */
  listMessagesForGuest(guestId: string): Promise<Message[]>;

  /** Fires whenever campaigns or messages change (e.g. delivery updates).
   * Returns an unsubscribe function. Views re-fetch through the service
   * rather than receiving state directly, so the mock can later be swapped
   * for polling or a websocket without touching the UI. */
  subscribe(listener: () => void): () => void;

  listCallLogs(eventId: string): Promise<CallLog[]>;
  getRatePerMessage(): Promise<number>;
  estimateCost(templateId: string, recipients: Guest[]): Promise<number>;
}

export interface SystemService {
  /** Clears whatever is in local storage and restores the original seed
   * data from `src/mocks/data.ts`. */
  resetDemoData(): Promise<void>;
}

export interface Services {
  events: EventService;
  guests: GuestService;
  logistics: LogisticsService;
  messaging: MessagingService;
  system: SystemService;
}
