"use client";

import { useState, type FormEvent } from "react";

import { Button, Field, Modal, inputClassName } from "@/components/ui";
import { SIDES } from "@/lib/guest-helpers";
import type { Guest, Party, Side } from "@/lib/types";
import { CURRENT_EVENT_ID, getServices } from "@/services";

const NEW_PARTY = "__new__";

export function GuestFormModal({
  open,
  onClose,
  onSaved,
  parties,
  guest,
}: {
  open: boolean;
  onClose: () => void;
  /** Called after a successful create/update so the page can reload from the service. */
  onSaved: () => void;
  parties: Party[];
  /** Omit to create a new guest; pass an existing guest to edit it. */
  guest?: Guest;
}) {
  // `GuestsPage` remounts this component (via a `key`) every time it's
  // opened for a different guest (or for "add"), so plain useState
  // initializers are enough to (re)seed the form — no effect needed.
  const [name, setName] = useState(guest?.name ?? "");
  const [phone, setPhone] = useState(guest?.phone ?? "");
  const [isInternational, setIsInternational] = useState(guest?.isInternational ?? false);
  const [partyId, setPartyId] = useState<string>(guest?.partyId ?? parties[0]?.id ?? NEW_PARTY);
  const [newFamilyName, setNewFamilyName] = useState("");
  const [newFamilySide, setNewFamilySide] = useState<Side>("common");
  const [newFamilyTags, setNewFamilyTags] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setError("Name and phone are required.");
      return;
    }
    if (partyId === NEW_PARTY && !newFamilyName.trim()) {
      setError("Give the new family a name, or pick an existing one.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const services = getServices();
      let resolvedPartyId = partyId;
      if (partyId === NEW_PARTY) {
        const party = await services.guests.createParty({
          eventId: CURRENT_EVENT_ID,
          name: newFamilyName,
          side: newFamilySide,
          tags: newFamilyTags.split(",").map((t) => t.trim()).filter(Boolean),
        });
        resolvedPartyId = party.id;
      }

      if (guest) {
        await services.guests.updateGuest(guest.id, {
          name,
          phone,
          isInternational,
          partyId: resolvedPartyId,
        });
      } else {
        await services.guests.createGuest({
          name,
          phone,
          isInternational,
          partyId: resolvedPartyId,
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={guest ? "Edit guest" : "Add guest"}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Field label="Name">
          <input
            className={inputClassName}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Rajesh Sharma"
            autoFocus
          />
        </Field>
        <Field label="Phone" hint="Include country code, e.g. +91 98290 11111">
          <input className={inputClassName} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98290 11111" />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isInternational} onChange={(e) => setIsInternational(e.target.checked)} />
          International guest
        </label>

        <Field label="Family / party">
          <select className={inputClassName} value={partyId} onChange={(e) => setPartyId(e.target.value)}>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.side})
              </option>
            ))}
            <option value={NEW_PARTY}>+ New family…</option>
          </select>
        </Field>

        {partyId === NEW_PARTY && (
          <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
            <Field label="New family name">
              <input
                className={inputClassName}
                value={newFamilyName}
                onChange={(e) => setNewFamilyName(e.target.value)}
                placeholder="Mehta Family"
              />
            </Field>
            <Field label="Side">
              <select className={inputClassName} value={newFamilySide} onChange={(e) => setNewFamilySide(e.target.value as Side)}>
                {SIDES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tags" hint="Comma separated, e.g. VIP, NRI">
              <input className={inputClassName} value={newFamilyTags} onChange={(e) => setNewFamilyTags(e.target.value)} />
            </Field>
          </div>
        )}

        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} type="button" disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={submitting}>
            {submitting ? "Saving…" : guest ? "Save changes" : "Add guest"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
