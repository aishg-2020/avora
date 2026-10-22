// Service contracts. Pages only talk to these interfaces, so swapping the
// mock implementation for a real backend later doesn't touch the UI.

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

export interface EventService {
  getEvent(id: string): Promise<Event | undefined>;
  listFunctions(eventId: string): Promise<EventFunction[]>;
}

export interface GuestService {
  listParties(eventId: string): Promise<Party[]>;
  listGuests(eventId: string): Promise<Guest[]>;
  listRsvps(eventId: string): Promise<Rsvp[]>;
  listIdDocuments(eventId: string): Promise<IdDocument[]>;
}

export interface LogisticsService {
  listTravel(eventId: string): Promise<Travel[]>;
  listRooms(eventId: string): Promise<Room[]>;
  listBaggage(eventId: string): Promise<Baggage[]>;
  listCheckIns(eventId: string): Promise<CheckIn[]>;
}

export interface MessagingService {
  getConnection(): Promise<WhatsAppConnection>;
  listTemplates(): Promise<MessageTemplate[]>;
  listCampaigns(eventId: string): Promise<Campaign[]>;
  listCallLogs(eventId: string): Promise<CallLog[]>;
  estimateCost(templateId: string, recipients: Guest[]): Promise<number>;
}

export interface Services {
  events: EventService;
  guests: GuestService;
  logistics: LogisticsService;
  messaging: MessagingService;
}
