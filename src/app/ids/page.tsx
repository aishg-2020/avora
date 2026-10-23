"use client";

import { useMemo, useState } from "react";

import { GuestLink } from "@/components/guest-link";
import { IdDocumentFormModal } from "@/components/id-document-form-modal";
import { Badge, Button, DataTable, MockBanner, PageHeader, inlineInputClassName } from "@/components/ui";
import { formatDate, humanize } from "@/lib/format";
import { ID_STATUS_LABEL, ID_STATUS_TONE, idStatus, type IdStatus } from "@/lib/guest-helpers";
import type { Guest, IdDocument } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";
import { CURRENT_EVENT_ID, getServices } from "@/services";

const FILTERS: { value: "all" | IdStatus; label: string }[] = [
  { value: "all", label: "All guests" },
  { value: "verified", label: "Verified" },
  { value: "review", label: "Needs review" },
  { value: "missing", label: "Missing" },
  { value: "expired", label: "Expired" },
];

interface Row {
  guest: Guest;
  doc: IdDocument | undefined;
  status: IdStatus;
}

export default function IdsPage() {
  const { data, loading, reload } = useAsyncData(async () => {
    const { guests } = getServices();
    const [guestList, docs] = await Promise.all([guests.listGuests(CURRENT_EVENT_ID), guests.listIdDocuments(CURRENT_EVENT_ID)]);
    // Read "today" after mount so the prerender never bakes in a build date.
    return { guestList, docs, now: new Date() };
  }, []);
  const { guestList = [], docs = [], now } = data ?? {};

  const [filter, setFilter] = useState<"all" | IdStatus>("all");
  const [editing, setEditing] = useState<{ guest: Guest; doc?: IdDocument } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const rows: Row[] = useMemo(
    () =>
      guestList.map((guest) => {
        const doc = docs.find((d) => d.guestId === guest.id);
        return { guest, doc, status: idStatus(doc, now) };
      }),
    [guestList, docs, now],
  );
  const filtered = filter === "all" ? rows : rows.filter((r) => r.status === filter);
  const count = (s: IdStatus) => rows.filter((r) => r.status === s).length;

  async function toggleVerified(doc: IdDocument) {
    setBusyId(doc.id);
    try {
      await getServices().guests.updateIdDocument(doc.id, { verified: !doc.verified });
      reload();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader title="ID Documents" description="Numbers are always stored masked — only the last four characters are kept." />
      <MockBanner />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          aria-label="Filter by ID status"
          className={inlineInputClassName}
          value={filter}
          onChange={(e) => setFilter(e.target.value as "all" | IdStatus)}
        >
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <p className="text-sm text-muted">
          {loading
            ? "Loading…"
            : `${filtered.length} of ${rows.length} guests · ${count("verified")} verified · ${count("review")} to review · ${count("missing")} missing · ${count("expired")} expired`}
        </p>
      </div>

      <DataTable
        rows={filtered}
        rowKey={(r) => r.guest.id}
        empty="No guests match this filter."
        columns={[
          { header: "Guest", cell: (r) => <GuestLink id={r.guest.id} name={r.guest.name} /> },
          {
            header: "Document",
            cell: (r) => (r.doc ? <span className="capitalize">{humanize(r.doc.kind)}</span> : <span className="text-muted">—</span>),
          },
          { header: "Number", cell: (r) => (r.doc ? <span className="font-mono">{r.doc.maskedNumber}</span> : "—") },
          { header: "Expires", cell: (r) => (r.doc?.expiresAt ? formatDate(r.doc.expiresAt) : "—") },
          { header: "Photos", cell: (r) => (r.doc && r.doc.sides.length > 0 ? r.doc.sides.join(", ") : "—") },
          { header: "Status", cell: (r) => <Badge tone={ID_STATUS_TONE[r.status]}>{ID_STATUS_LABEL[r.status]}</Badge> },
          {
            header: "Actions",
            cell: (r) =>
              r.doc ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => toggleVerified(r.doc!)} disabled={busyId === r.doc.id}>
                    {r.doc.verified ? "Mark for review" : "Mark verified"}
                  </Button>
                  <Button variant="ghost" onClick={() => setEditing({ guest: r.guest, doc: r.doc })}>
                    Edit
                  </Button>
                </div>
              ) : (
                <Button variant="primary" onClick={() => setEditing({ guest: r.guest })}>
                  + Add document
                </Button>
              ),
          },
        ]}
      />

      {editing && (
        <IdDocumentFormModal
          open
          guestId={editing.guest.id}
          guestName={editing.guest.name}
          doc={editing.doc}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </>
  );
}
