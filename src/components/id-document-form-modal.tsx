"use client";

import { useState, type FormEvent } from "react";

import { ImageSlot } from "@/components/image-slot";
import { Button, Field, Modal, inputClassName } from "@/components/ui";
import { humanize } from "@/lib/format";
import type { IdDocument, IdDocumentKind, IdDocumentSide } from "@/lib/types";
import { getServices } from "@/services";

const KINDS: IdDocumentKind[] = ["aadhaar", "passport", "driving_license", "other"];
const SIDES: IdDocumentSide[] = ["front", "back"];

// Create/edit a guest's ID document. The number is masked by the service on
// save (only the last four characters survive). Photos are previewed from
// browser memory only; selecting one just records that side as received.
export function IdDocumentFormModal({
  open,
  guestId,
  guestName,
  doc,
  onClose,
  onSaved,
}: {
  open: boolean;
  guestId: string;
  guestName?: string;
  doc?: IdDocument;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<IdDocumentKind>(doc?.kind ?? "aadhaar");
  const [number, setNumber] = useState(doc?.maskedNumber ?? "");
  const [expiresAt, setExpiresAt] = useState(doc?.expiresAt ?? "");
  const [verified, setVerified] = useState(doc?.verified ?? false);
  const [sides, setSides] = useState<IdDocumentSide[]>(doc?.sides ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function markSide(side: IdDocumentSide) {
    setSides((s) => (s.includes(side) ? s : [...s, side]));
  }

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
        await guests.updateIdDocument(doc.id, { kind, number, expiresAt: expiresAt || null, verified, sides });
      } else {
        await guests.createIdDocument({ guestId, kind, number, expiresAt: expiresAt || undefined, verified, sides });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${doc ? "Edit" : "Add"} document${guestName ? ` · ${guestName}` : ""}`}
      wide
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Document type">
            <select className={inputClassName} value={kind} onChange={(e) => setKind(e.target.value as IdDocumentKind)}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
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
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
            Verified by staff
          </label>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Photos</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SIDES.map((side) => (
              <ImageSlot key={side} side={side} received={sides.includes(side)} onSelected={() => markSide(side)} />
            ))}
          </div>
        </div>

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
