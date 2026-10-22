import { Badge, DataTable, MockBanner, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import type { CheckInStage } from "@/lib/types";
import { CURRENT_EVENT_ID, getServices } from "@/services";

const stages: CheckInStage[] = ["airport", "hotel", "venue"];

export default async function CheckInPage() {
  const { guests, logistics } = getServices();
  const [guestList, checkIns] = await Promise.all([
    guests.listGuests(CURRENT_EVENT_ID),
    logistics.listCheckIns(CURRENT_EVENT_ID),
  ]);
  const at = (guestId: string, stage: CheckInStage) =>
    checkIns.find((c) => c.guestId === guestId && c.stage === stage);

  return (
    <>
      <PageHeader
        title="Check-In"
        description="Marking an arrival will notify the hotel and message the guest in a later phase."
      />
      <MockBanner />
      <DataTable
        rows={guestList}
        rowKey={(g) => g.id}
        columns={[
          { header: "Guest", cell: (g) => g.name },
          ...stages.map((stage) => ({
            header: stage[0].toUpperCase() + stage.slice(1),
            cell: (g: (typeof guestList)[number]) => {
              const c = at(g.id, stage);
              return c ? <Badge tone="good">{formatDateTime(c.at)}</Badge> : <Badge>Not yet</Badge>;
            },
          })),
        ]}
      />
    </>
  );
}
