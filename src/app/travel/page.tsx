import { Badge, DataTable, MockBanner, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { CURRENT_EVENT_ID, getServices } from "@/services";

export default async function TravelPage() {
  const { guests, logistics } = getServices();
  const [guestList, travel] = await Promise.all([
    guests.listGuests(CURRENT_EVENT_ID),
    logistics.listTravel(CURRENT_EVENT_ID),
  ]);
  const nameById = new Map(guestList.map((g) => [g.id, g.name]));
  const sorted = [...travel].sort((a, b) => a.datetime.localeCompare(b.datetime));

  return (
    <>
      <PageHeader title="Travel Planner" description="Arrivals and departures, sorted by time." />
      <MockBanner />
      <DataTable
        rows={sorted}
        rowKey={(t) => t.id}
        columns={[
          { header: "Guest", cell: (t) => nameById.get(t.guestId) },
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
