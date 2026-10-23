"use client";

import { useMemo, useState } from "react";

import { GuestLink } from "@/components/guest-link";
import { TravelFormModal, pickupState } from "@/components/travel-form-modal";
import { Badge, Button, DataTable, MockBanner, PageHeader, inlineInputClassName } from "@/components/ui";
import { downloadCsv } from "@/lib/csv";
import { formatDateTime, toDateTimeLocal } from "@/lib/format";
import type { Travel, TravelDirection } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";
import { CURRENT_EVENT_ID, getServices } from "@/services";

type PickupFilter = "all" | "needed" | "arranged" | "none";

export default function TravelPage() {
  const { data, loading, reload } = useAsyncData(() => {
    const { guests, logistics } = getServices();
    return Promise.all([guests.listGuests(CURRENT_EVENT_ID), logistics.listTravel(CURRENT_EVENT_ID)]);
  }, []);
  const [guestList, travel] = data ?? [[], []];
  const nameById = useMemo(() => new Map(guestList.map((g) => [g.id, g.name])), [guestList]);

  const [dateFilter, setDateFilter] = useState("");
  const [directionFilter, setDirectionFilter] = useState<"all" | TravelDirection>("all");
  const [pickupFilter, setPickupFilter] = useState<PickupFilter>("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Travel | undefined>(undefined);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Dates available for the date filter, derived from the data (IST).
  const dates = useMemo(
    () => Array.from(new Set(travel.map((t) => toDateTimeLocal(t.datetime).slice(0, 10)))).sort(),
    [travel],
  );

  const rows = useMemo(
    () =>
      [...travel]
        .filter((t) => {
          if (dateFilter && toDateTimeLocal(t.datetime).slice(0, 10) !== dateFilter) return false;
          if (directionFilter !== "all" && t.direction !== directionFilter) return false;
          if (pickupFilter !== "all" && pickupState(t) !== pickupFilter) return false;
          return true;
        })
        .sort((a, b) => a.datetime.localeCompare(b.datetime)),
    [travel, dateFilter, directionFilter, pickupFilter],
  );

  const pendingPickups = travel.filter((t) => pickupState(t) === "needed").length;

  // Transport manifest for whatever is currently shown (filters apply), so a
  // per-day / arrivals-only sheet is one click away.
  function exportManifest() {
    const suffix = [dateFilter, directionFilter !== "all" ? directionFilter : "", pickupFilter !== "all" ? `pickup-${pickupFilter}` : ""]
      .filter(Boolean)
      .join("-");
    downloadCsv(
      `transport-manifest${suffix ? `-${suffix}` : ""}`,
      ["Guest name", "Direction", "Mode", "Flight / train number", "Arrival / departure time (IST)", "Airport / station", "Pickup required", "Pickup arranged"],
      rows.map((t) => [
        nameById.get(t.guestId) ?? t.guestId,
        t.direction,
        t.mode,
        t.number,
        toDateTimeLocal(t.datetime).replace("T", " "),
        t.airport ?? "",
        t.pickupNeeded,
        t.pickupNeeded ? Boolean(t.pickupArranged) : "",
      ]),
    );
  }

  async function setArranged(t: Travel, arranged: boolean) {
    setBusyId(t.id);
    try {
      await getServices().logistics.updateTravel(t.id, { pickupArranged: arranged });
      reload();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(t: Travel) {
    if (!window.confirm(`Remove this ${t.direction} (${t.number}) for ${nameById.get(t.guestId) ?? "guest"}?`)) return;
    setBusyId(t.id);
    try {
      await getServices().logistics.deleteTravel(t.id);
      reload();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader title="Travel Planner" description="Arrivals and departures, sorted by time. Track which pickups still need a car." />
      <MockBanner />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select aria-label="Filter by date" className={inlineInputClassName} value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
          <option value="">All dates</option>
          {dates.map((d) => (
            <option key={d} value={d}>
              {new Date(`${d}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: "short" })}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by direction"
          className={inlineInputClassName}
          value={directionFilter}
          onChange={(e) => setDirectionFilter(e.target.value as "all" | TravelDirection)}
        >
          <option value="all">Arrivals & departures</option>
          <option value="arrival">Arrivals</option>
          <option value="departure">Departures</option>
        </select>
        <select
          aria-label="Filter by pickup"
          className={inlineInputClassName}
          value={pickupFilter}
          onChange={(e) => setPickupFilter(e.target.value as PickupFilter)}
        >
          <option value="all">Any pickup status</option>
          <option value="needed">Pickup needed</option>
          <option value="arranged">Pickup arranged</option>
          <option value="none">No pickup</option>
        </select>
        <p className="text-sm text-muted">
          {loading ? "Loading…" : `${rows.length} of ${travel.length} legs`}
          {pendingPickups > 0 && ` · ${pendingPickups} pickup${pendingPickups === 1 ? "" : "s"} still to arrange`}
        </p>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={exportManifest} disabled={loading || rows.length === 0}>
            ⬇ Export manifest (CSV)
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
          >
            + Add travel
          </Button>
        </div>
      </div>

      <DataTable
        rows={rows}
        rowKey={(t) => t.id}
        empty={travel.length === 0 ? "No travel details yet." : "Nothing matches these filters."}
        columns={[
          { header: "Guest", cell: (t) => <GuestLink id={t.guestId} name={nameById.get(t.guestId)} /> },
          { header: "Direction", cell: (t) => <Badge>{t.direction}</Badge> },
          { header: "Mode", cell: (t) => <span className="capitalize">{t.mode}</span> },
          { header: "Number", cell: (t) => <span className="font-mono">{t.number}</span> },
          { header: "When", cell: (t) => formatDateTime(t.datetime) },
          { header: "Airport / station", cell: (t) => t.airport ?? "—" },
          {
            header: "Pickup",
            cell: (t) => {
              const p = pickupState(t);
              if (p === "none") return <span className="text-muted">—</span>;
              return (
                <div className="flex items-center gap-2">
                  {p === "arranged" ? <Badge tone="good">Arranged</Badge> : <Badge tone="warn">Needed</Badge>}
                  <Button
                    variant={p === "arranged" ? "ghost" : "secondary"}
                    disabled={busyId === t.id}
                    onClick={() => setArranged(t, p !== "arranged")}
                  >
                    {p === "arranged" ? "Undo" : "Mark arranged"}
                  </Button>
                </div>
              );
            },
          },
          {
            header: "Actions",
            cell: (t) => (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditing(t);
                    setFormOpen(true);
                  }}
                >
                  Edit
                </Button>
                <Button variant="danger" onClick={() => remove(t)} disabled={busyId === t.id}>
                  Delete
                </Button>
              </div>
            ),
          },
        ]}
      />

      <TravelFormModal
        key={formOpen ? editing?.id ?? "new" : "idle"}
        open={formOpen}
        travel={editing}
        guests={guestList}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          reload();
        }}
      />
    </>
  );
}
