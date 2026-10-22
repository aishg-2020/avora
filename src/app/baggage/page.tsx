import { Badge, DataTable, MockBanner, PageHeader } from "@/components/ui";
import { humanize } from "@/lib/format";
import { CURRENT_EVENT_ID, getServices } from "@/services";

export default async function BaggagePage() {
  const { guests, logistics } = getServices();
  const [guestList, bags] = await Promise.all([
    guests.listGuests(CURRENT_EVENT_ID),
    logistics.listBaggage(CURRENT_EVENT_ID),
  ]);
  const nameById = new Map(guestList.map((g) => [g.id, g.name]));

  return (
    <>
      <PageHeader title="Baggage" description="Bag count and tags per guest, from airport to room." />
      <MockBanner />
      <DataTable
        rows={bags}
        rowKey={(b) => b.guestId}
        columns={[
          { header: "Guest", cell: (b) => nameById.get(b.guestId) },
          { header: "Bags", cell: (b) => b.count },
          { header: "Tags", cell: (b) => <span className="font-mono text-xs">{b.tags.join(", ")}</span> },
          {
            header: "Status",
            cell: (b) => (
              <Badge tone={b.status === "in_room" ? "good" : "warn"}>{humanize(b.status)}</Badge>
            ),
          },
        ]}
      />
    </>
  );
}
