import type { Message } from "@/lib/types";

// Cumulative counts, the way WhatsApp Business reports them: a read message
// was also delivered and sent.
export function deliveryCounts(messages: Message[]) {
  const rank: Record<Message["status"], number> = { failed: -1, queued: 0, sent: 1, delivered: 2, read: 3 };
  return {
    total: messages.length,
    queued: messages.filter((m) => m.status === "queued").length,
    sent: messages.filter((m) => rank[m.status] >= 1).length,
    delivered: messages.filter((m) => rank[m.status] >= 2).length,
    read: messages.filter((m) => rank[m.status] >= 3).length,
    failed: messages.filter((m) => m.status === "failed").length,
  };
}
