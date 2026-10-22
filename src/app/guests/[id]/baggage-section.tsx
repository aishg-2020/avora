"use client";

import { useState, type FormEvent } from "react";

import { Badge, Button, DataTable, Field, inputClassName, inlineInputClassName } from "@/components/ui";
import { humanize } from "@/lib/format";
import type { Baggage, BaggageStatus } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";
import { CURRENT_EVENT_ID, getServices } from "@/services";

const STATUSES: BaggageStatus[] = ["at_airport", "in_transit", "in_room"];
const tone: Record<BaggageStatus, "good" | "warn" | "neutral"> = {
  in_room: "good",
  in_transit: "warn",
  at_airport: "warn",
};

// Suggests the next free printed tag ("AV-010") across the whole event so
// staff don't have to look it up.
function nextTag(allBags: Baggage[]): string {
  const max = allBags.reduce((acc, b) => {
    const m = b.tag.match(/^AV-(\d+)$/);
    return m ? Math.max(acc, Number(m[1])) : acc;
  }, 0);
  return `AV-${String(max + 1).padStart(3, "0")}`;
}

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
            {
              header: "Status",
              cell: (b) => (
                <div className="flex items-center gap-2">
                  <Badge tone={tone[b.status]}>{humanize(b.status)}</Badge>
                  <select
                    aria-label={`Status for bag ${b.tag}`}
                    className={`${inlineInputClassName} py-1`}
                    value={b.status}
                    disabled={busyId === b.id}
                    onChange={(e) => setStatus(b, e.target.value as BaggageStatus)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {humanize(s)}
                      </option>
                    ))}
                  </select>
                </div>
              ),
            },
            {
              header: "Actions",
              cell: (b) => (
                <Button variant="danger" onClick={() => remove(b)} disabled={busyId === b.id}>
                  Delete
                </Button>
              ),
            },
          ]}
        />
      </div>

      <AddBagForm key={allBags.length} guestId={guestId} suggestedTag={nextTag(allBags)} onAdded={reload} />
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
  const [status, setStatus] = useState<BaggageStatus>("at_airport");
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
      await getServices().logistics.createBaggage({ guestId, tag, status });
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
        <div className="w-40">
          <Field label="Tag">
            <input className={`${inputClassName} font-mono`} value={tag} onChange={(e) => setTag(e.target.value)} />
          </Field>
        </div>
        <div className="w-44">
          <Field label="Current status">
            <select className={inputClassName} value={status} onChange={(e) => setStatus(e.target.value as BaggageStatus)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
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
