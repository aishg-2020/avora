"use client";

import { Badge, DataTable, MockBanner, PageHeader } from "@/components/ui";
import { GuestLink } from "@/components/guest-link";
import { formatDate, humanize } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async-data";
import { CURRENT_EVENT_ID, getServices } from "@/services";

export default function IdsPage() {
  const { data, loading } = useAsyncData(() => {
    const { guests } = getServices();
    return Promise.all([guests.listGuests(CURRENT_EVENT_ID), guests.listIdDocuments(CURRENT_EVENT_ID)]);
  }, []);
  const [guestList, docs] = data ?? [[], []];

  return (
    <>
      <PageHeader title="ID Documents" description="Numbers are always stored masked." />
      <MockBanner />
      {loading && <p className="text-muted">Loading…</p>}
      <DataTable
        rows={guestList}
        rowKey={(g) => g.id}
        columns={[
          { header: "Guest", cell: (g) => <GuestLink id={g.id} name={g.name} /> },
          {
            header: "Document",
            cell: (g) => {
              const d = docs.find((x) => x.guestId === g.id);
              return d ? <span className="capitalize">{humanize(d.kind)}</span> : <Badge tone="bad">Missing</Badge>;
            },
          },
          { header: "Number", cell: (g) => docs.find((x) => x.guestId === g.id)?.maskedNumber ?? "—" },
          {
            header: "Expires",
            cell: (g) => {
              const d = docs.find((x) => x.guestId === g.id);
              return d?.expiresAt ? formatDate(d.expiresAt) : "—";
            },
          },
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
