"use client";

import Link from "next/link";

import { MockBanner, Stat } from "@/components/ui";
import { formatDate, formatDateTime, formatINR, toDateTimeLocal } from "@/lib/format";
import { idStatus, overallRsvpStatus } from "@/lib/guest-helpers";
import { modules } from "@/lib/modules";
import { COST_PER_RECIPIENT_INR } from "@/lib/pricing";
import { useAsyncData } from "@/lib/use-async-data";
import { CURRENT_EVENT_ID, getServices } from "@/services";

export default function Home() {
  const { data, loading } = useAsyncData(async () => {
    const { events, guests, logistics, messaging } = getServices();
    const [event, guestList, rsvps, ids, checkIns, travel, campaigns] = await Promise.all([
      events.getEvent(CURRENT_EVENT_ID),
      guests.listGuests(CURRENT_EVENT_ID),
      guests.listRsvps(CURRENT_EVENT_ID),
      guests.listIdDocuments(CURRENT_EVENT_ID),
      logistics.listCheckIns(CURRENT_EVENT_ID),
      logistics.listTravel(CURRENT_EVENT_ID),
      messaging.listCampaigns(CURRENT_EVENT_ID),
    ]);
    const messages = (await Promise.all(campaigns.map((c) => messaging.listMessages(c.id)))).flat();
    // "Today" is read here (after mount) rather than during render so the
    // static prerender never bakes in a build-time date.
    const now = new Date();
    return { event, guestList, rsvps, ids, checkIns, travel, messages, now };
  }, []);

  const { event, guestList = [], rsvps = [], ids = [], checkIns = [], travel = [], messages = [], now } = data ?? {};

  // --- RSVP funnel (per guest) ---
  const funnel = { attending: 0, declined: 0, pending: 0, noResponse: 0 };
  for (const g of guestList) {
    if (!rsvps.some((r) => r.guestId === g.id)) funnel.noResponse += 1;
    else {
      const s = overallRsvpStatus(g.id, rsvps);
      if (s === "attending") funnel.attending += 1;
      else if (s === "declined") funnel.declined += 1;
      else funnel.pending += 1; // pending or maybe
    }
  }

  // --- ID documents still needing action ---
  const idCounts = { missing: 0, review: 0, expired: 0 };
  for (const g of guestList) {
    const s = idStatus(ids.find((d) => d.guestId === g.id), now);
    if (s === "missing" || s === "review" || s === "expired") idCounts[s] += 1;
  }
  const idPending = idCounts.missing + idCounts.review + idCounts.expired;

  // --- Arrivals today (IST), with the next one if there are none ---
  const today = now ? toDateTimeLocal(now.toISOString()).slice(0, 10) : "";
  const arrivals = travel.filter((t) => t.direction === "arrival").sort((a, b) => a.datetime.localeCompare(b.datetime));
  const arrivalsToday = arrivals.filter((t) => toDateTimeLocal(t.datetime).slice(0, 10) === today);
  const nextArrival = arrivals.find((t) => toDateTimeLocal(t.datetime).slice(0, 10) > today);
  const arrived = new Set(checkIns.map((c) => c.guestId)).size;

  // --- Mock message spend ---
  const messagesSent = messages.filter((m) => m.status !== "queued").length;
  const spend = messagesSent * COST_PER_RECIPIENT_INR;

  const nameById = new Map(guestList.map((g) => [g.id, g.name]));

  return (
    <>
      <header className="mb-6">
        <p className="text-sm font-medium uppercase tracking-wide text-accent">{loading ? "Loading…" : "Event"}</p>
        <h1 className="mt-1 text-3xl font-semibold">{event?.name}</h1>
        {event && (
          <p className="text-muted">
            {event.city} · {formatDate(event.startDate)} – {formatDate(event.endDate)}
          </p>
        )}
      </header>

      <MockBanner />

      <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Guests" value={guestList.length} />
        <Stat
          label="Arrivals today"
          value={
            <>
              {arrivalsToday.length}
              {arrivalsToday.length === 0 && nextArrival && (
                <span className="block text-xs font-normal text-muted">
                  next: {nameById.get(nextArrival.guestId)?.split(" ")[0]} · {formatDateTime(nextArrival.datetime)}
                </span>
              )}
              {arrivalsToday.length > 0 && (
                <span className="block text-xs font-normal text-muted">
                  {arrivalsToday
                    .slice(0, 3)
                    .map((t) => `${nameById.get(t.guestId)?.split(" ")[0]} ${formatDateTime(t.datetime).split(", ")[1]}`)
                    .join(" · ")}
                </span>
              )}
            </>
          }
        />
        <Stat label="Checked in somewhere" value={`${arrived}/${guestList.length}`} />
        <Stat
          label="Message spend (mock)"
          value={
            <>
              {formatINR(spend)}
              <span className="block text-xs font-normal text-muted">
                {messagesSent} sent × {formatINR(COST_PER_RECIPIENT_INR)}
              </span>
            </>
          }
        />
      </section>

      <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link href="/rsvp" className="rounded-xl border border-border p-4 transition hover:border-accent">
          <p className="text-sm text-muted">RSVP funnel</p>
          <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-surface" aria-hidden>
            {guestList.length > 0 && (
              <>
                <span className="bg-emerald-500" style={{ width: `${(funnel.attending / guestList.length) * 100}%` }} />
                <span className="bg-rose-500" style={{ width: `${(funnel.declined / guestList.length) * 100}%` }} />
                <span className="bg-amber-400" style={{ width: `${(funnel.pending / guestList.length) * 100}%` }} />
              </>
            )}
          </div>
          <dl className="mt-3 grid grid-cols-4 gap-2 text-center text-sm">
            <FunnelItem label="Attending" value={funnel.attending} className="text-emerald-700 dark:text-emerald-400" />
            <FunnelItem label="Declined" value={funnel.declined} className="text-rose-700 dark:text-rose-400" />
            <FunnelItem label="Pending" value={funnel.pending} className="text-amber-700 dark:text-amber-400" />
            <FunnelItem label="No response" value={funnel.noResponse} className="text-muted" />
          </dl>
        </Link>

        <Link href="/ids" className="rounded-xl border border-border p-4 transition hover:border-accent">
          <p className="text-sm text-muted">ID documents pending</p>
          <p className="mt-1 text-2xl font-semibold">
            {idPending}
            <span className="text-base font-normal text-muted"> of {guestList.length} guests</span>
          </p>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
            <FunnelItem label="Missing" value={idCounts.missing} className="text-rose-700 dark:text-rose-400" />
            <FunnelItem label="Needs review" value={idCounts.review} className="text-amber-700 dark:text-amber-400" />
            <FunnelItem label="Expired" value={idCounts.expired} className="text-rose-700 dark:text-rose-400" />
          </dl>
        </Link>
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

function FunnelItem({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`text-xl font-semibold ${className}`}>{value}</dd>
    </div>
  );
}
