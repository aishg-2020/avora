"use client";

import { useState, type FormEvent, type ReactNode } from "react";

import { Badge, Button, Field, inputClassName } from "@/components/ui";
import { maskPhone } from "@/lib/format";
import { SIDES } from "@/lib/guest-helpers";
import type { Guest, Party, Side } from "@/lib/types";
import { CURRENT_EVENT_ID, getServices } from "@/services";

const NEW_PARTY = "__new__";

export function OverviewSection({
  guest,
  party,
  parties,
  onChanged,
}: {
  guest: Guest;
  party: Party | undefined;
  parties: Party[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [phoneRevealed, setPhoneRevealed] = useState(false);

  if (editing) {
    return (
      <OverviewForm
        guest={guest}
        party={party}
        parties={parties}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          onChanged();
        }}
      />
    );
  }

  return (
    <section className="rounded-xl border border-border p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Overview</h2>
        <Button variant="secondary" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        <Item label="Name">{guest.name}</Item>
        <Item label="Phone">
          <span className="font-mono">{phoneRevealed ? guest.phone : maskPhone(guest.phone)}</span>
          <button
            type="button"
            onClick={() => setPhoneRevealed((v) => !v)}
            className="ml-2 text-xs text-muted underline-offset-2 hover:text-foreground hover:underline"
          >
            {phoneRevealed ? "Hide" : "Reveal"}
          </button>
          {guest.isInternational && <Badge tone="warn">International</Badge>}
        </Item>
        <Item label="Family">{party?.name ?? "—"}</Item>
        <Item label="Side">{party ? <Badge>{party.side}</Badge> : "—"}</Item>
        <Item label="Tags">
          <div className="flex flex-wrap gap-1">
            {party?.tags.map((t) => (
              <Badge key={`p-${t}`}>{t}</Badge>
            ))}
            {guest.tags?.map((t) => (
              <Badge key={`g-${t}`}>{t}</Badge>
            ))}
            {!party?.tags.length && !guest.tags?.length && <span className="text-muted">—</span>}
          </div>
          {party && party.tags.length > 0 && (
            <p className="mt-1 text-xs text-muted">Family tags ({party.tags.join(", ")}) apply to everyone in {party.name}.</p>
          )}
        </Item>
        <div className="sm:col-span-2">
          <Item label="Notes">
            {guest.notes ? <p className="whitespace-pre-wrap">{guest.notes}</p> : <span className="text-muted">—</span>}
          </Item>
        </div>
      </dl>
    </section>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm">{children}</dd>
    </div>
  );
}

function OverviewForm({
  guest,
  party,
  parties,
  onCancel,
  onSaved,
}: {
  guest: Guest;
  party: Party | undefined;
  parties: Party[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(guest.name);
  const [phone, setPhone] = useState(guest.phone);
  const [isInternational, setIsInternational] = useState(guest.isInternational);
  const [partyId, setPartyId] = useState<string>(guest.partyId);
  const [newFamilyName, setNewFamilyName] = useState("");
  const [side, setSide] = useState<Side>(party?.side ?? "common");
  const [tags, setTags] = useState((guest.tags ?? []).join(", "));
  const [notes, setNotes] = useState(guest.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedParty = parties.find((p) => p.id === partyId);

  function handlePartyChange(nextId: string) {
    setPartyId(nextId);
    const next = parties.find((p) => p.id === nextId);
    if (next) setSide(next.side);
  }

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
      const { guests } = getServices();
      let resolvedPartyId = partyId;
      if (partyId === NEW_PARTY) {
        const created = await guests.createParty({ eventId: CURRENT_EVENT_ID, name: newFamilyName, side, tags: [] });
        resolvedPartyId = created.id;
      } else if (selectedParty && selectedParty.side !== side) {
        await guests.updateParty(selectedParty.id, { side });
      }

      await guests.updateGuest(guest.id, {
        name,
        phone,
        isInternational,
        partyId: resolvedPartyId,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        notes,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border p-5">
      <h2 className="mb-4 text-lg font-semibold">Edit overview</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input className={inputClassName} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Phone" hint="Shown masked everywhere else; include the country code.">
          <input className={inputClassName} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Family / party">
          <select className={inputClassName} value={partyId} onChange={(e) => handlePartyChange(e.target.value)}>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.side})
              </option>
            ))}
            <option value={NEW_PARTY}>+ New family…</option>
          </select>
        </Field>
        {partyId === NEW_PARTY ? (
          <Field label="New family name">
            <input className={inputClassName} value={newFamilyName} onChange={(e) => setNewFamilyName(e.target.value)} />
          </Field>
        ) : (
          <div className="hidden sm:block" />
        )}
        <Field
          label="Side"
          hint={
            partyId === NEW_PARTY
              ? "Side of the new family."
              : `Side belongs to the family — changing it updates everyone in ${selectedParty?.name ?? "this family"}.`
          }
        >
          <select className={inputClassName} value={side} onChange={(e) => setSide(e.target.value as Side)}>
            {SIDES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Guest tags" hint="Comma separated, e.g. Vegetarian, Wheelchair">
          <input className={inputClassName} value={tags} onChange={(e) => setTags(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={isInternational} onChange={(e) => setIsInternational(e.target.checked)} />
          International guest
        </label>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <textarea
              className={`${inputClassName} min-h-24`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Dietary needs, accessibility, anything the team should know."
            />
          </Field>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
