"use client";

import { useState, type FormEvent } from "react";

import { Badge, Button, DataTable, Field, Modal, inputClassName } from "@/components/ui";
import { formatDateTime, fromDateTimeLocal, toDateTimeLocal } from "@/lib/format";
import type { Travel, TravelDirection, TravelMode } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";
import { getServices } from "@/services";

const MODES: TravelMode[] = ["flight", "train", "road"];
const DIRECTIONS: TravelDirection[] = ["arrival", "departure"];

const numberLabel: Record<TravelMode, string> = {
  flight: "Flight number",
  train: "Train number",
  road: "Vehicle / service",
};
const placeLabel: Record<TravelMode, string> = {
  flight: "Airport",
  train: "Station",
  road: "Pickup / drop point",
};

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
          { header: "Pickup", cell: (t) => (t.pickupNeeded ? <Badge tone="warn">Needed</Badge> : "—") },
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

function TravelFormModal({
  open,
  guestId,
  travel,
  onClose,
  onSaved,
}: {
  open: boolean;
  guestId: string;
  travel?: Travel;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [direction, setDirection] = useState<TravelDirection>(travel?.direction ?? "arrival");
  const [mode, setMode] = useState<TravelMode>(travel?.mode ?? "flight");
  const [number, setNumber] = useState(travel?.number ?? "");
  const [datetime, setDatetime] = useState(travel ? toDateTimeLocal(travel.datetime) : "");
  const [airport, setAirport] = useState(travel?.airport ?? "");
  const [pickupNeeded, setPickupNeeded] = useState(travel?.pickupNeeded ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const iso = fromDateTimeLocal(datetime);
    if (!number.trim()) {
      setError(`${numberLabel[mode]} is required.`);
      return;
    }
    if (!iso) {
      setError("Pick a valid date and time.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { logistics } = getServices();
      const payload = { direction, mode, number, datetime: iso, airport, pickupNeeded };
      if (travel) await logistics.updateTravel(travel.id, payload);
      else await logistics.createTravel({ guestId, ...payload });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={travel ? "Edit travel" : "Add travel"}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Direction">
            <select className={inputClassName} value={direction} onChange={(e) => setDirection(e.target.value as TravelDirection)}>
              {DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Mode">
            <select className={inputClassName} value={mode} onChange={(e) => setMode(e.target.value as TravelMode)}>
              {MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label={numberLabel[mode]}>
          <input
            className={inputClassName}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder={mode === "flight" ? "6E 204" : mode === "train" ? "12956" : "Innova · RJ14 AB 1234"}
            autoFocus
          />
        </Field>
        <Field label={direction === "arrival" ? "Arrives at" : "Departs at"} hint="Indian Standard Time (IST)">
          <input type="datetime-local" className={inputClassName} value={datetime} onChange={(e) => setDatetime(e.target.value)} />
        </Field>
        <Field label={placeLabel[mode]}>
          <input className={inputClassName} value={airport} onChange={(e) => setAirport(e.target.value)} placeholder="Jaipur (JAI)" />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={pickupNeeded} onChange={(e) => setPickupNeeded(e.target.checked)} />
          Pickup / drop required
        </label>

        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={submitting}>
            {submitting ? "Saving…" : travel ? "Save changes" : "Add travel"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
