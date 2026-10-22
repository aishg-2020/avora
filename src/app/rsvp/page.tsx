import { Badge, DataTable, MockBanner, PageHeader } from "@/components/ui";
import type { RsvpStatus } from "@/lib/types";
import { CURRENT_EVENT_ID, getServices } from "@/services";

const tone: Record<RsvpStatus, "good" | "warn" | "bad" | "neutral"> = {
  attending: "good",
  maybe: "warn",
  declined: "bad",
  pending: "neutral",
};

export default async function RsvpPage() {
  const { events, guests } = getServices();
  const [fns, guestList, rsvps] = await Promise.all([
    events.listFunctions(CURRENT_EVENT_ID),
    guests.listGuests(CURRENT_EVENT_ID),
    guests.listRsvps(CURRENT_EVENT_ID),
  ]);
  const status = (guestId: string, functionId: string) =>
    rsvps.find((r) => r.guestId === guestId && r.functionId === functionId);

  return (
    <>
      <PageHeader title="RSVP" description="Guests will answer per function from WhatsApp in a later phase." />
      <MockBanner />
      <DataTable
        rows={guestList}
        rowKey={(g) => g.id}
        columns={[
          { header: "Guest", cell: (g) => g.name },
          ...fns.map((f) => ({
            header: f.name,
            cell: (g: (typeof guestList)[number]) => {
              const r = status(g.id, f.id);
              const s = r?.status ?? "pending";
              return (
                <Badge tone={tone[s]}>
                  {s}
                  {r && r.headcount > 1 ? ` · ${r.headcount}` : ""}
                </Badge>
              );
            },
          })),
        ]}
      />
    </>
  );
}
