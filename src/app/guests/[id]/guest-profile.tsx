"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { Badge, MockBanner, PageHeader } from "@/components/ui";
import { maskPhone } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async-data";
import { CURRENT_EVENT_ID, getServices } from "@/services";

import { BaggageSection } from "./baggage-section";
import { IdDocumentsSection } from "./id-documents-section";
import { MessagesSection } from "./messages-section";
import { OverviewSection } from "./overview-section";
import { RoomSection } from "./room-section";
import { RsvpSection } from "./rsvp-section";
import { TravelSection } from "./travel-section";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "rsvp", label: "RSVP" },
  { id: "travel", label: "Travel" },
  { id: "ids", label: "ID documents" },
  { id: "room", label: "Room" },
  { id: "baggage", label: "Baggage" },
  { id: "messages", label: "Messages" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function GuestProfile() {
  const params = useParams<{ id: string }>();
  const guestId = params.id;
  const [tab, setTab] = useState<TabId>("overview");

  // The header + overview share guest/party data; every other tab loads its
  // own slice through the service layer so edits there don't force a full
  // page refetch.
  const { data, loading, reload } = useAsyncData(async () => {
    const { guests } = getServices();
    const guest = await guests.getGuest(guestId);
    const [party, parties] = await Promise.all([
      guest ? guests.getParty(guest.partyId) : Promise.resolve(undefined),
      guests.listParties(CURRENT_EVENT_ID),
    ]);
    return { guest, party, parties };
  }, [guestId]);

  if (loading && !data) {
    return (
      <>
        <BackLink />
        <p className="text-muted">Loading…</p>
      </>
    );
  }

  if (!data?.guest) {
    return (
      <>
        <PageHeader title="Guest not found" description="This guest may have been removed." />
        <Link href="/guests" className="text-accent hover:underline">
          Back to guest list
        </Link>
      </>
    );
  }

  const { guest, party, parties } = data;

  return (
    <>
      <BackLink />
      <header className="mb-6 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{guest.name}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>{party?.name ?? "No family"}</span>
          {party && <Badge>{party.side}</Badge>}
          <span aria-hidden>·</span>
          <span className="font-mono">{maskPhone(guest.phone)}</span>
          {guest.isInternational && <Badge tone="warn">International</Badge>}
          {party?.tags.map((t) => <Badge key={`p-${t}`}>{t}</Badge>)}
          {guest.tags?.map((t) => <Badge key={`g-${t}`}>{t}</Badge>)}
        </div>
      </header>

      <MockBanner />

      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-border" aria-label="Guest sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && <OverviewSection guest={guest} party={party} parties={parties} onChanged={reload} />}
      {tab === "rsvp" && <RsvpSection guestId={guest.id} />}
      {tab === "travel" && <TravelSection guestId={guest.id} />}
      {tab === "ids" && <IdDocumentsSection guestId={guest.id} />}
      {tab === "room" && <RoomSection guestId={guest.id} />}
      {tab === "baggage" && <BaggageSection guestId={guest.id} />}
      {tab === "messages" && <MessagesSection guestId={guest.id} />}
    </>
  );
}

function BackLink() {
  return (
    <Link href="/guests" className="mb-4 inline-block text-sm text-muted hover:text-foreground">
      ← Guest list
    </Link>
  );
}
