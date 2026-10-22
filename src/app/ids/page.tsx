import { Badge, DataTable, MockBanner, PageHeader } from "@/components/ui";
import { humanize } from "@/lib/format";
import { CURRENT_EVENT_ID, getServices } from "@/services";

export default async function IdsPage() {
  const { guests } = getServices();
  const [guestList, docs] = await Promise.all([
    guests.listGuests(CURRENT_EVENT_ID),
    guests.listIdDocuments(CURRENT_EVENT_ID),
  ]);

  return (
    <>
      <PageHeader title="ID Documents" description="Numbers are always stored masked." />
      <MockBanner />
      <DataTable
        rows={guestList}
        rowKey={(g) => g.id}
        columns={[
          { header: "Guest", cell: (g) => g.name },
          {
            header: "Document",
            cell: (g) => {
              const d = docs.find((x) => x.guestId === g.id);
              return d ? <span className="capitalize">{humanize(d.kind)}</span> : <Badge tone="bad">Missing</Badge>;
            },
          },
          { header: "Number", cell: (g) => docs.find((x) => x.guestId === g.id)?.maskedNumber ?? "—" },
          { header: "Sides", cell: (g) => docs.find((x) => x.guestId === g.id)?.sides.join(", ") ?? "—" },
          {
            header: "Status",
            cell: (g) => {
              const d = docs.find((x) => x.guestId === g.id);
              if (!d) return "—";
              return d.verified ? <Badge tone="good">Verified</Badge> : <Badge tone="warn">Review</Badge>;
            },
          },
        ]}
      />
    </>
  );
}
