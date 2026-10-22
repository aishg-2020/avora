"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge, Button, DataTable } from "@/components/ui";
import { WhatsAppPreview } from "@/components/whatsapp-preview";
import { formatDateTime } from "@/lib/format";
import type { MessageStatus } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";
import { CURRENT_EVENT_ID, getServices } from "@/services";

const tone: Record<MessageStatus, "good" | "warn" | "bad" | "neutral"> = {
  read: "good",
  delivered: "good",
  sent: "neutral",
  queued: "neutral",
  failed: "bad",
};

// Read-only: messages are created by campaigns, never from a profile.
export function MessagesSection({ guestId }: { guestId: string }) {
  const { data, loading, reload } = useAsyncData(() => {
    const { messaging } = getServices();
    return Promise.all([
      messaging.listMessagesForGuest(guestId),
      messaging.listCampaigns(CURRENT_EVENT_ID),
      messaging.listTemplates(),
    ]);
  }, [guestId]);
  const [messages, campaigns, templates] = data ?? [[], [], []];
  const campaignById = new Map(campaigns.map((c) => [c.id, c]));
  const templateById = new Map(templates.map((t) => [t.id, t]));
  const [preview, setPreview] = useState<{ campaignId?: string } | null>(null);

  // Delivery ticks keep moving while a campaign is being simulated.
  useEffect(() => getServices().messaging.subscribe(reload), [reload]);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Messages</h2>
        <div className="flex items-center gap-3">
          <Link href="/campaigns" className="text-sm text-accent hover:underline">
            Campaigns →
          </Link>
          <Button variant="secondary" onClick={() => setPreview({})}>
            Preview as guest
          </Button>
        </div>
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
              <Button variant="ghost" onClick={() => setPreview({ campaignId: m.campaignId })}>
                Open in simulator
              </Button>
            ),
          },
        ]}
      />

      {preview && (
        <WhatsAppPreview open onClose={() => setPreview(null)} guestId={guestId} campaignId={preview.campaignId} />
      )}
    </section>
  );
}
