"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { GuestLink } from "@/components/guest-link";
import { Badge, Button, DataTable, MockBanner, Stat } from "@/components/ui";
import { WhatsAppSimulator } from "@/components/whatsapp-simulator";
import { formatDateTime, formatINR } from "@/lib/format";
import { renderTemplate } from "@/lib/template";
import type { Campaign, CampaignStatus, Guest, Message, MessageStatus } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";
import { CURRENT_EVENT_ID, getServices } from "@/services";

const statusTone: Record<CampaignStatus, "good" | "warn" | "neutral"> = {
  sent: "good",
  sending: "warn",
  scheduled: "neutral",
  draft: "neutral",
};

const messageTone: Record<MessageStatus, "good" | "warn" | "bad" | "neutral"> = {
  read: "good",
  delivered: "good",
  sent: "neutral",
  queued: "warn",
  failed: "bad",
};

const isTerminal = (m: Message) => m.status === "read" || m.status === "failed";

export function CampaignDetail() {
  const params = useParams<{ id: string }>();
  const campaignId = params.id;

  // Static context: templates, guests, functions, event.
  const { data: context } = useAsyncData(() => {
    const { events, guests, messaging } = getServices();
    return Promise.all([
      messaging.listTemplates(),
      guests.listGuests(CURRENT_EVENT_ID),
      events.listFunctions(CURRENT_EVENT_ID),
      events.getEvent(CURRENT_EVENT_ID),
    ]);
  }, []);
  const [templates, guestList, functions, event] = context ?? [[], [], [], undefined];

  // Live data: campaign + messages, polled every second while the delivery
  // simulation is still running so status changes appear without a reload.
  const [campaign, setCampaign] = useState<Campaign | null | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    const load = async () => {
      const { messaging } = getServices();
      const [c, ms] = await Promise.all([messaging.getCampaign(campaignId), messaging.listMessages(campaignId)]);
      if (!active) return;
      setCampaign(c ?? null);
      setMessages(ms);
      const done = !c || c.status !== "sending" ? ms.every(isTerminal) : false;
      if (done && ms.length > 0 && timer) {
        clearInterval(timer);
        timer = undefined;
      }
    };
    load();
    timer = setInterval(load, 1000);
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [campaignId]);

  const [previewGuest, setPreviewGuest] = useState<Guest | null>(null);

  if (campaign === undefined) {
    return (
      <>
        <BackLink />
        <p className="text-muted">Loading…</p>
      </>
    );
  }

  if (campaign === null) {
    return (
      <>
        <BackLink />
        <p className="text-muted">Campaign not found. It may have been removed.</p>
      </>
    );
  }

  const template = templates.find((t) => t.id === campaign.templateId);
  const guestById = new Map(guestList.map((g) => [g.id, g]));
  const targetFunctionId = campaign.audience?.kind === "function" ? campaign.audience.functionId : undefined;
  const targetFunction = functions.find((f) => f.id === targetFunctionId);

  const count = (pred: (m: Message) => boolean) => messages.filter(pred).length;
  const sent = count((m) => m.status === "sent" || m.status === "delivered" || m.status === "read");
  const delivered = count((m) => m.status === "delivered" || m.status === "read");
  const read = count((m) => m.status === "read");
  const live = campaign.status === "sending" || messages.some((m) => !isTerminal(m));

  return (
    <>
      <BackLink />
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{campaign.name}</h1>
          <Badge tone={statusTone[campaign.status]}>{campaign.status}</Badge>
          {live && messages.length > 0 && <span className="text-sm text-muted">updating live…</span>}
        </div>
        <p className="mt-1 text-sm text-muted">
          {template?.name ?? "Unknown template"} · {campaign.segment} ·{" "}
          {campaign.sentAt ? `sent ${formatDateTime(campaign.sentAt)}` : "not sent yet"} · est.{" "}
          {formatINR(campaign.estimatedCost)}
        </p>
      </header>

      <MockBanner />

      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Recipients" value={campaign.recipients} />
        <Stat label="Sent" value={`${sent}/${messages.length || campaign.recipients}`} />
        <Stat label="Delivered" value={`${delivered}/${messages.length || campaign.recipients}`} />
        <Stat label="Read" value={`${read}/${messages.length || campaign.recipients}`} />
      </section>

      {template && (
        <section className="mb-8">
          <p className="mb-1 text-sm text-muted">Message</p>
          <div className="w-fit max-w-xl rounded-lg rounded-tl-none bg-surface px-3 py-2 text-sm shadow-sm">
            {template.body}
          </div>
        </section>
      )}

      <h2 className="mb-3 text-lg font-semibold">Recipients</h2>
      <DataTable
        rows={messages}
        rowKey={(m) => m.id}
        empty="No messages yet — this campaign hasn't been sent."
        columns={[
          {
            header: "Guest",
            cell: (m) => <GuestLink id={m.guestId} name={guestById.get(m.guestId)?.name} />,
          },
          {
            header: "Message",
            cell: (m) => {
              const g = guestById.get(m.guestId);
              if (!template || !g) return "—";
              return (
                <span className="text-muted">
                  {renderTemplate(template.body, {
                    guestName: g.name,
                    functionName: targetFunction?.name ?? event?.name ?? "the celebrations",
                    eventName: event?.name ?? "the celebrations",
                  })}
                </span>
              );
            },
          },
          { header: "Sent at", cell: (m) => formatDateTime(m.sentAt) },
          { header: "Status", cell: (m) => <Badge tone={messageTone[m.status]}>{m.status}</Badge> },
          {
            header: "",
            cell: (m) => {
              const g = guestById.get(m.guestId);
              if (!g || !template) return null;
              return (
                <Button variant="secondary" onClick={() => setPreviewGuest(g)}>
                  Preview as guest
                </Button>
              );
            },
          },
        ]}
      />

      {previewGuest && template && (
        <WhatsAppSimulator
          open
          onClose={() => setPreviewGuest(null)}
          guest={previewGuest}
          template={template}
          functionId={targetFunctionId}
        />
      )}
    </>
  );
}

function BackLink() {
  return (
    <Link href="/campaigns" className="mb-4 inline-block text-sm text-muted hover:text-foreground">
      ← Campaigns
    </Link>
  );
}
