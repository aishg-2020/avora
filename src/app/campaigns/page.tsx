"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge, Button, DataTable, MockBanner, PageHeader } from "@/components/ui";
import { formatDateTime, formatINR } from "@/lib/format";
import { deliveryCounts } from "@/lib/campaign-helpers";
import type { Campaign, CampaignStatus } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";
import { CURRENT_EVENT_ID, getServices } from "@/services";

import { NewCampaignModal } from "./new-campaign-modal";

const statusTone: Record<CampaignStatus, "good" | "warn" | "neutral"> = {
  sent: "good",
  sending: "warn",
  scheduled: "neutral",
  draft: "neutral",
};

export default function CampaignsPage() {
  const router = useRouter();
  const { data, loading, reload } = useAsyncData(() => {
    const { messaging } = getServices();
    return Promise.all([
      messaging.listCampaigns(CURRENT_EVENT_ID),
      messaging.listTemplates(),
      messaging.listMessages(CURRENT_EVENT_ID),
    ]);
  }, []);
  const [campaigns, templates, messages] = data ?? [[], [], []];
  const templateById = new Map(templates.map((t) => [t.id, t]));
  const [wizardOpen, setWizardOpen] = useState(false);

  // Keep the counts live while a simulated send is in progress.
  useEffect(() => getServices().messaging.subscribe(reload), [reload]);

  function handleDone(campaign: Campaign, sent: boolean) {
    setWizardOpen(false);
    if (sent) router.push(`/campaigns/${campaign.id}`);
    else reload();
  }

  return (
    <>
      <PageHeader title="Campaigns" description="Bulk WhatsApp sends with a cost preview before sending." />
      <MockBanner />

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Campaigns</h2>
        <Button variant="primary" onClick={() => setWizardOpen(true)}>
          + New campaign
        </Button>
      </div>
      {loading && !data && <p className="text-muted">Loading…</p>}
      <DataTable
        rows={campaigns}
        rowKey={(c) => c.id}
        onRowClick={(c) => router.push(`/campaigns/${c.id}`)}
        empty="No campaigns yet. Create one to message your guests."
        columns={[
          { header: "Name", cell: (c) => <span className="font-medium">{c.name}</span> },
          { header: "Template", cell: (c) => templateById.get(c.templateId)?.name },
          { header: "Audience", cell: (c) => c.segment },
          { header: "Recipients", cell: (c) => c.recipients },
          { header: "Est. cost", cell: (c) => formatINR(c.estimatedCost) },
          { header: "Status", cell: (c) => <Badge tone={statusTone[c.status]}>{c.status}</Badge> },
          {
            header: "Sent / Delivered / Read",
            cell: (c) => {
              if (c.status === "draft" || c.status === "scheduled") return <span className="text-muted">—</span>;
              const n = deliveryCounts(messages.filter((m) => m.campaignId === c.id));
              return (
                <span className="font-mono text-xs">
                  <span title="Sent">{n.sent}</span> / <span title="Delivered">{n.delivered}</span> /{" "}
                  <span title="Read">{n.read}</span>
                  {n.failed > 0 && <span className="ml-1 text-rose-600 dark:text-rose-400">({n.failed} failed)</span>}
                </span>
              );
            },
          },
          { header: "Sent", cell: (c) => (c.sentAt ? formatDateTime(c.sentAt) : "—") },
        ]}
      />

      <h2 className="mb-3 mt-8 text-lg font-semibold">Templates</h2>
      <DataTable
        rows={templates}
        rowKey={(t) => t.id}
        columns={[
          { header: "Name", cell: (t) => t.name },
          { header: "Category", cell: (t) => <Badge>{t.category}</Badge> },
          { header: "Body", cell: (t) => <span className="text-muted">{t.body}</span> },
        ]}
      />

      <NewCampaignModal
        key={wizardOpen ? "open" : "closed"}
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onDone={handleDone}
      />
    </>
  );
}
