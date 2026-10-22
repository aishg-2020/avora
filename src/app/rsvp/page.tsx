"use client";

import { useMemo, useState } from "react";

import { GuestLink } from "@/components/guest-link";
import { Badge, MockBanner, PageHeader, inlineInputClassName } from "@/components/ui";
import { SIDES } from "@/lib/guest-helpers";
import type { EventFunction, Guest, RsvpStatus, Side } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";
import { CURRENT_EVENT_ID, getServices } from "@/services";

const tone: Record<RsvpStatus, "good" | "warn" | "bad" | "neutral"> = {
  attending: "good",
  maybe: "warn",
  declined: "bad",
  pending: "neutral",
};

// Clicking a cell steps through this cycle.
const CYCLE: RsvpStatus[] = ["pending", "attending", "declined", "maybe"];

export default function RsvpPage() {
  const { data, loading, reload } = useAsyncData(() => {
    const { events, guests } = getServices();
    return Promise.all([
      events.listFunctions(CURRENT_EVENT_ID),
      guests.listParties(CURRENT_EVENT_ID),
      guests.listGuests(CURRENT_EVENT_ID),
      guests.listRsvps(CURRENT_EVENT_ID),
    ]);
  }, []);
  const [fns, parties, guestList, rsvps] = data ?? [[], [], [], []];
  const partyById = useMemo(() => new Map(parties.map((p) => [p.id, p])), [parties]);

  const [familyFilter, setFamilyFilter] = useState<string>("all");
  const [sideFilter, setSideFilter] = useState<"all" | Side>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const allTags = useMemo(
    () =>
      Array.from(new Set([...parties.flatMap((p) => p.tags), ...guestList.flatMap((g) => g.tags ?? [])])).sort(),
    [parties, guestList],
  );

  const filtered = useMemo(
    () =>
      guestList.filter((g) => {
        const party = partyById.get(g.partyId);
        if (familyFilter !== "all" && g.partyId !== familyFilter) return false;
        if (sideFilter !== "all" && party?.side !== sideFilter) return false;
        if (tagFilter === "International" && !g.isInternational) return false;
        if (
          tagFilter !== "all" &&
          tagFilter !== "International" &&
          !(party?.tags ?? []).includes(tagFilter) &&
          !(g.tags ?? []).includes(tagFilter)
        ) {
          return false;
        }
        return true;
      }),
    [guestList, partyById, familyFilter, sideFilter, tagFilter],
  );

  const rsvpFor = (guestId: string, functionId: string) =>
    rsvps.find((r) => r.guestId === guestId && r.functionId === functionId);

  async function cycle(guest: Guest, fn: EventFunction) {
    const current = rsvpFor(guest.id, fn.id);
    const status = current?.status ?? "pending";
    const next = CYCLE[(CYCLE.indexOf(status) + 1) % CYCLE.length];

    // Declining means nobody comes; cycling away from declined restores a
    // sensible default headcount.
    let headcount = current?.headcount ?? 1;
    if (next === "declined") headcount = 0;
    else if (headcount === 0) headcount = 1;

    const key = `${guest.id}:${fn.id}`;
    setSavingKey(key);
    try {
      await getServices().guests.upsertRsvp({ guestId: guest.id, functionId: fn.id, status: next, headcount });
      reload();
    } finally {
      setSavingKey(null);
    }
  }

  // Summary counts per function, over the guests currently shown.
  const summary = (fn: EventFunction) => {
    const counts: Record<RsvpStatus, number> = { pending: 0, attending: 0, declined: 0, maybe: 0 };
    for (const g of filtered) counts[rsvpFor(g.id, fn.id)?.status ?? "pending"] += 1;
    return counts;
  };

  const filtersActive = familyFilter !== "all" || sideFilter !== "all" || tagFilter !== "all";

  return (
    <>
      <PageHeader title="RSVP" description="Click a cell to cycle pending → attending → declined → maybe." />
      <MockBanner />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          aria-label="Filter by family"
          className={inlineInputClassName}
          value={familyFilter}
          onChange={(e) => setFamilyFilter(e.target.value)}
        >
          <option value="all">All families</option>
          {parties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by side"
          className={inlineInputClassName}
          value={sideFilter}
          onChange={(e) => setSideFilter(e.target.value as "all" | Side)}
        >
          <option value="all">All sides</option>
          {SIDES.map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by tag"
          className={inlineInputClassName}
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
        >
          <option value="all">All tags</option>
          <option value="International">International</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <p className="text-sm text-muted">
          {loading ? "Loading…" : `${filtered.length} of ${guestList.length} guests`}
        </p>
      </div>

      {!loading && filtered.length === 0 ? (
        <p className="text-muted">No guests match your filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Guest</th>
                {fns.map((f) => (
                  <th key={f.id} className="px-4 py-3 font-medium">
                    {f.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <tr key={g.id} className="border-t border-border">
                  <td className="px-4 py-3 align-top">
                    <GuestLink id={g.id} name={g.name} />
                    <p className="text-xs text-muted">{partyById.get(g.partyId)?.name}</p>
                  </td>
                  {fns.map((f) => {
                    const r = rsvpFor(g.id, f.id);
                    const s = r?.status ?? "pending";
                    const key = `${g.id}:${f.id}`;
                    return (
                      <td key={f.id} className="px-4 py-3 align-top">
                        <button
                          type="button"
                          onClick={() => cycle(g, f)}
                          disabled={savingKey === key}
                          aria-label={`${g.name} · ${f.name}: ${s}. Click to change.`}
                          title="Click to change"
                          className="rounded-full transition hover:scale-105 disabled:opacity-50"
                        >
                          <Badge tone={tone[s]}>
                            {s}
                            {r && r.headcount > 1 ? ` · ${r.headcount}` : ""}
                          </Badge>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-border bg-surface">
              <tr>
                <td className="px-4 py-3 text-sm font-medium">
                  Totals{filtersActive ? " (shown guests)" : ""}
                </td>
                {fns.map((f) => {
                  const c = summary(f);
                  return (
                    <td key={f.id} className="px-4 py-3 align-top">
                      <div className="flex flex-col gap-1 text-xs">
                        <span className="text-emerald-700 dark:text-emerald-400">{c.attending} attending</span>
                        <span className="text-rose-700 dark:text-rose-400">{c.declined} declined</span>
                        <span className="text-muted">{c.pending} pending</span>
                        {c.maybe > 0 && <span className="text-amber-700 dark:text-amber-400">{c.maybe} maybe</span>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}
