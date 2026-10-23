"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge, Button, DataTable, MockBanner, PageHeader } from "@/components/ui";
import { formatDateTime, formatINR } from "@/lib/format";
import type { Campaign, CampaignStatus, Message } from "@/lib/types";
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
  const { data, loading, reload } = useAsyncData(async () => {
    const { messaging } = getServices();
    const [campaigns, templates] = await Promise.all([
      messaging.listCampaigns(CURRENT_EVENT_ID),
      messaging.listTemplates(),
    ]);
    const messagesByCampaign = new Map<string, Message[]>(
      await Promise.all(
        campaigns.map(async (c) => [c.id, await messaging.listMessages(c.id)] as const),
      ),
    );
    return { campaigns, templates, messagesByCampaign };
  }, []);
  const { campaigns = [], templates = [], messagesByCampaign = new Map<string, Message[]>() } = data ?? {};
  const templateById = new Map(templates.map((t) => [t.id, t]));

  const [wizardOpen, setWizardOpen] = useState(false);

  const counts = (c: Campaign) => {
    const msgs = messagesByCampaign.get(c.id) ?? [];
    // "Sent" counts everything that left the queue; delivered/read are subsets.
    return {
      sent: msgs.filter((m) => m.status === "sent" || m.status === "delivered" || m.status === "read").length,
      delivered: msgs.filter((m) => m.status === "delivered" || m.status === "read").length,
      read: msgs.filter((m) => m.status === "read").length,
    };
  };

  return (
    <>
      <PageHeader title="Campaigns" description="Bulk WhatsApp sends with a cost preview before sending." />
      <MockBanner />

      <div className="mb-4 flex items-center justify-between">
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
        empty="No campaigns yet. Create the first one."
        columns={[
          { header: "Name", cell: (c) => <span className="font-medium">{c.name}</span> },
          { header: "Template", cell: (c) => templateById.get(c.templateId)?.name },
          { header: "Segment", cell: (c) => c.segment },
          { header: "Recipients", cell: (c) => c.recipients },
          { header: "Est. cost", cell: (c) => formatINR(c.estimatedCost) },
          { header: "Status", cell: (c) => <Badge tone={statusTone[c.status]}>{c.status}</Badge> },
          {
            header: "Delivery",
            cell: (c) => {
              const k = counts(c);
              if ((messagesByCampaign.get(c.id) ?? []).length === 0) return <span className="text-muted">—</span>;
              return (
                <div className="flex flex-col gap-0.5 text-xs">
                  <span>{k.sent} sent</span>
                  <span className="text-emerald-700 dark:text-emerald-400">{k.delivered} delivered</span>
                  <span className="text-sky-700 dark:text-sky-400">{k.read} read</span>
                </div>
              );
            },
          },
          { header: "Sent at", cell: (c) => (c.sentAt ? formatDateTime(c.sentAt) : "—") },
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
      <p className="mt-2 text-xs text-muted">
        Templates support the <code className="font-mono">{"{{guest_name}}"}</code> and{" "}
        <code className="font-mono">{"{{function_name}}"}</code> placeholders.
      </p>

      <NewCampaignModal
        key={wizardOpen ? "open" : "idle"}
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSent={(campaignId) => {
          setWizardOpen(false);
          reload();
          router.push(`/campaigns/${campaignId}`);
        }}
      />
    </>
  );
}
