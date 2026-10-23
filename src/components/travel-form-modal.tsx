"use client";

import { useState, type FormEvent } from "react";

import { Button, Field, Modal, inputClassName } from "@/components/ui";
import { fromDateTimeLocal, toDateTimeLocal } from "@/lib/format";
import type { Guest, Travel, TravelDirection, TravelMode } from "@/lib/types";
import { getServices } from "@/services";

const MODES: TravelMode[] = ["flight", "train", "road"];
const DIRECTIONS: TravelDirection[] = ["arrival", "departure"];

export const travelNumberLabel: Record<TravelMode, string> = {
  flight: "Flight number",
  train: "Train number",
  road: "Vehicle / service",
};
const placeLabel: Record<TravelMode, string> = {
  flight: "Airport",
  train: "Station",
  road: "Pickup / drop point",
};

// Create/edit one travel leg. Pass `guestId` when the guest is fixed (profile
// tab); pass `guests` instead to let the planner pick who is travelling.
export function TravelFormModal({
  open,
  travel,
  guestId,
  guests,
  onClose,
  onSaved,
}: {
  open: boolean;
  travel?: Travel;
  guestId?: string;
  guests?: Guest[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedGuestId, setSelectedGuestId] = useState(travel?.guestId ?? guestId ?? guests?.[0]?.id ?? "");
  const [direction, setDirection] = useState<TravelDirection>(travel?.direction ?? "arrival");
  const [mode, setMode] = useState<TravelMode>(travel?.mode ?? "flight");
  const [number, setNumber] = useState(travel?.number ?? "");
  const [datetime, setDatetime] = useState(travel ? toDateTimeLocal(travel.datetime) : "");
  const [airport, setAirport] = useState(travel?.airport ?? "");
  const [pickupNeeded, setPickupNeeded] = useState(travel?.pickupNeeded ?? false);
  const [pickupArranged, setPickupArranged] = useState(travel?.pickupArranged ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickGuest = !travel && !guestId && guests;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const iso = fromDateTimeLocal(datetime);
    if (!selectedGuestId) {
      setError("Pick a guest.");
      return;
    }
    if (!number.trim()) {
      setError(`${travelNumberLabel[mode]} is required.`);
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
      const payload = { direction, mode, number, datetime: iso, airport, pickupNeeded, pickupArranged: pickupNeeded && pickupArranged };
      if (travel) await logistics.updateTravel(travel.id, payload);
      else await logistics.createTravel({ guestId: selectedGuestId, ...payload });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={travel ? "Edit travel" : "Add travel"}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {pickGuest && (
          <Field label="Guest">
            <select className={inputClassName} value={selectedGuestId} onChange={(e) => setSelectedGuestId(e.target.value)}>
              {guests.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>
        )}
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
        <Field label={travelNumberLabel[mode]}>
          <input
            className={inputClassName}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder={mode === "flight" ? "6E 204" : mode === "train" ? "12956" : "Innova · RJ14 AB 1234"}
            autoFocus={!pickGuest}
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
        {pickupNeeded && (
          <label className="ml-6 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={pickupArranged} onChange={(e) => setPickupArranged(e.target.checked)} />
            Pickup already arranged
          </label>
        )}

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

/** Shared pickup badge so the planner and the profile tab read the same. */
export function pickupState(t: Travel): "none" | "needed" | "arranged" {
  if (!t.pickupNeeded) return "none";
  return t.pickupArranged ? "arranged" : "needed";
}
