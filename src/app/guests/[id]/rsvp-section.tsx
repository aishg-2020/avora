"use client";

import { useEffect, useRef, useState } from "react";

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

const MAX_HEADCOUNT = 20;
const SAVE_DEBOUNCE_MS = 400;

export function RsvpSection({ guestId }: { guestId: string }) {
  const { data, loading, reload } = useAsyncData(() => {
    const { events, guests } = getServices();
    return Promise.all([events.listFunctions(CURRENT_EVENT_ID), guests.listRsvpsForGuest(guestId)]);
  }, [guestId]);
  const [fns, rsvps] = data ?? [[], []];

  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  // Headcount values being typed, per function, before they're persisted.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const timers = debounceTimers.current;
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);

  const rsvpFor = (fn: EventFunction) => rsvps.find((r) => r.functionId === fn.id);

  async function save(fn: EventFunction, patch: { status?: RsvpStatus; headcount?: number }) {
    const current = rsvpFor(fn);
    const status = patch.status ?? current?.status ?? "pending";
    let headcount = patch.headcount ?? current?.headcount ?? 1;
    // Declining implies nobody is coming; switching back from declined
    // restores a sensible default.
    if (status === "declined") headcount = 0;
    else if (patch.status && current?.status === "declined" && headcount === 0) headcount = 1;
    headcount = Math.min(MAX_HEADCOUNT, Math.max(0, Math.floor(headcount)));

    setSavingId(fn.id);
    try {
      await getServices().guests.upsertRsvp({ guestId, functionId: fn.id, status, headcount });
      setDrafts((d) => {
        const next = { ...d };
        delete next[fn.id];
        return next;
      });
      reload();
      setSavedId(fn.id);
      setTimeout(() => setSavedId((id) => (id === fn.id ? null : id)), 1500);
    } finally {
      setSavingId(null);
    }
  }

  function flushHeadcount(fn: EventFunction) {
    clearTimeout(debounceTimers.current[fn.id]);
    const draft = drafts[fn.id];
    if (draft === undefined) return;
    const n = Number(draft);
    if (draft.trim() === "" || Number.isNaN(n)) return; // leave the draft; nothing sensible to save yet
    if (n === (rsvpFor(fn)?.headcount ?? 1)) {
      setDrafts((d) => {
        const next = { ...d };
        delete next[fn.id];
        return next;
      });
      return;
    }
    save(fn, { headcount: n });
  }

  function onHeadcountChange(fn: EventFunction, value: string) {
    setDrafts((d) => ({ ...d, [fn.id]: value }));
    clearTimeout(debounceTimers.current[fn.id]);
    const n = Number(value);
    if (value.trim() === "" || Number.isNaN(n)) return;
    debounceTimers.current[fn.id] = setTimeout(() => {
      save(fn, { headcount: n });
    }, SAVE_DEBOUNCE_MS);
  }

  function step(fn: EventFunction, delta: number) {
    clearTimeout(debounceTimers.current[fn.id]);
    const current = Number(drafts[fn.id] ?? rsvpFor(fn)?.headcount ?? 1);
    const next = Math.min(MAX_HEADCOUNT, Math.max(0, (Number.isNaN(current) ? 1 : current) + delta));
    setDrafts((d) => ({ ...d, [fn.id]: String(next) }));
    save(fn, { headcount: next });
  }

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">RSVP</h2>
        <p className="text-sm text-muted">Status and headcount save automatically.</p>
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
            header: "Status · headcount",
            cell: (f) => {
              const r = rsvpFor(f);
              const s = r?.status ?? "pending";
              const stored = r?.headcount ?? 1;
              const shown = drafts[f.id] ?? String(stored);
              const busy = savingId === f.id;
              const declined = s === "declined";
              return (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={tone[s]}>
                    {s}
                    {!declined && stored > 1 ? ` · ${stored}` : ""}
                  </Badge>
                  <select
                    aria-label={`RSVP status for ${f.name}`}
                    className={`${inlineInputClassName} py-1`}
                    value={s}
                    disabled={busy}
                    onChange={(e) => save(f, { status: e.target.value as RsvpStatus })}
                  >
                    {RSVP_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>

                  <div
                    className={`flex items-center rounded-lg border border-border ${declined ? "opacity-50" : ""}`}
                    title={declined ? "Declined — nobody is coming" : "Number of people coming"}
                  >
                    <button
                      type="button"
                      aria-label={`Decrease headcount for ${f.name}`}
                      className="px-2 py-1 text-sm hover:bg-surface disabled:cursor-not-allowed"
                      disabled={busy || declined || Number(shown) <= 0}
                      onClick={() => step(f, -1)}
                    >
                      −
                    </button>
                    <input
                      aria-label={`Headcount for ${f.name}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={MAX_HEADCOUNT}
                      className="w-12 border-x border-border bg-background py-1 text-center text-sm outline-none focus:border-accent"
                      value={declined ? "0" : shown}
                      disabled={busy || declined}
                      onChange={(e) => onHeadcountChange(f, e.target.value)}
                      onBlur={() => flushHeadcount(f)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          flushHeadcount(f);
                        }
                      }}
                    />
                    <button
                      type="button"
                      aria-label={`Increase headcount for ${f.name}`}
                      className="px-2 py-1 text-sm hover:bg-surface disabled:cursor-not-allowed"
                      disabled={busy || declined || Number(shown) >= MAX_HEADCOUNT}
                      onClick={() => step(f, 1)}
                    >
                      +
                    </button>
                  </div>
                  <span className="text-xs text-muted" aria-live="polite">
                    {busy ? "Saving…" : savedId === f.id ? "Saved" : declined ? "" : "people"}
                  </span>
                </div>
              );
            },
          },
        ]}
      />
    </section>
  );
}
