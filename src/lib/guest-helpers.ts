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

// ID document status as shown across the app. "expired" wins over the
// verified flag — an expired passport won't get anyone through check-in.
export type IdStatus = "missing" | "expired" | "verified" | "review";

export function idStatus(doc: { expiresAt?: string; verified: boolean } | undefined, today: Date = new Date()): IdStatus {
  if (!doc) return "missing";
  if (doc.expiresAt) {
    const exp = new Date(doc.expiresAt);
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    if (!Number.isNaN(exp.getTime()) && exp.getTime() < startOfToday) return "expired";
  }
  return doc.verified ? "verified" : "review";
}

export const ID_STATUS_LABEL: Record<IdStatus, string> = {
  missing: "Missing",
  expired: "Expired",
  verified: "Verified",
  review: "Review",
};

export const ID_STATUS_TONE: Record<IdStatus, "good" | "warn" | "bad" | "neutral"> = {
  missing: "bad",
  expired: "bad",
  verified: "good",
  review: "warn",
};
