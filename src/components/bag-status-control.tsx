"use client";

import { Badge } from "@/components/ui";
import { BAGGAGE_LABEL, BAGGAGE_STATUSES, BAGGAGE_TONE } from "@/lib/baggage-helpers";
import type { Baggage, BaggageStatus } from "@/lib/types";

// Status badge plus a one-tap segmented control to move a bag to any stage.
export function BagStatusControl({
  bag,
  busy,
  onChange,
}: {
  bag: Baggage;
  busy: boolean;
  onChange: (status: BaggageStatus) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={BAGGAGE_TONE[bag.status]}>{BAGGAGE_LABEL[bag.status]}</Badge>
      <div className="inline-flex overflow-hidden rounded-lg border border-border" role="group" aria-label={`Set status for bag ${bag.tag}`}>
        {BAGGAGE_STATUSES.map((s) => {
          const active = s === bag.status;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              disabled={busy || active}
              onClick={() => onChange(s)}
              className={`px-2.5 py-1 text-xs font-medium transition disabled:cursor-default ${
                active ? "bg-accent text-white" : "hover:bg-surface disabled:opacity-50"
              }`}
            >
              {BAGGAGE_LABEL[s]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
