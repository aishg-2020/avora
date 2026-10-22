import { Badge, DataTable, MockBanner, PageHeader } from "@/components/ui";
import { formatDateTime, formatINR } from "@/lib/format";
import { CURRENT_EVENT_ID, getServices } from "@/services";

export default async function CampaignsPage() {
  const { messaging } = getServices();
  const [campaigns, templates] = await Promise.all([
    messaging.listCampaigns(CURRENT_EVENT_ID),
    messaging.listTemplates(),
  ]);
  const templateById = new Map(templates.map((t) => [t.id, t]));

  return (
    <>
      <PageHeader title="Campaigns" description="Bulk WhatsApp sends with a cost preview before sending." />
      <MockBanner />

      <h2 className="mb-3 text-lg font-semibold">Campaigns</h2>
      <DataTable
        rows={campaigns}
        rowKey={(c) => c.id}
        columns={[
          { header: "Name", cell: (c) => c.name },
          { header: "Template", cell: (c) => templateById.get(c.templateId)?.name },
          { header: "Segment", cell: (c) => c.segment },
          { header: "Recipients", cell: (c) => c.recipients },
          { header: "Est. cost", cell: (c) => formatINR(c.estimatedCost) },
          {
            header: "Status",
            cell: (c) => <Badge tone={c.status === "sent" ? "good" : "neutral"}>{c.status}</Badge>,
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
    </>
  );
}
