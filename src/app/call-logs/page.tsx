"use client";

import { Badge, DataTable, MockBanner, PageHeader } from "@/components/ui";
import { GuestLink } from "@/components/guest-link";
import { formatDateTime } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async-data";
import { CURRENT_EVENT_ID, getServices } from "@/services";

export default function CallLogsPage() {
  const { data, loading } = useAsyncData(() => {
    const { guests, messaging } = getServices();
    return Promise.all([guests.listGuests(CURRENT_EVENT_ID), messaging.listCallLogs(CURRENT_EVENT_ID)]);
  }, []);
  const [guestList, calls] = data ?? [[], []];
  const nameById = new Map(guestList.map((g) => [g.id, g.name]));

  return (
    <>
      <PageHeader title="Call Logs" description="Calls with an automatic summary, linked to the guest." />
      <MockBanner />
      {loading && <p className="text-muted">Loading…</p>}
      <DataTable
        rows={calls}
        rowKey={(c) => c.id}
        columns={[
          { header: "Guest", cell: (c) => <GuestLink id={c.guestId} name={nameById.get(c.guestId)} /> },
          { header: "Direction", cell: (c) => <Badge>{c.direction}</Badge> },
          { header: "When", cell: (c) => formatDateTime(c.at) },
          { header: "Duration", cell: (c) => `${Math.floor(c.durationSec / 60)}m ${c.durationSec % 60}s` },
          { header: "Summary", cell: (c) => c.summary },
        ]}
      />
    </>
  );
}
