import { Badge, DataTable, MockBanner, PageHeader } from "@/components/ui";
import { CURRENT_EVENT_ID, getServices } from "@/services";

export default async function GuestsPage() {
  const { guests } = getServices();
  const [parties, guestList] = await Promise.all([
    guests.listParties(CURRENT_EVENT_ID),
    guests.listGuests(CURRENT_EVENT_ID),
  ]);
  const partyById = new Map(parties.map((p) => [p.id, p]));

  return (
    <>
      <PageHeader title="Guest List" description="Excel/CSV import comes in a later phase." />
      <MockBanner />
      <DataTable
        rows={guestList}
        rowKey={(g) => g.id}
        columns={[
          { header: "Name", cell: (g) => g.name },
          { header: "Phone", cell: (g) => g.phone },
          { header: "Family", cell: (g) => partyById.get(g.partyId)?.name },
          { header: "Side", cell: (g) => <Badge>{partyById.get(g.partyId)?.side}</Badge> },
          {
            header: "Tags",
            cell: (g) => (
              <div className="flex flex-wrap gap-1">
                {g.isInternational && <Badge tone="warn">International</Badge>}
                {partyById.get(g.partyId)?.tags.map((t) => <Badge key={t}>{t}</Badge>)}
              </div>
            ),
          },
        ]}
      />
    </>
  );
}
