import { Badge, MockBanner, PageHeader, Stat } from "@/components/ui";
import { getServices } from "@/services";

export default async function WhatsAppPage() {
  const wa = await getServices().messaging.getConnection();

  return (
    <>
      <PageHeader
        title="Connect WhatsApp"
        description="The real WhatsApp Business connection comes in a later phase."
      />
      <MockBanner />
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Status" value={wa.connected ? <Badge tone="good">Connected</Badge> : <Badge tone="bad">Not connected</Badge>} />
        <Stat label="Number" value={<span className="text-base">{wa.phoneNumber}</span>} />
        <Stat label="Quality" value={<Badge tone={wa.qualityRating === "green" ? "good" : wa.qualityRating === "yellow" ? "warn" : "bad"}>{wa.qualityRating}</Badge>} />
        <Stat label="Daily limit" value={`${wa.messagingTier.toLocaleString("en-IN")} users`} />
      </section>
    </>
  );
}
