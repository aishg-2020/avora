"use client";

import Link from "next/link";

import { Badge } from "@/components/ui";
import { useAsyncData } from "@/lib/use-async-data";
import { CURRENT_EVENT_ID, getServices } from "@/services";

// Read-only on purpose: allocations are managed from the Room Planner so
// capacity and roommate decisions happen in one place.
export function RoomSection({ guestId }: { guestId: string }) {
  const { data, loading } = useAsyncData(async () => {
    const { guests, logistics } = getServices();
    const [room, guestList] = await Promise.all([
      logistics.findRoomForGuest(guestId),
      guests.listGuests(CURRENT_EVENT_ID),
    ]);
    return { room, guestList };
  }, [guestId]);

  if (loading && !data) return <p className="text-muted">Loading…</p>;

  const room = data?.room;
  const nameById = new Map((data?.guestList ?? []).map((g) => [g.id, g.name]));

  return (
    <section className="rounded-xl border border-border p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Room</h2>
          <p className="text-sm text-muted">Assignments are managed in the Room Planner.</p>
        </div>
        <Link href="/rooms" className="text-sm text-accent hover:underline">
          Open Room Planner →
        </Link>
      </div>

      {room ? (
        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
          <div>
            <dt className="text-sm text-muted">Hotel</dt>
            <dd className="mt-0.5 text-sm">{room.hotel}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Room</dt>
            <dd className="mt-0.5 text-sm font-semibold">{room.roomNo}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Type</dt>
            <dd className="mt-0.5 text-sm">{room.type}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Occupancy</dt>
            <dd className="mt-0.5 text-sm">
              <Badge tone={room.guestIds.length >= room.capacity ? "good" : "neutral"}>
                {room.guestIds.length}/{room.capacity}
              </Badge>
            </dd>
          </div>
          <div className="col-span-2 sm:col-span-4">
            <dt className="text-sm text-muted">Sharing with</dt>
            <dd className="mt-1 flex flex-wrap gap-1">
              {room.guestIds.filter((id) => id !== guestId).length === 0 ? (
                <span className="text-sm text-muted">Nobody yet</span>
              ) : (
                room.guestIds
                  .filter((id) => id !== guestId)
                  .map((id) => (
                    <Link key={id} href={`/guests/${id}`}>
                      <Badge>{nameById.get(id) ?? id}</Badge>
                    </Link>
                  ))
              )}
            </dd>
          </div>
        </dl>
      ) : (
        <div className="flex items-center gap-3">
          <Badge tone="warn">Unassigned</Badge>
          <p className="text-sm text-muted">No room yet — allocate one from the Room Planner.</p>
        </div>
      )}
    </section>
  );
}
