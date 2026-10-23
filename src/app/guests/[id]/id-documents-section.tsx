"use client";

import { useState } from "react";

import { IdDocumentFormModal } from "@/components/id-document-form-modal";
import { ImageSlot } from "@/components/image-slot";
import { Badge, Button } from "@/components/ui";
import { formatDate, humanize } from "@/lib/format";
import { ID_STATUS_LABEL, ID_STATUS_TONE, idStatus } from "@/lib/guest-helpers";
import type { IdDocument, IdDocumentSide } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";
import { getServices } from "@/services";

const SIDES: IdDocumentSide[] = ["front", "back"];

export function IdDocumentsSection({ guestId }: { guestId: string }) {
  const { data: docs, loading, reload } = useAsyncData(
    () => getServices().guests.listIdDocumentsForGuest(guestId),
    [guestId],
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<IdDocument | undefined>(undefined);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggleVerified(doc: IdDocument) {
    setBusyId(doc.id);
    try {
      await getServices().guests.updateIdDocument(doc.id, { verified: !doc.verified });
      reload();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(doc: IdDocument) {
    if (!window.confirm(`Remove this ${humanize(doc.kind)}?`)) return;
    setBusyId(doc.id);
    try {
      await getServices().guests.deleteIdDocument(doc.id);
      reload();
    } finally {
      setBusyId(null);
    }
  }

  async function markSideReceived(doc: IdDocument, side: IdDocumentSide) {
    if (doc.sides.includes(side)) return;
    await getServices().guests.updateIdDocument(doc.id, { sides: [...doc.sides, side] });
    reload();
  }

  const list = docs ?? [];

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">ID documents</h2>
          <p className="text-sm text-muted">Numbers are always stored masked. Photos are previewed locally and never uploaded in this demo.</p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
        >
          + Add document
        </Button>
      </div>

      {loading && !docs && <p className="text-muted">Loading…</p>}

      {!loading && list.length === 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-border p-5">
          <Badge tone="bad">Missing</Badge>
          <p className="text-sm text-muted">No ID on file. Hotels need one for check-in.</p>
        </div>
      )}

      <div className="space-y-4">
        {list.map((doc) => (
          <article key={doc.id} className="rounded-xl border border-border p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold capitalize">{humanize(doc.kind)}</p>
                <p className="mt-0.5 font-mono text-sm">{doc.maskedNumber}</p>
                <p className="mt-0.5 text-sm text-muted">
                  {doc.expiresAt ? `Expires ${formatDate(doc.expiresAt)}` : "No expiry"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={ID_STATUS_TONE[idStatus(doc)]}>{ID_STATUS_LABEL[idStatus(doc)]}</Badge>
                <Button variant="secondary" onClick={() => toggleVerified(doc)} disabled={busyId === doc.id}>
                  {doc.verified ? "Mark for review" : "Mark verified"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditing(doc);
                    setFormOpen(true);
                  }}
                >
                  Edit
                </Button>
                <Button variant="danger" onClick={() => remove(doc)} disabled={busyId === doc.id}>
                  Delete
                </Button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {SIDES.map((side) => (
                <ImageSlot
                  key={side}
                  side={side}
                  received={doc.sides.includes(side)}
                  onSelected={() => markSideReceived(doc, side)}
                />
              ))}
            </div>
          </article>
        ))}
      </div>

      <IdDocumentFormModal
        key={formOpen ? editing?.id ?? "new" : "idle"}
        open={formOpen}
        guestId={guestId}
        doc={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          reload();
        }}
      />
    </section>
  );
}
