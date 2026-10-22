"use client";

import { useState, type FormEvent } from "react";

import { Button, DataTable, Field, MockBanner, Modal, PageHeader, inputClassName } from "@/components/ui";
import { formatDateTime, fromDateTimeLocal, toDateTimeLocal } from "@/lib/format";
import type { EventFunction } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";
import { CURRENT_EVENT_ID, getServices } from "@/services";

export default function FunctionsPage() {
  const { data: fns, loading, reload } = useAsyncData(
    () => getServices().events.listFunctions(CURRENT_EVENT_ID),
    [],
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EventFunction | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openAdd() {
    setEditing(undefined);
    setFormOpen(true);
  }
  function openEdit(fn: EventFunction) {
    setEditing(fn);
    setFormOpen(true);
  }
  async function remove(fn: EventFunction) {
    const confirmed = window.confirm(
      `Delete “${fn.name}”? This also removes every RSVP guests gave for this function.`,
    );
    if (!confirmed) return;
    setDeletingId(fn.id);
    try {
      await getServices().events.deleteFunction(fn.id);
      reload();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <PageHeader title="Functions" description="Sub-events guests RSVP to individually." />
      <MockBanner />

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">
          {loading ? "Loading…" : `${fns?.length ?? 0} function${(fns?.length ?? 0) === 1 ? "" : "s"}, in running order`}
        </p>
        <Button variant="primary" onClick={openAdd}>
          + Add function
        </Button>
      </div>

      <DataTable
        rows={fns ?? []}
        rowKey={(f) => f.id}
        empty="No functions yet. Add the first one."
        columns={[
          {
            header: "Function",
            cell: (f) => (
              <div>
                <p className="font-medium">{f.name}</p>
                {f.description && <p className="mt-0.5 text-xs text-muted">{f.description}</p>}
              </div>
            ),
          },
          { header: "When", cell: (f) => formatDateTime(f.startsAt) },
          { header: "Venue", cell: (f) => f.venue },
          {
            header: "Actions",
            cell: (f) => (
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => openEdit(f)}>
                  Edit
                </Button>
                <Button variant="danger" onClick={() => remove(f)} disabled={deletingId === f.id}>
                  {deletingId === f.id ? "Deleting…" : "Delete"}
                </Button>
              </div>
            ),
          },
        ]}
      />

      <FunctionFormModal
        key={formOpen ? editing?.id ?? "new" : "idle"}
        open={formOpen}
        fn={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          reload();
        }}
      />
    </>
  );
}

function FunctionFormModal({
  open,
  fn,
  onClose,
  onSaved,
}: {
  open: boolean;
  fn?: EventFunction;
  onClose: () => void;
  onSaved: () => void;
}) {
  // toDateTimeLocal gives "YYYY-MM-DDTHH:mm"; split it for the two inputs.
  const [initialDate, initialTime] = fn ? toDateTimeLocal(fn.startsAt).split("T") : ["", ""];
  const [name, setName] = useState(fn?.name ?? "");
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [venue, setVenue] = useState(fn?.venue ?? "");
  const [description, setDescription] = useState(fn?.description ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !venue.trim()) {
      setError("Name and venue are required.");
      return;
    }
    const startsAt = date && time ? fromDateTimeLocal(`${date}T${time}`) : "";
    if (!startsAt) {
      setError("Pick a date and time.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const { events } = getServices();
      const payload = { name, startsAt, venue, description };
      if (fn) await events.updateFunction(fn.id, payload);
      else await events.createFunction({ eventId: CURRENT_EVENT_ID, ...payload });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={fn ? "Edit function" : "Add function"}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Field label="Name">
          <input
            className={inputClassName}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sangeet"
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Date">
            <input type="date" className={inputClassName} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Time" hint="IST">
            <input type="time" className={inputClassName} value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        <Field label="Venue">
          <input
            className={inputClassName}
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder="Grand Ballroom"
          />
        </Field>
        <Field label="Description" hint="Optional — dress code, notes for guests, running order.">
          <textarea
            className={`${inputClassName} min-h-20`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={submitting}>
            {submitting ? "Saving…" : fn ? "Save changes" : "Add function"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
