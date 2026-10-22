"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { GuestLink } from "@/components/guest-link";
import { Badge, Button, DataTable, MockBanner, Modal, PageHeader, Stat } from "@/components/ui";
import { WhatsAppPreview } from "@/components/whatsapp-preview";
import { deliveryCounts } from "@/lib/campaign-helpers";
import { formatDateTime, formatINR, maskPhone } from "@/lib/format";
import { renderTemplate } from "@/lib/templates";
import type { CampaignStatus, Guest, MessageStatus } from "@/lib/types";
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

export function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, reload } = useAsyncData(async () => {
    const { events, guests, messaging } = getServices();
    const campaign = await messaging.getCampaign(id);
    if (!campaign) return { campaign: undefined };
    const [event, functions, templates, messages, guestList, audienceNow] = await Promise.all([
      events.getEvent(CURRENT_EVENT_ID),
      events.listFunctions(CURRENT_EVENT_ID),
      messaging.listTemplates(),
      messaging.listMessagesForCampaign(id),
      guests.listGuests(CURRENT_EVENT_ID),
      messaging.resolveAudience(CURRENT_EVENT_ID, campaign.audience),
    ]);
    return { campaign, event, functions, templates, messages, guestList, audienceNow };
  }, [id]);

  // Delivery updates arrive through the service subscription — no reload.
  useEffect(() => getServices().messaging.subscribe(reload), [reload]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [previewGuestId, setPreviewGuestId] = useState<string | null>(null);

  const campaign = data?.campaign;
  const messages = useMemo(() => data?.messages ?? [], [data]);
  const guestById = useMemo(() => new Map((data?.guestList ?? []).map((g) => [g.id, g])), [data]);
  const template = data?.templates?.find((t) => t.id === campaign?.templateId);
  const audience = campaign?.audience;
  const functionName =
    audience?.type === "function" ? data?.functions?.find((f) => f.id === audience.functionId)?.name : undefined;

  if (loading && !data) {
    return (
      <>
        <PageHeader title="Campaign" />
        <p className="text-muted">Loading…</p>
      </>
    );
  }
  if (!campaign) {
    return (
      <>
        <PageHeader title="Campaign not found" description="It may have been removed or the demo data was reset." />
        <Link href="/campaigns" className="text-accent hover:underline">
          Back to campaigns
        </Link>
      </>
    );
  }

  const isDraft = campaign.status === "draft" || campaign.status === "scheduled";
  const counts = deliveryCounts(messages);

  // Recipient rows: real messages once sent, otherwise the live audience.
  type Row = { guest: Guest | undefined; guestId: string; status?: MessageStatus; sentAt?: string; deliveredAt?: string; readAt?: string; key: string };
  const rows: Row[] = isDraft
    ? (data?.audienceNow ?? []).map((g) => ({ guest: g, guestId: g.id, key: g.id }))
    : messages.map((m) => ({ guest: guestById.get(m.guestId), guestId: m.guestId, status: m.status, sentAt: m.sentAt, deliveredAt: m.deliveredAt, readAt: m.readAt, key: m.id }));
  const previewOptions = rows.map((r) => r.guest).filter((g): g is Guest => Boolean(g));

  async function send() {
    setSending(true);
    try {
      await getServices().messaging.sendCampaign(campaign!.id);
      setConfirmOpen(false);
      reload();
    } finally {
      setSending(false);
    }
  }

  const sampleGuest = previewOptions[0];
  const sampleText = renderTemplate(template?.body ?? "", {
    guestName: sampleGuest?.name.split(" ")[0] ?? "Guest",
    functionName,
    eventName: data?.event?.name ?? "the event",
  });

  return (
    <>
      <Link href="/campaigns" className="mb-4 inline-block text-sm text-muted hover:text-foreground">
        ← Campaigns
      </Link>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{campaign.name}</h1>
            <Badge tone={statusTone[campaign.status]}>{campaign.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            {template?.name} · {campaign.segment} · {campaign.recipients} recipient{campaign.recipients === 1 ? "" : "s"} ·{" "}
            {formatINR(campaign.estimatedCost)}
            {campaign.sentAt && ` · sent ${formatDateTime(campaign.sentAt)}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setPreviewGuestId(sampleGuest?.id ?? null)} disabled={!sampleGuest}>
            Preview as guest
          </Button>
          {isDraft && (
            <Button variant="primary" onClick={() => setConfirmOpen(true)} disabled={rows.length === 0}>
              Send campaign
            </Button>
          )}
        </div>
      </header>

      <MockBanner />

      <section className="mb-6 rounded-xl border border-border p-4">
        <p className="mb-1 text-xs text-muted">Message{sampleGuest ? ` as ${sampleGuest.name} will see it` : ""}</p>
        <p className="inline-block rounded-lg bg-[#dcf8c6] px-3 py-2 text-sm text-neutral-900">{sampleText}</p>
      </section>

      {!isDraft && (
        <section className="mb-6">
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Queued" value={counts.queued} />
            <Stat label="Sent" value={counts.sent} />
            <Stat label="Delivered" value={counts.delivered} />
            <Stat label="Read" value={counts.read} />
          </div>
          <Progress counts={counts} />
        </section>
      )}

      <h2 className="mb-3 text-lg font-semibold">
        {isDraft ? `Recipients right now (${rows.length})` : `Recipients (${rows.length})`}
      </h2>
      {isDraft && (
        <p className="mb-3 text-sm text-muted">
          The audience is resolved again when you send, so this list reflects the latest RSVPs and tags.
        </p>
      )}
      <DataTable
        rows={rows}
        rowKey={(r) => r.key}
        empty="Nobody matches this audience right now."
        columns={[
          { header: "Guest", cell: (r) => <GuestLink id={r.guestId} name={r.guest?.name} /> },
          { header: "Phone", cell: (r) => <span className="font-mono text-xs">{r.guest ? maskPhone(r.guest.phone) : "—"}</span> },
          {
            header: "Status",
            cell: (r) => (r.status ? <Badge tone={messageTone[r.status]}>{r.status}</Badge> : <Badge>not sent</Badge>),
          },
          { header: "Sent", cell: (r) => (r.sentAt ? formatDateTime(r.sentAt) : "—") },
          { header: "Delivered", cell: (r) => (r.deliveredAt ? formatDateTime(r.deliveredAt) : "—") },
          { header: "Read", cell: (r) => (r.readAt ? formatDateTime(r.readAt) : "—") },
          {
            header: "",
            cell: (r) => (
              <Button variant="ghost" onClick={() => setPreviewGuestId(r.guestId)} disabled={!r.guest}>
                Preview
              </Button>
            ),
          },
        ]}
      />

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Send this campaign?">
        <div className="space-y-3 text-sm">
          <p>
            “{campaign.name}” will go to <strong>{rows.length}</strong> guest{rows.length === 1 ? "" : "s"} using the{" "}
            <strong>{template?.name}</strong> template.
          </p>
          <p className="text-muted">
            Estimated cost {formatINR(campaign.estimatedCost)}. This is a simulation — nothing is sent for real.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={sending}>
              Cancel
            </Button>
            <Button variant="primary" onClick={send} disabled={sending}>
              {sending ? "Sending…" : "Confirm & send"}
            </Button>
          </div>
        </div>
      </Modal>

      {previewGuestId && (
        <WhatsAppPreview
          open
          onClose={() => setPreviewGuestId(null)}
          guestId={previewGuestId}
          campaignId={campaign.id}
          guestOptions={previewOptions}
          onGuestChange={setPreviewGuestId}
        />
      )}
    </>
  );
}

function Progress({ counts }: { counts: ReturnType<typeof deliveryCounts> }) {
  const total = counts.total || 1;
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`;
  return (
    <div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface" aria-hidden>
        <div className="bg-emerald-500 transition-all duration-500" style={{ width: pct(counts.read) }} />
        <div className="bg-emerald-300 transition-all duration-500" style={{ width: pct(counts.delivered - counts.read) }} />
        <div className="bg-neutral-400 transition-all duration-500" style={{ width: pct(counts.sent - counts.delivered) }} />
      </div>
      <p className="mt-1 text-xs text-muted">
        {counts.read === counts.total
          ? "Everyone has read it."
          : counts.queued > 0
            ? "Sending…"
            : `${counts.total - counts.read} still to be read.`}
      </p>
    </div>
  );
}
