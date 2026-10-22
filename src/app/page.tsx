"use client";

import Link from "next/link";
import { MockBanner, Stat } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { modules } from "@/lib/modules";
import { useAsyncData } from "@/lib/use-async-data";
import { CURRENT_EVENT_ID, getServices } from "@/services";

export default function Home() {
  const { data, loading } = useAsyncData(() => {
    const { events, guests, logistics } = getServices();
    return Promise.all([
      events.getEvent(CURRENT_EVENT_ID),
      guests.listGuests(CURRENT_EVENT_ID),
      guests.listRsvps(CURRENT_EVENT_ID),
      guests.listIdDocuments(CURRENT_EVENT_ID),
      logistics.listCheckIns(CURRENT_EVENT_ID),
    ]);
  }, []);

  const [event, guestList, rsvps, ids, checkIns] = data ?? [undefined, [], [], [], []];

  const responded = new Set(rsvps.filter((r) => r.status !== "pending").map((r) => r.guestId)).size;
  const arrived = new Set(checkIns.map((c) => c.guestId)).size;

  return (
    <>
      <header className="mb-6">
        <p className="text-sm font-medium uppercase tracking-wide text-accent">
          {loading ? "Loading…" : "Event"}
        </p>
        <h1 className="mt-1 text-3xl font-semibold">{event?.name}</h1>
        {event && (
          <p className="text-muted">
            {event.city} · {formatDate(event.startDate)} – {formatDate(event.endDate)}
          </p>
        )}
      </header>

      <MockBanner />

      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Guests" value={guestList.length} />
        <Stat label="RSVP responded" value={`${responded}/${guestList.length}`} />
        <Stat label="IDs received" value={`${ids.length}/${guestList.length}`} />
        <Stat label="Arrived" value={`${arrived}/${guestList.length}`} />
      </section>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {modules.map((m) => (
          <Link
            key={m.slug}
            href={`/${m.slug}`}
            className="flex aspect-[4/3] flex-col justify-end rounded-2xl border border-border bg-surface p-4 transition hover:border-accent"
          >
            <span className="text-lg font-semibold">{m.title}</span>
            <span className="text-sm text-muted">{m.description}</span>
          </Link>
        ))}
      </section>
    </>
  );
}
