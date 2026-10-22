"use client";

import { Badge, MockBanner, PageHeader } from "@/components/ui";
import { GuestLink } from "@/components/guest-link";
import { useAsyncData } from "@/lib/use-async-data";
import { CURRENT_EVENT_ID, getServices } from "@/services";

export default function RoomsPage() {
  const { data, loading } = useAsyncData(() => {
    const { guests, logistics } = getServices();
    return Promise.all([guests.listGuests(CURRENT_EVENT_ID), logistics.listRooms(CURRENT_EVENT_ID)]);
  }, []);
  const [guestList, rooms] = data ?? [[], []];
  const nameById = new Map(guestList.map((g) => [g.id, g.name]));
  const assigned = new Set(rooms.flatMap((r) => r.guestIds));
  const unassigned = guestList.filter((g) => !assigned.has(g.id));

  return (
    <>
      <PageHeader title="Room Planner" description="Drag-and-drop allocation comes in a later phase." />
      <MockBanner />
      {loading && <p className="text-muted">Loading…</p>}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {rooms.map((r) => (
          <div key={r.id} className="rounded-xl border border-border p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-lg font-semibold">Room {r.roomNo}</p>
              <Badge tone={r.guestIds.length >= r.capacity ? "good" : "neutral"}>
                {r.guestIds.length}/{r.capacity}
              </Badge>
            </div>
            <p className="text-sm text-muted">
              {r.hotel} · {r.type}
            </p>
            <ul className="mt-3 space-y-1 text-sm">
              {r.guestIds.map((id) => (
                <li key={id}>
                  <GuestLink id={id} name={nameById.get(id)} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Unassigned ({unassigned.length})</h2>
      <div className="flex flex-wrap gap-2">
        {unassigned.map((g) => (
          <Badge key={g.id}>{g.name}</Badge>
        ))}
      </div>
    </>
  );
}
