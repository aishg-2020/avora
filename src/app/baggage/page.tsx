"use client";

import Link from "next/link";

import { Badge, DataTable, MockBanner, PageHeader } from "@/components/ui";
import { humanize } from "@/lib/format";
import type { Baggage, BaggageStatus } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";
import { CURRENT_EVENT_ID, getServices } from "@/services";

const tone: Record<BaggageStatus, "good" | "warn" | "neutral"> = {
  in_room: "good",
  in_transit: "warn",
  at_airport: "warn",
};

interface GuestBags {
  guestId: string;
  bags: Baggage[];
}

export default function BaggagePage() {
  const { data, loading } = useAsyncData(() => {
    const { guests, logistics } = getServices();
    return Promise.all([guests.listGuests(CURRENT_EVENT_ID), logistics.listBaggage(CURRENT_EVENT_ID)]);
  }, []);
  const [guestList, bags] = data ?? [[], []];
  const nameById = new Map(guestList.map((g) => [g.id, g.name]));

  // Bags are tracked individually; this overview rolls them up per guest.
  const rows: GuestBags[] = [];
  for (const bag of bags) {
    const row = rows.find((r) => r.guestId === bag.guestId);
    if (row) row.bags.push(bag);
    else rows.push({ guestId: bag.guestId, bags: [bag] });
  }

  return (
    <>
      <PageHeader title="Baggage" description="Bag count and tags per guest, from airport to room." />
      <MockBanner />
      {loading && <p className="text-muted">Loading…</p>}
      <DataTable
        rows={rows}
        rowKey={(r) => r.guestId}
        columns={[
          {
            header: "Guest",
            cell: (r) => (
              <Link href={`/guests/${r.guestId}`} className="hover:text-accent">
                {nameById.get(r.guestId)}
              </Link>
            ),
          },
          { header: "Bags", cell: (r) => r.bags.length },
          {
            header: "Tags",
            cell: (r) => <span className="font-mono text-xs">{r.bags.map((b) => b.tag).join(", ")}</span>,
          },
          {
            header: "Status",
            cell: (r) => {
              const statuses = Array.from(new Set(r.bags.map((b) => b.status)));
              return (
                <div className="flex flex-wrap gap-1">
                  {statuses.map((s) => (
                    <Badge key={s} tone={tone[s]}>
                      {humanize(s)}
                      {statuses.length > 1 ? ` · ${r.bags.filter((b) => b.status === s).length}` : ""}
                    </Badge>
                  ))}
                </div>
              );
            },
          },
        ]}
      />
    </>
  );
}
