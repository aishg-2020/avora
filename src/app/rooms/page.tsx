import { Badge, MockBanner, PageHeader } from "@/components/ui";
import { CURRENT_EVENT_ID, getServices } from "@/services";

export default async function RoomsPage() {
  const { guests, logistics } = getServices();
  const [guestList, rooms] = await Promise.all([
    guests.listGuests(CURRENT_EVENT_ID),
    logistics.listRooms(CURRENT_EVENT_ID),
  ]);
  const nameById = new Map(guestList.map((g) => [g.id, g.name]));
  const assigned = new Set(rooms.flatMap((r) => r.guestIds));
  const unassigned = guestList.filter((g) => !assigned.has(g.id));

  return (
    <>
      <PageHeader title="Room Planner" description="Drag-and-drop allocation comes in a later phase." />
      <MockBanner />

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
                <li key={id}>{nameById.get(id)}</li>
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
