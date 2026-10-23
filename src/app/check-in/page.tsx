"use client";

import { useMemo, useState } from "react";

import { GuestLink } from "@/components/guest-link";
import { Badge, Button, DataTable, MockBanner, PageHeader, inlineInputClassName } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import type { CheckIn, CheckInStage, Guest, NotificationKind } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";
import { CURRENT_EVENT_ID, getServices } from "@/services";

// The three stages, in the order a guest moves through them.
const STAGES: { id: CheckInStage; label: string; hint: string }[] = [
  { id: "airport", label: "Airport", hint: "Landed / picked up" },
  { id: "hotel", label: "Hotel", hint: "Checked in to the room" },
  { id: "venue", label: "Venue", hint: "At the function" },
];

const kindIcon: Record<NotificationKind, string> = {
  hotel: "🏨",
  whatsapp: "💬",
  driver: "🚗",
  baggage: "🧳",
  host: "🎉",
};

export default function CheckInPage() {
  const { data, loading, reload } = useAsyncData(() => {
    const { guests, logistics } = getServices();
    return Promise.all([
      guests.listGuests(CURRENT_EVENT_ID),
      logistics.listCheckIns(CURRENT_EVENT_ID),
      logistics.listNotifications(CURRENT_EVENT_ID),
    ]);
  }, []);
  const [guestList, checkIns, notifications] = data ?? [[], [], []];
  const nameById = useMemo(() => new Map(guestList.map((g) => [g.id, g.name])), [guestList]);

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [pendingStage, setPendingStage] = useState<"all" | CheckInStage>("all");
  const [search, setSearch] = useState("");

  const checkInFor = (guestId: string, stage: CheckInStage) =>
    checkIns.find((c) => c.guestId === guestId && c.stage === stage);
  const pendingAt = (stage: CheckInStage) => guestList.filter((g) => !checkInFor(g.id, stage));

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return guestList.filter((g) => {
      if (pendingStage !== "all" && checkIns.some((c) => c.guestId === g.id && c.stage === pendingStage)) return false;
      if (q && !g.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [guestList, checkIns, pendingStage, search]);

  async function markArrived(guest: Guest, stage: CheckInStage) {
    const key = `${guest.id}:${stage}`;
    setBusyKey(key);
    try {
      await getServices().logistics.recordCheckIn(guest.id, stage);
      reload();
    } finally {
      setBusyKey(null);
    }
  }

  async function undo(c: CheckIn) {
    if (!window.confirm(`Undo ${c.stage} arrival for ${nameById.get(c.guestId)}?`)) return;
    setBusyKey(c.id);
    try {
      await getServices().logistics.undoCheckIn(c.id);
      reload();
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Check-In"
        description="One tap per stage. Each arrival triggers the notifications the real system would send — see the log below."
      />
      <MockBanner />

      {/* Pending per stage */}
      <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {STAGES.map((stage, i) => {
          const pending = pendingAt(stage.id);
          const arrived = guestList.length - pending.length;
          const active = pendingStage === stage.id;
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => setPendingStage(active ? "all" : stage.id)}
              aria-pressed={active}
              className={`rounded-xl border p-4 text-left transition ${active ? "border-accent bg-surface" : "border-border hover:border-accent/50"}`}
            >
              <p className="text-sm text-muted">
                {i + 1}. {stage.label} <span className="text-xs">· {stage.hint}</span>
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {arrived}/{guestList.length} <span className="text-base font-normal text-muted">arrived</span>
              </p>
              <p className="mt-1 text-xs text-muted">
                {pending.length === 0
                  ? "Nobody pending"
                  : `Pending: ${pending.slice(0, 4).map((g) => g.name.split(" ")[0]).join(", ")}${pending.length > 4 ? ` +${pending.length - 4}` : ""}`}
              </p>
            </button>
          );
        })}
      </section>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          className={`${inlineInputClassName} w-56`}
          placeholder="Search guest…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <p className="text-sm text-muted">
          {loading
            ? "Loading…"
            : pendingStage === "all"
              ? `${rows.length} guests`
              : `${rows.length} still pending at ${pendingStage} · `}
          {pendingStage !== "all" && (
            <button type="button" className="text-accent hover:underline" onClick={() => setPendingStage("all")}>
              show everyone
            </button>
          )}
        </p>
      </div>

      <DataTable
        rows={rows}
        rowKey={(g) => g.id}
        empty={pendingStage === "all" ? "No guests match." : `Everyone has arrived at the ${pendingStage}.`}
        columns={[
          { header: "Guest", cell: (g) => <GuestLink id={g.id} name={g.name} /> },
          ...STAGES.map((stage) => ({
            header: stage.label,
            cell: (g: Guest) => {
              const c = checkInFor(g.id, stage.id);
              const key = `${g.id}:${stage.id}`;
              if (c) {
                return (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="good">{formatDateTime(c.at)}</Badge>
                    <button
                      type="button"
                      className="text-xs text-muted hover:text-foreground hover:underline disabled:opacity-50"
                      disabled={busyKey === c.id}
                      onClick={() => undo(c)}
                    >
                      undo
                    </button>
                  </div>
                );
              }
              return (
                <Button variant="secondary" disabled={busyKey === key} onClick={() => markArrived(g, stage.id)}>
                  {busyKey === key ? "Marking…" : "Mark arrived"}
                </Button>
              );
            },
          })),
        ]}
      />

      {/* Notification log */}
      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Notification log</h2>
          <p className="text-sm text-muted">Mock — what would have been sent. Newest first.</p>
        </div>
        {notifications.length === 0 ? (
          <p className="text-muted">Nothing sent yet. Mark an arrival to see what goes out.</p>
        ) : (
          <ol className="divide-y divide-border rounded-xl border border-border">
            {notifications.map((n) => (
              <li key={n.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                <span aria-hidden className="mt-0.5">
                  {kindIcon[n.kind]}
                </span>
                <div className="min-w-0 flex-1">
                  <p>{n.text}</p>
                  <p className="text-xs text-muted">
                    {formatDateTime(n.at)} · <span className="capitalize">{n.stage}</span> ·{" "}
                    <GuestLink id={n.guestId} name={nameById.get(n.guestId)} />
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
