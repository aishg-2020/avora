"use client";

import { Badge, DataTable, MockBanner, PageHeader } from "@/components/ui";
import { GuestLink } from "@/components/guest-link";
import { formatDateTime } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async-data";
import { CURRENT_EVENT_ID, getServices } from "@/services";

export default function TravelPage() {
  const { data, loading } = useAsyncData(() => {
    const { guests, logistics } = getServices();
    return Promise.all([guests.listGuests(CURRENT_EVENT_ID), logistics.listTravel(CURRENT_EVENT_ID)]);
  }, []);
  const [guestList, travel] = data ?? [[], []];
  const nameById = new Map(guestList.map((g) => [g.id, g.name]));
  const sorted = [...travel].sort((a, b) => a.datetime.localeCompare(b.datetime));

  return (
    <>
      <PageHeader title="Travel Planner" description="Arrivals and departures, sorted by time." />
      <MockBanner />
      {loading && <p className="text-muted">Loading…</p>}
      <DataTable
        rows={sorted}
        rowKey={(t) => t.id}
        columns={[
          { header: "Guest", cell: (t) => <GuestLink id={t.guestId} name={nameById.get(t.guestId)} /> },
          { header: "Direction", cell: (t) => <Badge>{t.direction}</Badge> },
          { header: "Mode", cell: (t) => <span className="capitalize">{t.mode}</span> },
          { header: "Number", cell: (t) => t.number },
          { header: "When", cell: (t) => formatDateTime(t.datetime) },
          { header: "Pickup", cell: (t) => (t.pickupNeeded ? <Badge tone="warn">Needed</Badge> : "—") },
        ]}
      />
    </>
  );
}
