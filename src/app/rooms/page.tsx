"use client";

import { useMemo, useState, type DragEvent } from "react";

import { GuestLink } from "@/components/guest-link";
import { Badge, Button, MockBanner, PageHeader, inlineInputClassName } from "@/components/ui";
import { downloadCsv } from "@/lib/csv";
import type { Guest, Room } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";
import { CURRENT_EVENT_ID, getServices } from "@/services";

const DND_TYPE = "application/x-avora-guest";

export default function RoomsPage() {
  const { data, loading, reload } = useAsyncData(() => {
    const { guests, logistics } = getServices();
    return Promise.all([guests.listGuests(CURRENT_EVENT_ID), guests.listParties(CURRENT_EVENT_ID), logistics.listRooms(CURRENT_EVENT_ID)]);
  }, []);
  const [guestList, parties, rooms] = data ?? [[], [], []];
  const guestById = useMemo(() => new Map(guestList.map((g) => [g.id, g])), [guestList]);
  const partyById = useMemo(() => new Map(parties.map((p) => [p.id, p])), [parties]);

  const assigned = useMemo(() => new Set(rooms.flatMap((r) => r.guestIds)), [rooms]);
  const unassigned = useMemo(() => guestList.filter((g) => !assigned.has(g.id)), [guestList, assigned]);

  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState<string | null>(null); // room id or "unassigned"
  const [picks, setPicks] = useState<Record<string, string>>({}); // roomId -> guestId chosen in the select

  async function assign(roomId: string, guestId: string) {
    setBusy(true);
    try {
      await getServices().logistics.assignGuestToRoom(roomId, guestId);
      reload();
    } finally {
      setBusy(false);
    }
  }

  async function unassign(guestId: string) {
    setBusy(true);
    try {
      await getServices().logistics.unassignGuest(guestId);
      reload();
    } finally {
      setBusy(false);
    }
  }

  // --- drag and drop (native HTML5; select+Assign below is the fallback) ---
  function onDragStart(e: DragEvent, guestId: string) {
    e.dataTransfer.setData(DND_TYPE, guestId);
    e.dataTransfer.effectAllowed = "move";
  }
  function onDragOver(e: DragEvent, target: string) {
    if (!e.dataTransfer.types.includes(DND_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOver !== target) setDragOver(target);
  }
  function onDrop(e: DragEvent, target: string) {
    e.preventDefault();
    setDragOver(null);
    const guestId = e.dataTransfer.getData(DND_TYPE);
    if (!guestId) return;
    if (target === "unassigned") {
      if (assigned.has(guestId)) unassign(guestId);
    } else {
      const room = rooms.find((r) => r.id === target);
      if (room && !room.guestIds.includes(guestId)) assign(target, guestId);
    }
  }

  const overCapacity = rooms.filter((r) => r.guestIds.length > r.capacity).length;

  // Rooming list: one row per assigned guest, in room order. Built from the
  // data already loaded through the service layer; downloads in-browser.
  function exportRoomingList() {
    const rows = [...rooms]
      .sort((a, b) => a.roomNo.localeCompare(b.roomNo, undefined, { numeric: true }))
      .flatMap((room) =>
        room.guestIds.map((id) => {
          const g = guestById.get(id);
          return [
            `Room ${room.roomNo}`,
            room.hotel,
            g?.name ?? id,
            g ? (partyById.get(g.partyId)?.name ?? "") : "",
            room.type,
            g?.notes ?? "",
          ];
        }),
      );
    downloadCsv("rooming-list", ["Room", "Hotel", "Guest name", "Family", "Bed type", "Notes"], rows);
  }

  return (
    <>
      <PageHeader title="Room Planner" description="Drag guests onto a room, or pick one from the dropdown. Drop a guest on “Unassigned” to clear them." />
      <MockBanner />

      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {loading ? "Loading…" : `${assigned.size} of ${guestList.length} guests roomed across ${rooms.length} rooms`}
        </p>
        <Button variant="secondary" onClick={exportRoomingList} disabled={loading}>
          ⬇ Export rooming list (CSV)
        </Button>
      </div>

      {loading && !data && <p className="text-muted">Loading…</p>}
      {overCapacity > 0 && (
        <p className="mb-4 rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          {overCapacity} room{overCapacity === 1 ? " is" : "s are"} over capacity.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              guestById={guestById}
              partyName={(g) => partyById.get(g.partyId)?.name}
              unassigned={unassigned}
              pick={picks[room.id] ?? ""}
              onPick={(guestId) => setPicks((p) => ({ ...p, [room.id]: guestId }))}
              onAssign={(guestId) => {
                setPicks((p) => ({ ...p, [room.id]: "" }));
                assign(room.id, guestId);
              }}
              onRemove={unassign}
              busy={busy}
              isDragOver={dragOver === room.id}
              onDragStart={onDragStart}
              onDragOver={(e) => onDragOver(e, room.id)}
              onDragLeave={() => setDragOver((d) => (d === room.id ? null : d))}
              onDrop={(e) => onDrop(e, room.id)}
            />
          ))}
        </section>

        <aside
          className={`h-fit rounded-xl border p-4 transition ${
            dragOver === "unassigned" ? "border-accent bg-surface" : "border-dashed border-border"
          }`}
          onDragOver={(e) => onDragOver(e, "unassigned")}
          onDragLeave={() => setDragOver((d) => (d === "unassigned" ? null : d))}
          onDrop={(e) => onDrop(e, "unassigned")}
        >
          <h2 className="mb-1 text-lg font-semibold">Unassigned ({unassigned.length})</h2>
          <p className="mb-3 text-xs text-muted">Drag a guest onto a room. Drop here to unassign.</p>
          {unassigned.length === 0 ? (
            <p className="text-sm text-muted">Everyone has a room.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {unassigned.map((g) => (
                <li key={g.id}>
                  <GuestChip guest={g} subtitle={partyById.get(g.partyId)?.name} onDragStart={onDragStart} />
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </>
  );
}

function RoomCard({
  room,
  guestById,
  partyName,
  unassigned,
  pick,
  onPick,
  onAssign,
  onRemove,
  busy,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  room: Room;
  guestById: Map<string, Guest>;
  partyName: (g: Guest) => string | undefined;
  unassigned: Guest[];
  pick: string;
  onPick: (guestId: string) => void;
  onAssign: (guestId: string) => void;
  onRemove: (guestId: string) => void;
  busy: boolean;
  isDragOver: boolean;
  onDragStart: (e: DragEvent, guestId: string) => void;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent) => void;
}) {
  const occupancy = room.guestIds.length;
  const full = occupancy === room.capacity;
  const over = occupancy > room.capacity;

  return (
    <article
      className={`rounded-xl border p-4 transition ${
        over ? "border-rose-400" : isDragOver ? "border-accent bg-surface" : "border-border"
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      aria-label={`Room ${room.roomNo}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-lg font-semibold">Room {room.roomNo}</p>
        <Badge tone={over ? "bad" : full ? "warn" : "neutral"}>
          {occupancy}/{room.capacity}
          {over ? " · over capacity" : full ? " · full" : ""}
        </Badge>
      </div>
      <p className="text-sm text-muted">
        {room.hotel} · {room.type}
      </p>

      <ul className="mt-3 min-h-10 space-y-1.5">
        {room.guestIds.map((id) => {
          const g = guestById.get(id);
          return (
            <li key={id} className="flex items-center justify-between gap-2">
              {g ? (
                <GuestChip guest={g} subtitle={partyName(g)} onDragStart={onDragStart} />
              ) : (
                <span className="text-sm text-muted">{id}</span>
              )}
              <button
                type="button"
                aria-label={`Remove ${g?.name ?? id} from room ${room.roomNo}`}
                className="rounded-full px-2 text-muted hover:bg-surface hover:text-foreground disabled:opacity-50"
                disabled={busy}
                onClick={() => onRemove(id)}
              >
                ✕
              </button>
            </li>
          );
        })}
        {room.guestIds.length === 0 && <li className="text-sm text-muted">Empty — drop a guest here.</li>}
      </ul>

      {over && (
        <p className="mt-2 text-xs text-rose-700 dark:text-rose-400">
          {occupancy - room.capacity} more than this room sleeps. Move someone, or confirm an extra bed with the hotel.
        </p>
      )}
      {full && !over && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">At capacity.</p>}

      <div className="mt-3 flex gap-2 border-t border-border pt-3">
        <select
          aria-label={`Assign a guest to room ${room.roomNo}`}
          className={`${inlineInputClassName} min-w-0 flex-1 py-1`}
          value={pick}
          disabled={busy || unassigned.length === 0}
          onChange={(e) => onPick(e.target.value)}
        >
          <option value="">{unassigned.length === 0 ? "No unassigned guests" : "Add a guest…"}</option>
          {unassigned.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <Button variant="secondary" disabled={busy || !pick} onClick={() => pick && onAssign(pick)}>
          Assign
        </Button>
      </div>
    </article>
  );
}

function GuestChip({
  guest,
  subtitle,
  onDragStart,
}: {
  guest: Guest;
  subtitle?: string;
  onDragStart: (e: DragEvent, guestId: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, guest.id)}
      className="flex cursor-grab items-center gap-2 rounded-full border border-border bg-background py-1 pl-2 pr-3 text-sm active:cursor-grabbing"
      title="Drag to a room"
    >
      <span aria-hidden className="text-muted">
        ⠿
      </span>
      <span>
        <GuestLink id={guest.id} name={guest.name} />
        {subtitle && <span className="ml-1 text-xs text-muted">{subtitle}</span>}
      </span>
    </div>
  );
}
