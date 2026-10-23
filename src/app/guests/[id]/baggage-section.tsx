"use client";

import { useState, type FormEvent } from "react";

import { BagStatusControl } from "@/components/bag-status-control";
import { Button, DataTable, Field, inputClassName } from "@/components/ui";
import { BAGGAGE_LABEL, BAGGAGE_STATUSES, nextBagTag } from "@/lib/baggage-helpers";
import type { Baggage, BaggageStatus } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";
import { CURRENT_EVENT_ID, getServices } from "@/services";

export function BaggageSection({ guestId }: { guestId: string }) {
  const { data, loading, reload } = useAsyncData(() => {
    const { logistics } = getServices();
    return Promise.all([logistics.listBaggageForGuest(guestId), logistics.listBaggage(CURRENT_EVENT_ID)]);
  }, [guestId]);
  const [bags, allBags] = data ?? [[], []];
  const [busyId, setBusyId] = useState<string | null>(null);

  async function setStatus(bag: Baggage, status: BaggageStatus) {
    setBusyId(bag.id);
    try {
      await getServices().logistics.updateBaggage(bag.id, { status });
      reload();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(bag: Baggage) {
    if (!window.confirm(`Remove bag ${bag.tag}?`)) return;
    setBusyId(bag.id);
    try {
      await getServices().logistics.deleteBaggage(bag.id);
      reload();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Baggage</h2>
          <p className="text-sm text-muted">
            {bags.length} bag{bags.length === 1 ? "" : "s"}
          </p>
        </div>
        {loading && !data && <p className="text-muted">Loading…</p>}
        <DataTable
          rows={bags}
          rowKey={(b) => b.id}
          empty="No bags tagged yet."
          columns={[
            { header: "Tag", cell: (b) => <span className="font-mono">{b.tag}</span> },
            { header: "Description", cell: (b) => b.description ?? <span className="text-muted">—</span> },
            { header: "Status", cell: (b) => <BagStatusControl bag={b} busy={busyId === b.id} onChange={(s) => setStatus(b, s)} /> },
            {
              header: "",
              cell: (b) => (
                <Button variant="danger" onClick={() => remove(b)} disabled={busyId === b.id}>
                  Delete
                </Button>
              ),
            },
          ]}
        />
      </div>

      <AddBagForm key={allBags.length} guestId={guestId} suggestedTag={nextBagTag(allBags)} onAdded={reload} />
    </section>
  );
}

function AddBagForm({
  guestId,
  suggestedTag,
  onAdded,
}: {
  guestId: string;
  suggestedTag: string;
  onAdded: () => void;
}) {
  const [tag, setTag] = useState(suggestedTag);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<BaggageStatus>("checked_in");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!tag.trim()) {
      setError("Enter the printed tag number.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await getServices().logistics.createBaggage({ guestId, tag, description, status });
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border p-5">
      <h3 className="mb-3 font-semibold">Add a bag</h3>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-36">
          <Field label="Tag">
            <input className={`${inputClassName} font-mono`} value={tag} onChange={(e) => setTag(e.target.value)} />
          </Field>
        </div>
        <div className="min-w-48 flex-1">
          <Field label="Description">
            <input className={inputClassName} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Black Samsonite, red ribbon" />
          </Field>
        </div>
        <div className="w-40">
          <Field label="Status">
            <select className={inputClassName} value={status} onChange={(e) => setStatus(e.target.value as BaggageStatus)}>
              {BAGGAGE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {BAGGAGE_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Button variant="primary" type="submit" disabled={submitting}>
          {submitting ? "Adding…" : "+ Add bag"}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
    </form>
  );
}
