"use client";

import { useState } from "react";

import { TravelFormModal, pickupState } from "@/components/travel-form-modal";
import { Badge, Button, DataTable } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import type { Travel } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";
import { getServices } from "@/services";

export function TravelSection({ guestId }: { guestId: string }) {
  const { data: travel, loading, reload } = useAsyncData(
    () => getServices().logistics.listTravelForGuest(guestId),
    [guestId],
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Travel | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openAdd() {
    setEditing(undefined);
    setFormOpen(true);
  }
  function openEdit(t: Travel) {
    setEditing(t);
    setFormOpen(true);
  }
  async function remove(t: Travel) {
    if (!window.confirm(`Remove this ${t.direction} (${t.number})?`)) return;
    setDeletingId(t.id);
    try {
      await getServices().logistics.deleteTravel(t.id);
      reload();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Travel</h2>
        <Button variant="primary" onClick={openAdd}>
          + Add travel
        </Button>
      </div>
      {loading && !travel && <p className="text-muted">Loading…</p>}
      <DataTable
        rows={travel ?? []}
        rowKey={(t) => t.id}
        empty="No travel details yet. Add an arrival or departure."
        columns={[
          { header: "Direction", cell: (t) => <Badge>{t.direction}</Badge> },
          { header: "Mode", cell: (t) => <span className="capitalize">{t.mode}</span> },
          { header: "Number", cell: (t) => <span className="font-mono">{t.number}</span> },
          { header: "When", cell: (t) => formatDateTime(t.datetime) },
          { header: "Airport / station", cell: (t) => t.airport ?? "—" },
          {
            header: "Pickup",
            cell: (t) => {
              const p = pickupState(t);
              if (p === "none") return "—";
              return p === "arranged" ? <Badge tone="good">Arranged</Badge> : <Badge tone="warn">Needed</Badge>;
            },
          },
          {
            header: "Actions",
            cell: (t) => (
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => openEdit(t)}>
                  Edit
                </Button>
                <Button variant="danger" onClick={() => remove(t)} disabled={deletingId === t.id}>
                  {deletingId === t.id ? "Removing…" : "Delete"}
                </Button>
              </div>
            ),
          },
        ]}
      />

      <TravelFormModal
        key={formOpen ? editing?.id ?? "new" : "idle"}
        open={formOpen}
        guestId={guestId}
        travel={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          reload();
        }}
      />
    </section>
  );
}
