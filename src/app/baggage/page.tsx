"use client";

import { useMemo, useState, type FormEvent } from "react";

import { BagStatusControl } from "@/components/bag-status-control";
import { GuestLink } from "@/components/guest-link";
import { Button, DataTable, Field, MockBanner, PageHeader, inlineInputClassName, inputClassName } from "@/components/ui";
import { BAGGAGE_LABEL, BAGGAGE_STATUSES, nextBagTag } from "@/lib/baggage-helpers";
import type { Baggage, BaggageStatus, Guest } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";
import { CURRENT_EVENT_ID, getServices } from "@/services";

export default function BaggagePage() {
  const { data, loading, reload } = useAsyncData(() => {
    const { guests, logistics } = getServices();
    return Promise.all([guests.listGuests(CURRENT_EVENT_ID), logistics.listBaggage(CURRENT_EVENT_ID)]);
  }, []);
  const [guestList, bags] = data ?? [[], []];
  const nameById = useMemo(() => new Map(guestList.map((g) => [g.id, g.name])), [guestList]);

  const [statusFilter, setStatusFilter] = useState<"all" | BaggageStatus>("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bags
      .filter((b) => statusFilter === "all" || b.status === statusFilter)
      .filter((b) => !q || b.tag.toLowerCase().includes(q) || (nameById.get(b.guestId) ?? "").toLowerCase().includes(q))
      .sort((a, b) => a.tag.localeCompare(b.tag, undefined, { numeric: true }));
  }, [bags, statusFilter, search, nameById]);

  const count = (s: BaggageStatus) => bags.filter((b) => b.status === s).length;

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
    if (!window.confirm(`Remove bag ${bag.tag} (${nameById.get(bag.guestId)})?`)) return;
    setBusyId(bag.id);
    try {
      await getServices().logistics.deleteBaggage(bag.id);
      reload();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader title="Baggage" description="Every tagged bag, from airport check-in to the guest's hands. Tap a status to update it." />
      <MockBanner />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className={`${inlineInputClassName} w-56`}
          placeholder="Search tag or owner…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Filter by status"
          className={inlineInputClassName}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | BaggageStatus)}
        >
          <option value="all">All statuses</option>
          {BAGGAGE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {BAGGAGE_LABEL[s]}
            </option>
          ))}
        </select>
        <p className="text-sm text-muted">
          {loading
            ? "Loading…"
            : `${rows.length} of ${bags.length} bags · ${count("checked_in")} checked in · ${count("on_belt")} on belt · ${count("collected")} collected`}
        </p>
      </div>

      <DataTable
        rows={rows}
        rowKey={(b) => b.id}
        empty={bags.length === 0 ? "No bags tagged yet." : "No bags match."}
        columns={[
          { header: "Tag", cell: (b) => <span className="font-mono">{b.tag}</span> },
          { header: "Owner", cell: (b) => <GuestLink id={b.guestId} name={nameById.get(b.guestId)} /> },
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

      <AddBagForm key={bags.length} guests={guestList} suggestedTag={nextBagTag(bags)} onAdded={reload} />
    </>
  );
}

function AddBagForm({
  guests,
  suggestedTag,
  onAdded,
}: {
  guests: Guest[];
  suggestedTag: string;
  onAdded: () => void;
}) {
  const [guestId, setGuestId] = useState(guests[0]?.id ?? "");
  const [tag, setTag] = useState(suggestedTag);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<BaggageStatus>("checked_in");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!guestId) {
      setError("Pick the bag's owner.");
      return;
    }
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
    <form onSubmit={handleSubmit} className="mt-6 rounded-xl border border-border p-5">
      <h3 className="mb-3 font-semibold">Add a bag</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px_1fr_150px_auto] sm:items-end">
        <Field label="Owner">
          <select className={inputClassName} value={guestId} onChange={(e) => setGuestId(e.target.value)}>
            {guests.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tag">
          <input className={`${inputClassName} font-mono`} value={tag} onChange={(e) => setTag(e.target.value)} />
        </Field>
        <Field label="Description">
          <input className={inputClassName} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Black Samsonite, red ribbon" />
        </Field>
        <Field label="Status">
          <select className={inputClassName} value={status} onChange={(e) => setStatus(e.target.value as BaggageStatus)}>
            {BAGGAGE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {BAGGAGE_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Button variant="primary" type="submit" disabled={submitting}>
          {submitting ? "Adding…" : "+ Add bag"}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
    </form>
  );
}
