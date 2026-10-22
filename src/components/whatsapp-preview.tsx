"use client";

import { useEffect, useState } from "react";

import { inlineInputClassName } from "@/components/ui";
import { renderTemplate } from "@/lib/templates";
import type { Campaign, Guest, Message, RsvpStatus } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";
import { CURRENT_EVENT_ID, getServices } from "@/services";

const QUICK_REPLIES: { status: RsvpStatus; label: string; reply: string }[] = [
  { status: "attending", label: "✅ Attending", reply: "Yes, I'll be there!" },
  { status: "declined", label: "❌ Can't make it", reply: "Sorry, I can't make it." },
  { status: "maybe", label: "🤔 Maybe", reply: "Not sure yet, maybe." },
];

interface ChatReply {
  id: number;
  from: "guest" | "avora";
  text: string;
  at: string;
}

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" });

const statusCaption: Record<Message["status"], string> = {
  queued: "Queued",
  sent: "Sent ✓",
  delivered: "Delivered ✓✓",
  read: "Read ✓✓",
  failed: "Failed ✕",
};

/**
 * "Preview as guest": a fake phone that renders campaign messages the way
 * the guest would see them in WhatsApp, with working RSVP quick replies.
 * Everything it shows comes through `getServices()`; the quick replies call
 * `guests.upsertRsvp`, so the RSVP matrix and profile update too.
 */
export function WhatsAppPreview({
  open,
  onClose,
  guestId,
  campaignId,
  guestOptions,
  onGuestChange,
}: {
  open: boolean;
  onClose: () => void;
  guestId: string;
  /** Campaign to feature: a draft shows as an unsent preview bubble. */
  campaignId?: string;
  /** When given, a picker lets the user switch which guest they preview as. */
  guestOptions?: Guest[];
  onGuestChange?: (guestId: string) => void;
}) {
  const { data, reload } = useAsyncData(async () => {
    if (!open) return undefined;
    const { events, guests, messaging } = getServices();
    const [guest, event, functions, templates, campaigns, messages, featured] = await Promise.all([
      guests.getGuest(guestId),
      events.getEvent(CURRENT_EVENT_ID),
      events.listFunctions(CURRENT_EVENT_ID),
      messaging.listTemplates(),
      messaging.listCampaigns(CURRENT_EVENT_ID),
      messaging.listMessagesForGuest(guestId),
      campaignId ? messaging.getCampaign(campaignId) : Promise.resolve(undefined),
    ]);
    return { guest, event, functions, templates, campaigns, messages, featured };
  }, [open, guestId, campaignId]);

  // Live delivery ticks.
  useEffect(() => {
    if (!open) return;
    return getServices().messaging.subscribe(reload);
  }, [open, reload]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-background p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        aria-label="WhatsApp preview"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Preview as guest</h2>
            <p className="text-xs text-muted">Simulated WhatsApp. Replies update the real RSVP.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="rounded-full px-2 py-1 text-muted hover:bg-surface hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {guestOptions && guestOptions.length > 0 && onGuestChange && (
          <label className="mb-3 block text-xs text-muted">
            Viewing as
            <select
              className={`${inlineInputClassName} ml-2 py-1`}
              value={guestId}
              onChange={(e) => onGuestChange(e.target.value)}
            >
              {guestOptions.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {data?.guest ? (
          <Phone
            key={`${guestId}:${campaignId ?? "none"}`}
            guest={data.guest}
            eventName={data.event?.name ?? "the event"}
            functions={data.functions}
            templates={data.templates}
            campaigns={data.campaigns}
            messages={data.messages}
            featured={data.featured}
          />
        ) : (
          <p className="text-sm text-muted">Loading…</p>
        )}
      </aside>
    </div>
  );
}

function Phone({
  guest,
  eventName,
  functions,
  templates,
  campaigns,
  messages,
  featured,
}: {
  guest: Guest;
  eventName: string;
  functions: { id: string; name: string }[];
  templates: { id: string; body: string }[];
  campaigns: Campaign[];
  messages: Message[];
  featured?: Campaign;
}) {
  // Replies live only in this panel; they're a simulation of the guest's
  // side of the conversation, not stored data.
  const [replies, setReplies] = useState<ChatReply[]>([]);
  const [replying, setReplying] = useState(false);

  const campaignById = new Map(campaigns.map((c) => [c.id, c]));
  const templateById = new Map(templates.map((t) => [t.id, t]));
  const functionById = new Map(functions.map((f) => [f.id, f]));

  const render = (campaign: Campaign | undefined) => {
    const body = campaign ? (templateById.get(campaign.templateId)?.body ?? "") : "";
    const functionName =
      campaign?.audience.type === "function" ? functionById.get(campaign.audience.functionId)?.name : undefined;
    return renderTemplate(body, { guestName: guest.name.split(" ")[0], functionName, eventName });
  };

  const thread = [...messages].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  const featuredHasMessage = featured ? thread.some((m) => m.campaignId === featured.id) : false;
  const showPreviewBubble = Boolean(featured) && !featuredHasMessage;

  // Quick replies answer the featured campaign (or the latest message).
  const replyTarget = featured ?? campaignById.get(thread[thread.length - 1]?.campaignId ?? "");
  const targetFunctionIds =
    replyTarget?.audience.type === "function" ? [replyTarget.audience.functionId] : functions.map((f) => f.id);
  const targetLabel =
    targetFunctionIds.length === 1
      ? (functionById.get(targetFunctionIds[0])?.name ?? "the function")
      : `all ${functions.length} functions`;

  async function quickReply(choice: (typeof QUICK_REPLIES)[number]) {
    if (replying) return;
    setReplying(true);
    const now = new Date().toISOString();
    setReplies((r) => [...r, { id: Date.now(), from: "guest", text: choice.reply, at: now }]);
    try {
      const { guests } = getServices();
      const existing = await guests.listRsvpsForGuest(guest.id);
      await Promise.all(
        targetFunctionIds.map((functionId) => {
          const current = existing.find((r) => r.functionId === functionId);
          const headcount = choice.status === "declined" ? 0 : Math.max(1, current?.headcount ?? 1);
          return guests.upsertRsvp({ guestId: guest.id, functionId, status: choice.status, headcount });
        }),
      );
      const wording =
        choice.status === "attending"
          ? `Wonderful, ${guest.name.split(" ")[0]}! You're marked as attending ${targetLabel}. 🎉`
          : choice.status === "declined"
            ? `Thanks for letting us know, ${guest.name.split(" ")[0]}. We've marked you as not attending ${targetLabel}.`
            : `No problem, ${guest.name.split(" ")[0]} — we've noted a maybe for ${targetLabel}. Reply any time to update it.`;
      setReplies((r) => [...r, { id: Date.now() + 1, from: "avora", text: wording, at: new Date().toISOString() }]);
    } finally {
      setReplying(false);
    }
  }

  const hasAnything = thread.length > 0 || showPreviewBubble;

  return (
    <div className="mx-auto w-full max-w-[340px] rounded-[2rem] border-[6px] border-neutral-900 bg-neutral-900 shadow-xl">
      <div className="flex h-[620px] flex-col overflow-hidden rounded-[1.6rem] bg-[#e5ddd5]">
        {/* status bar */}
        <div className="flex items-center justify-between bg-[#075e54] px-4 pt-2 text-[10px] text-white/80">
          <span>{timeOf(new Date().toISOString())}</span>
          <span>▲ ▮ 🔋</span>
        </div>
        {/* chat header */}
        <div className="flex items-center gap-3 bg-[#075e54] px-3 pb-3 pt-1 text-white">
          <span aria-hidden>‹</span>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-semibold">A</div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Avora Events</p>
            <p className="text-[10px] text-white/80">Business account · online</p>
          </div>
        </div>

        {/* thread */}
        <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3 text-[13px]" data-testid="chat-thread">
          <p className="mx-auto w-fit rounded-md bg-[#d4e7f5] px-2 py-0.5 text-[10px] text-neutral-700">
            Messages to this business are secured (simulation)
          </p>

          {!hasAnything && (
            <p className="pt-6 text-center text-xs text-neutral-500">No messages yet for {guest.name}.</p>
          )}

          {thread.map((m) => (
            <Bubble key={m.id} side="left" text={render(campaignById.get(m.campaignId))} time={timeOf(m.sentAt)} caption={statusCaption[m.status]} />
          ))}

          {showPreviewBubble && featured && (
            <Bubble side="left" text={render(featured)} time="now" caption="Preview — not sent yet" />
          )}

          {replyTarget && (
            <div className="space-y-1 pl-1" data-testid="quick-replies">
              {QUICK_REPLIES.map((q) => (
                <button
                  key={q.status}
                  type="button"
                  onClick={() => quickReply(q)}
                  disabled={replying}
                  className="block w-[85%] rounded-lg bg-white py-1.5 text-center text-[13px] font-medium text-[#027eb5] shadow-sm transition hover:bg-neutral-50 disabled:opacity-60"
                >
                  {q.label}
                </button>
              ))}
            </div>
          )}

          {replies.map((r) =>
            r.from === "guest" ? (
              <Bubble key={r.id} side="right" text={r.text} time={timeOf(r.at)} ticks />
            ) : (
              <Bubble key={r.id} side="left" text={r.text} time={timeOf(r.at)} />
            ),
          )}
        </div>

        {/* composer */}
        <div className="flex items-center gap-2 bg-[#f0f0f0] px-3 py-2">
          <div className="flex-1 rounded-full bg-white px-3 py-1.5 text-xs text-neutral-400">Type a message</div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#128c7e] text-xs text-white">🎤</div>
        </div>
      </div>
    </div>
  );
}

function Bubble({
  side,
  text,
  time,
  caption,
  ticks,
}: {
  side: "left" | "right";
  text: string;
  time: string;
  caption?: string;
  ticks?: boolean;
}) {
  return (
    <div className={`flex flex-col ${side === "right" ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-2.5 py-1.5 shadow-sm ${
          side === "right" ? "rounded-tr-none bg-[#dcf8c6]" : "rounded-tl-none bg-white"
        }`}
      >
        <p className="whitespace-pre-wrap text-neutral-900">{text}</p>
        <p className="mt-0.5 text-right text-[10px] text-neutral-500">
          {time}
          {ticks && <span className="ml-1 text-[#4fc3f7]">✓✓</span>}
        </p>
      </div>
      {caption && <p className="mt-0.5 px-1 text-[10px] text-neutral-500">{caption}</p>}
    </div>
  );
}
