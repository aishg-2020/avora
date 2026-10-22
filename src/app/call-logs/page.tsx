import { Badge, DataTable, MockBanner, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { CURRENT_EVENT_ID, getServices } from "@/services";

export default async function CallLogsPage() {
  const { guests, messaging } = getServices();
  const [guestList, calls] = await Promise.all([
    guests.listGuests(CURRENT_EVENT_ID),
    messaging.listCallLogs(CURRENT_EVENT_ID),
  ]);
  const nameById = new Map(guestList.map((g) => [g.id, g.name]));

  return (
    <>
      <PageHeader title="Call Logs" description="Calls with an automatic summary, linked to the guest." />
      <MockBanner />
      <DataTable
        rows={calls}
        rowKey={(c) => c.id}
        columns={[
          { header: "Guest", cell: (c) => nameById.get(c.guestId) },
          { header: "Direction", cell: (c) => <Badge>{c.direction}</Badge> },
          { header: "When", cell: (c) => formatDateTime(c.at) },
          { header: "Duration", cell: (c) => `${Math.floor(c.durationSec / 60)}m ${c.durationSec % 60}s` },
          { header: "Summary", cell: (c) => c.summary },
        ]}
      />
    </>
  );
}
