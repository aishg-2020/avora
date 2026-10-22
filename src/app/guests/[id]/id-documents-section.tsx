"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { Badge, Button, Field, Modal, inputClassName } from "@/components/ui";
import { formatDate, humanize } from "@/lib/format";
import type { IdDocument, IdDocumentKind, IdDocumentSide } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";
import { getServices } from "@/services";

const KINDS: IdDocumentKind[] = ["aadhaar", "passport", "driving_license", "other"];
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
                {doc.verified ? <Badge tone="good">Verified</Badge> : <Badge tone="warn">Review</Badge>}
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

// Picks an image and shows it with a local object URL. Nothing leaves the
// browser; the only thing persisted is that this side was received.
function ImageSlot({
  side,
  received,
  onSelected,
}: {
  side: IdDocumentSide;
  received: boolean;
  onSelected: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function handleFile(file: File | undefined) {
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    onSelected();
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium capitalize">{side}</span>
        {received ? <Badge tone="good">Received</Badge> : <Badge>Not yet</Badge>}
      </div>
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- local blob URL, not an optimisable asset
        <img src={previewUrl} alt={`${side} of ID (local preview)`} className="max-h-48 w-full rounded-md object-contain" />
      ) : (
        <div className="flex h-24 items-center justify-center rounded-md bg-surface text-sm text-muted">
          {received ? "Photo received via WhatsApp (not stored in demo)" : "No photo yet"}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2">
        <Button variant="secondary" onClick={() => inputRef.current?.click()}>
          {previewUrl ? "Choose another" : "Choose image"}
        </Button>
        <span className="text-xs text-muted">Preview only — not uploaded.</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

function IdDocumentFormModal({
  open,
  guestId,
  doc,
  onClose,
  onSaved,
}: {
  open: boolean;
  guestId: string;
  doc?: IdDocument;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<IdDocumentKind>(doc?.kind ?? "aadhaar");
  const [number, setNumber] = useState(doc?.maskedNumber ?? "");
  const [expiresAt, setExpiresAt] = useState(doc?.expiresAt ?? "");
  const [verified, setVerified] = useState(doc?.verified ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!number.trim()) {
      setError("Document number is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { guests } = getServices();
      if (doc) {
        await guests.updateIdDocument(doc.id, { kind, number, expiresAt: expiresAt || null, verified });
      } else {
        await guests.createIdDocument({ guestId, kind, number, expiresAt: expiresAt || undefined, verified });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={doc ? "Edit document" : "Add document"}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Field label="Document type">
          <select className={inputClassName} value={kind} onChange={(e) => setKind(e.target.value as IdDocumentKind)}>
            {KINDS.map((k) => (
              <option key={k} value={k} className="capitalize">
                {humanize(k)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Document number" hint="Only the last four characters are kept; the rest is masked on save.">
          <input className={inputClassName} value={number} onChange={(e) => setNumber(e.target.value)} autoFocus />
        </Field>
        <Field label="Expiry date" hint="Leave empty for documents without one (e.g. Aadhaar).">
          <input type="date" className={inputClassName} value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
          Verified by staff
        </label>

        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={submitting}>
            {submitting ? "Saving…" : doc ? "Save changes" : "Add document"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
