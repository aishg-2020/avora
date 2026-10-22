// Home-screen tiles. Order follows the planner's day: setup → invite → logistics.

export interface AppModule {
  slug: string;
  title: string;
  description: string;
}

export const modules: AppModule[] = [
  { slug: "guests", title: "Guest List", description: "Families, guests and tags" },
  { slug: "functions", title: "Functions", description: "Haldi, Mehendi, Sangeet, Pheras" },
  { slug: "rsvp", title: "RSVP", description: "Attendance per function" },
  { slug: "campaigns", title: "Campaigns", description: "Bulk WhatsApp sends" },
  { slug: "travel", title: "Travel Planner", description: "Arrivals, departures, pickups" },
  { slug: "ids", title: "ID Documents", description: "Guest IDs for hotel check-in" },
  { slug: "rooms", title: "Room Planner", description: "Hotel room allocation" },
  { slug: "check-in", title: "Check-In", description: "Airport, hotel and venue arrivals" },
  { slug: "baggage", title: "Baggage", description: "Bags from airport to room" },
  { slug: "call-logs", title: "Call Logs", description: "Calls and summaries" },
  { slug: "whatsapp", title: "Connect WhatsApp", description: "Number, quality and limits" },
];
