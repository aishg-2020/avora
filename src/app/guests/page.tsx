"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge, Button, DataTable, MockBanner, PageHeader, inputClassName, inlineInputClassName } from "@/components/ui";
import { downloadCsv } from "@/lib/csv";
import { maskPhone } from "@/lib/format";
import { RSVP_STATUSES, SIDES, overallRsvpStatus } from "@/lib/guest-helpers";
import { useAsyncData } from "@/lib/use-async-data";
import type { Guest, RsvpStatus, Side } from "@/lib/types";
import { CURRENT_EVENT_ID, getServices } from "@/services";

import { GuestFormModal } from "./guest-form-modal";
import { ImportCsvModal } from "./import-csv-modal";

const rsvpTone: Record<RsvpStatus, "good" | "warn" | "bad" | "neutral"> = {
  attending: "good",
  maybe: "warn",
  declined: "bad",
  pending: "neutral",
};

export default function GuestsPage() {
  const router = useRouter();
  const { data, loading, reload } = useAsyncData(() => {
    const { events, guests } = getServices();
    return Promise.all([
      guests.listParties(CURRENT_EVENT_ID),
      guests.listGuests(CURRENT_EVENT_ID),
      guests.listRsvps(CURRENT_EVENT_ID),
      events.listFunctions(CURRENT_EVENT_ID),
    ]);
  }, []);
  const [parties, guestList, rsvps, functions] = data ?? [[], [], [], []];
  const partyById = useMemo(() => new Map(parties.map((p) => [p.id, p])), [parties]);
  const allTags = useMemo(
    () =>
      Array.from(new Set([...parties.flatMap((p) => p.tags), ...guestList.flatMap((g) => g.tags ?? [])])).sort(),
    [parties, guestList],
  );

  const [search, setSearch] = useState("");
  const [sideFilter, setSideFilter] = useState<"all" | Side>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [rsvpFilter, setRsvpFilter] = useState<"all" | RsvpStatus>("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | undefined>(undefined);
  const [importOpen, setImportOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return guestList.filter((g) => {
      const party = partyById.get(g.partyId);
      if (sideFilter !== "all" && party?.side !== sideFilter) return false;
      if (tagFilter === "International" && !g.isInternational) return false;
      if (
        tagFilter !== "all" &&
        tagFilter !== "International" &&
        !(party?.tags ?? []).includes(tagFilter) &&
        !(g.tags ?? []).includes(tagFilter)
      ) {
        return false;
      }
      if (rsvpFilter !== "all" && overallRsvpStatus(g.id, rsvps) !== rsvpFilter) return false;
      if (q && !g.name.toLowerCase().includes(q) && !g.phone.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [guestList, partyById, rsvps, search, sideFilter, tagFilter, rsvpFilter]);

  // Logistics sheet for the guests currently shown (filters apply): masked
  // phone, family/side, and one RSVP column per function.
  function exportLogisticsSheet() {
    const headers = ["Guest name", "Family", "Side", "Phone (masked)", ...functions.map((f) => `RSVP: ${f.name}`)];
    const rows = filtered.map((g) => {
      const party = partyById.get(g.partyId);
      return [
        g.name,
        party?.name ?? "",
        party?.side ?? "",
        maskPhone(g.phone),
        ...functions.map((f) => {
          const r = rsvps.find((x) => x.guestId === g.id && x.functionId === f.id);
          if (!r) return "pending";
          return r.headcount > 1 ? `${r.status} (${r.headcount})` : r.status;
        }),
      ];
    });
    downloadCsv("logistics-sheet", headers, rows);
  }

  function openAddGuest() {
    setEditingGuest(undefined);
    setFormOpen(true);
  }

  function openEditGuest(g: Guest) {
    setEditingGuest(g);
    setFormOpen(true);
  }

  async function handleDelete(g: Guest) {
    const confirmed = window.confirm(`Remove ${g.name}? This also removes their RSVPs, travel, ID, room and baggage records.`);
    if (!confirmed) return;
    setDeletingId(g.id);
    try {
      await getServices().guests.deleteGuest(g.id);
      await reload();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Guest List"
        description="Add, edit, import and filter guests. Click a row to open the guest's profile."
      />
      <MockBanner />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-1 flex-wrap gap-3">
          <div className="min-w-[200px] flex-1">
            <input
              className={inputClassName}
              placeholder="Search by name or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className={inlineInputClassName} value={sideFilter} onChange={(e) => setSideFilter(e.target.value as "all" | Side)}>
            <option value="all">All sides</option>
            {SIDES.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <select className={inlineInputClassName} value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
            <option value="all">All tags</option>
            <option value="International">International</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            className={inlineInputClassName}
            value={rsvpFilter}
            onChange={(e) => setRsvpFilter(e.target.value as "all" | RsvpStatus)}
          >
            <option value="all">All RSVP statuses</option>
            {RSVP_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportLogisticsSheet} disabled={loading || filtered.length === 0}>
            ⬇ Export
          </Button>
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            Import CSV
          </Button>
          <Button variant="primary" onClick={openAddGuest}>
            + Add guest
          </Button>
        </div>
      </div>

      <p className="mb-3 text-sm text-muted">
        {loading ? "Loading…" : `${filtered.length} of ${guestList.length} guests`}
      </p>

      <DataTable
        rows={filtered}
        rowKey={(g) => g.id}
        onRowClick={(g) => router.push(`/guests/${g.id}`)}
        empty={guestList.length === 0 ? "No guests yet. Add one or import a CSV." : "No guests match your filters."}
        columns={[
          { header: "Name", cell: (g) => g.name },
          { header: "Phone", cell: (g) => g.phone },
          { header: "Family", cell: (g) => partyById.get(g.partyId)?.name },
          { header: "Side", cell: (g) => <Badge>{partyById.get(g.partyId)?.side}</Badge> },
          {
            header: "Tags",
            cell: (g) => (
              <div className="flex flex-wrap gap-1">
                {g.isInternational && <Badge tone="warn">International</Badge>}
                {partyById.get(g.partyId)?.tags.map((t) => <Badge key={`p-${t}`}>{t}</Badge>)}
                {g.tags?.map((t) => <Badge key={`g-${t}`}>{t}</Badge>)}
              </div>
            ),
          },
          {
            header: "RSVP",
            cell: (g) => {
              const s = overallRsvpStatus(g.id, rsvps);
              return <Badge tone={rsvpTone[s]}>{s}</Badge>;
            },
          },
          {
            header: "Actions",
            cell: (g) => (
              // Stop propagation so the buttons don't also trigger the row's navigation.
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" onClick={() => openEditGuest(g)}>
                  Edit
                </Button>
                <Button variant="danger" onClick={() => handleDelete(g)} disabled={deletingId === g.id}>
                  {deletingId === g.id ? "Removing…" : "Delete"}
                </Button>
              </div>
            ),
          },
        ]}
      />

      <GuestFormModal
        key={formOpen ? editingGuest?.id ?? "new" : "idle"}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          reload();
        }}
        parties={parties}
        guest={editingGuest}
      />

      <ImportCsvModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          reload();
        }}
      />
    </>
  );
}
