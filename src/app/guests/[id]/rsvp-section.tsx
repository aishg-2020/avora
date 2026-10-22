"use client";

import { useState } from "react";

import { Badge, DataTable, inlineInputClassName } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { RSVP_STATUSES } from "@/lib/guest-helpers";
import type { EventFunction, RsvpStatus } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";
import { CURRENT_EVENT_ID, getServices } from "@/services";

const tone: Record<RsvpStatus, "good" | "warn" | "bad" | "neutral"> = {
  attending: "good",
  maybe: "warn",
  declined: "bad",
  pending: "neutral",
};

export function RsvpSection({ guestId }: { guestId: string }) {
  const { data, loading, reload } = useAsyncData(() => {
    const { events, guests } = getServices();
    return Promise.all([events.listFunctions(CURRENT_EVENT_ID), guests.listRsvpsForGuest(guestId)]);
  }, [guestId]);
  const [fns, rsvps] = data ?? [[], []];
  const [savingId, setSavingId] = useState<string | null>(null);

  const rsvpFor = (fn: EventFunction) => rsvps.find((r) => r.functionId === fn.id);

  async function save(fn: EventFunction, patch: { status?: RsvpStatus; headcount?: number }) {
    const current = rsvpFor(fn);
    const status = patch.status ?? current?.status ?? "pending";
    let headcount = patch.headcount ?? current?.headcount ?? 1;
    // Declining implies nobody is coming; switching back to a "yes" from
    // declined restores a sensible default.
    if (patch.status === "declined") headcount = 0;
    else if (patch.status && current?.status === "declined" && headcount === 0) headcount = 1;

    setSavingId(fn.id);
    try {
      await getServices().guests.upsertRsvp({ guestId, functionId: fn.id, status, headcount });
      reload();
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">RSVP</h2>
        <p className="text-sm text-muted">Changes save immediately.</p>
      </div>
      {loading && !data && <p className="text-muted">Loading…</p>}
      <DataTable
        rows={fns}
        rowKey={(f) => f.id}
        columns={[
          { header: "Function", cell: (f) => <span className="font-medium">{f.name}</span> },
          { header: "When", cell: (f) => formatDateTime(f.startsAt) },
          { header: "Venue", cell: (f) => f.venue },
          {
            header: "Status",
            cell: (f) => {
              const r = rsvpFor(f);
              const s = r?.status ?? "pending";
              return (
                <div className="flex items-center gap-2">
                  <Badge tone={tone[s]}>{s}</Badge>
                  <select
                    aria-label={`RSVP status for ${f.name}`}
                    className={`${inlineInputClassName} py-1`}
                    value={s}
                    disabled={savingId === f.id}
                    onChange={(e) => save(f, { status: e.target.value as RsvpStatus })}
                  >
                    {RSVP_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              );
            },
          },
          {
            header: "Headcount",
            cell: (f) => {
              const r = rsvpFor(f);
              const shown = r?.headcount ?? 1;
              return (
                <input
                  aria-label={`Headcount for ${f.name}`}
                  type="number"
                  min={0}
                  max={20}
                  className={`${inlineInputClassName} w-20 py-1`}
                  // Re-key on the stored value so the uncontrolled input resets
                  // after a save without fighting the user's typing mid-edit.
                  key={`${f.id}-${shown}`}
                  defaultValue={shown}
                  disabled={savingId === f.id}
                  onBlur={(e) => {
                    const next = Number(e.target.value);
                    if (Number.isNaN(next) || next === shown) return;
                    save(f, { headcount: next });
                  }}
                />
              );
            },
          },
        ]}
      />
    </section>
  );
}
