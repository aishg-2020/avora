import { DataTable, MockBanner, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { CURRENT_EVENT_ID, getServices } from "@/services";

export default async function FunctionsPage() {
  const fns = await getServices().events.listFunctions(CURRENT_EVENT_ID);

  return (
    <>
      <PageHeader title="Functions" description="Sub-events guests RSVP to individually." />
      <MockBanner />
      <DataTable
        rows={fns}
        rowKey={(f) => f.id}
        columns={[
          { header: "Function", cell: (f) => f.name },
          { header: "When", cell: (f) => formatDateTime(f.startsAt) },
          { header: "Venue", cell: (f) => f.venue },
        ]}
      />
    </>
  );
}
