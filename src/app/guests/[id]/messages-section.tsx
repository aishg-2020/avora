"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge, Button, DataTable } from "@/components/ui";
import { WhatsAppSimulator } from "@/components/whatsapp-simulator";
import { formatDateTime } from "@/lib/format";
import type { Guest, Message, MessageStatus, MessageTemplate } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";
import { CURRENT_EVENT_ID, getServices } from "@/services";

const tone: Record<MessageStatus, "good" | "warn" | "bad" | "neutral"> = {
  read: "good",
  delivered: "good",
  sent: "neutral",
  queued: "neutral",
  failed: "bad",
};

// Read-only log: messages are created by campaigns, never from a profile.
// "Preview" opens the WhatsApp simulator for this guest + that campaign's
// template, where the RSVP quick replies are live.
export function MessagesSection({ guest }: { guest: Guest }) {
  const { data, loading } = useAsyncData(() => {
    const { messaging } = getServices();
    return Promise.all([
      messaging.listMessagesForGuest(guest.id),
      messaging.listCampaigns(CURRENT_EVENT_ID),
      messaging.listTemplates(),
    ]);
  }, [guest.id]);
  const [messages, campaigns, templates] = data ?? [[], [], []];
  const campaignById = new Map(campaigns.map((c) => [c.id, c]));
  const templateById = new Map(templates.map((t) => [t.id, t]));

  const [preview, setPreview] = useState<{ template: MessageTemplate; functionId?: string } | null>(null);

  function openPreview(m: Message) {
    const campaign = campaignById.get(m.campaignId);
    const template = campaign && templateById.get(campaign.templateId);
    if (!template) return;
    setPreview({
      template,
      functionId: campaign?.audience?.kind === "function" ? campaign.audience.functionId : undefined,
    });
  }

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Messages</h2>
        <Link href="/campaigns" className="text-sm text-accent hover:underline">
          Campaigns →
        </Link>
      </div>
      {loading && !data && <p className="text-muted">Loading…</p>}
      <DataTable
        rows={messages}
        rowKey={(m) => m.id}
        empty="No campaign messages have been sent to this guest yet."
        columns={[
          { header: "Sent", cell: (m) => formatDateTime(m.sentAt) },
          { header: "Campaign", cell: (m) => campaignById.get(m.campaignId)?.name ?? m.campaignId },
          {
            header: "Template",
            cell: (m) => {
              const tpl = templateById.get(campaignById.get(m.campaignId)?.templateId ?? "");
              return tpl ? (
                <div>
                  <p>{tpl.name}</p>
                  <p className="text-xs text-muted">{tpl.body}</p>
                </div>
              ) : (
                "—"
              );
            },
          },
          { header: "Status", cell: (m) => <Badge tone={tone[m.status]}>{m.status}</Badge> },
          {
            header: "",
            cell: (m) => (
              <Button variant="secondary" onClick={() => openPreview(m)}>
                Preview
              </Button>
            ),
          },
        ]}
      />

      {preview && (
        <WhatsAppSimulator
          open
          onClose={() => setPreview(null)}
          guest={guest}
          template={preview.template}
          functionId={preview.functionId}
        />
      )}
    </section>
  );
}
