import type { Baggage, BaggageStatus } from "@/lib/types";

// Bag lifecycle, in order: checked in at the airport → on the belt → collected.
export const BAGGAGE_STATUSES: BaggageStatus[] = ["checked_in", "on_belt", "collected"];

export const BAGGAGE_LABEL: Record<BaggageStatus, string> = {
  checked_in: "Checked In",
  on_belt: "On Belt",
  collected: "Collected",
};

export const BAGGAGE_TONE: Record<BaggageStatus, "good" | "warn" | "neutral"> = {
  checked_in: "neutral",
  on_belt: "warn",
  collected: "good",
};

// Suggests the next free printed tag ("AV-010") across the whole event so
// staff don't have to look it up.
export function nextBagTag(allBags: Baggage[]): string {
  const max = allBags.reduce((acc, b) => {
    const m = b.tag.match(/^AV-(\d+)$/);
    return m ? Math.max(acc, Number(m[1])) : acc;
  }, 0);
  return `AV-${String(max + 1).padStart(3, "0")}`;
}
