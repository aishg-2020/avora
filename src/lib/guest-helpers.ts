// Pure helpers shared by the guests page and its CSV import wizard. No
// store/service access here — just formatting/derivation from data the
// page already fetched through the service layer.

import type { Rsvp, RsvpStatus, Side } from "@/lib/types";

export const SIDES: Side[] = ["bride", "groom", "common"];

// A guest doesn't carry a single RSVP status itself — they RSVP per
// function. For list/search/filter purposes we collapse that into one
// overall status using the most "decided" signal available.
export function overallRsvpStatus(guestId: string, rsvps: Rsvp[]): RsvpStatus {
  const mine = rsvps.filter((r) => r.guestId === guestId);
  if (mine.length === 0) return "pending";
  if (mine.some((r) => r.status === "attending")) return "attending";
  if (mine.some((r) => r.status === "maybe")) return "maybe";
  if (mine.every((r) => r.status === "declined")) return "declined";
  return "pending";
}

export const RSVP_STATUSES: RsvpStatus[] = ["pending", "attending", "maybe", "declined"];
