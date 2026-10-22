"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Badge, Button, Field, Modal, inputClassName } from "@/components/ui";
import { formatINR } from "@/lib/format";
import { SIDES } from "@/lib/guest-helpers";
import { PLACEHOLDERS, renderTemplate, unknownPlaceholders } from "@/lib/templates";
import type { Campaign, CampaignAudience, Guest, Side, TemplateCategory } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";
import { CURRENT_EVENT_ID, getServices } from "@/services";

type Step = "template" | "audience" | "review";
const STEPS: { id: Step; label: string }[] = [
  { id: "template", label: "Message" },
  { id: "audience", label: "Audience" },
  { id: "review", label: "Review & send" },
];

const NEW_TEMPLATE = "__new__";

export function NewCampaignModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  /** Called with the created campaign; `sent` is true when it was also sent. */
  onDone: (campaign: Campaign, sent: boolean) => void;
}) {
  const { data } = useAsyncData(async () => {
    if (!open) return undefined;
    const { events, guests, messaging } = getServices();
    const [event, functions, parties, guestList, templates, rate] = await Promise.all([
      events.getEvent(CURRENT_EVENT_ID),
      events.listFunctions(CURRENT_EVENT_ID),
      guests.listParties(CURRENT_EVENT_ID),
      guests.listGuests(CURRENT_EVENT_ID),
      messaging.listTemplates(),
      messaging.getRatePerMessage(),
    ]);
    return { event, functions, parties, guestList, templates, rate };
  }, [open]);

  const [step, setStep] = useState<Step>("template");
  const [templateId, setTemplateId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<TemplateCategory>("utility");
  const [newBody, setNewBody] = useState("Hi {{guest_name}}, ");
  const [audienceType, setAudienceType] = useState<CampaignAudience["type"]>("all");
  const [functionId, setFunctionId] = useState("");
  const [side, setSide] = useState<Side>("bride");
  const [tag, setTag] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [recipients, setRecipients] = useState<Guest[]>([]);
  const [cost, setCost] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const templates = useMemo(() => data?.templates ?? [], [data]);
  const functions = useMemo(() => data?.functions ?? [], [data]);
  const allTags = useMemo(() => {
    const tags = new Set<string>(["International"]);
    data?.parties.forEach((p) => p.tags.forEach((t) => tags.add(t)));
    data?.guestList.forEach((g) => g.tags?.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [data]);

  const audience: CampaignAudience = useMemo(() => {
    switch (audienceType) {
      case "function":
        return { type: "function", functionId: functionId || functions[0]?.id || "" };
      case "side":
        return { type: "side", side };
      case "tag":
        return { type: "tag", tag: tag || allTags[0] || "" };
      default:
        return { type: "all" };
    }
  }, [audienceType, functionId, side, tag, functions, allTags]);

  // Recipient count / cost follow the audience as the user changes it.
  useEffect(() => {
    if (!open || step === "template") return;
    let cancelled = false;
    const { messaging } = getServices();
    messaging.resolveAudience(CURRENT_EVENT_ID, audience).then(async (guests) => {
      if (cancelled) return;
      const estimate = templateId && templateId !== NEW_TEMPLATE ? await messaging.estimateCost(templateId, guests) : 0;
      if (cancelled) return;
      setRecipients(guests);
      setCost(estimate);
    });
    return () => {
      cancelled = true;
    };
  }, [open, step, audience, templateId]);

  const selectedTemplate = templates.find((t) => t.id === templateId);
  const creatingTemplate = templateId === NEW_TEMPLATE;
  const bodyForPreview = creatingTemplate ? newBody : (selectedTemplate?.body ?? "");
  const unknown = unknownPlaceholders(bodyForPreview);

  function insertPlaceholder(token: string) {
    const el = bodyRef.current;
    if (!el) {
      setNewBody((b) => b + token);
      return;
    }
    const start = el.selectionStart ?? newBody.length;
    const end = el.selectionEnd ?? newBody.length;
    const next = newBody.slice(0, start) + token + newBody.slice(end);
    setNewBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function nextFromTemplate() {
    setError(null);
    if (!templateId) {
      setError("Pick a template or create a new one.");
      return;
    }
    if (creatingTemplate) {
      if (!newName.trim() || !newBody.trim()) {
        setError("Give the new template a name and a message.");
        return;
      }
      setBusy(true);
      try {
        const created = await getServices().messaging.createTemplate({ name: newName, category: newCategory, body: newBody });
        setTemplateId(created.id);
        if (!campaignName) setCampaignName(created.name);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save the template.");
        return;
      } finally {
        setBusy(false);
      }
    } else if (!campaignName && selectedTemplate) {
      setCampaignName(selectedTemplate.name);
    }
    setStep("audience");
  }

  async function finish(send: boolean) {
    setBusy(true);
    setError(null);
    try {
      const { messaging } = getServices();
      let campaign = await messaging.createCampaign({
        eventId: CURRENT_EVENT_ID,
        name: campaignName,
        templateId,
        audience,
      });
      if (send) campaign = await messaging.sendCampaign(campaign.id);
      onDone(campaign, send);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  const previewGuest = recipients[0] ?? data?.guestList[0];
  const previewText = renderTemplate(bodyForPreview, {
    guestName: previewGuest?.name.split(" ")[0] ?? "Guest",
    functionName: audience.type === "function" ? functions.find((f) => f.id === audience.functionId)?.name : undefined,
    eventName: data?.event?.name ?? "the event",
  });

  return (
    <Modal open={open} onClose={onClose} title="New campaign" wide>
      <ol className="mb-5 flex gap-2 text-xs">
        {STEPS.map((s, i) => {
          const active = s.id === step;
          const done = STEPS.findIndex((x) => x.id === step) > i;
          return (
            <li
              key={s.id}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
                active ? "bg-accent text-white" : done ? "bg-surface text-foreground" : "bg-surface text-muted"
              }`}
            >
              <span className="font-semibold">{i + 1}</span> {s.label}
            </li>
          );
        })}
      </ol>

      {step === "template" && (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {templates.map((t) => (
              <label
                key={t.id}
                className={`cursor-pointer rounded-lg border p-3 text-sm transition ${
                  templateId === t.id ? "border-accent bg-surface" : "border-border hover:border-accent"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <input type="radio" name="template" checked={templateId === t.id} onChange={() => setTemplateId(t.id)} />
                    <span className="font-medium">{t.name}</span>
                  </span>
                  <Badge>{t.category}</Badge>
                </div>
                <p className="mt-1.5 text-xs text-muted">{t.body}</p>
              </label>
            ))}
            <label
              className={`cursor-pointer rounded-lg border border-dashed p-3 text-sm transition ${
                creatingTemplate ? "border-accent bg-surface" : "border-border hover:border-accent"
              }`}
            >
              <span className="flex items-center gap-2">
                <input type="radio" name="template" checked={creatingTemplate} onChange={() => setTemplateId(NEW_TEMPLATE)} />
                <span className="font-medium">+ Write a new template</span>
              </span>
            </label>
          </div>

          {creatingTemplate && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Template name">
                  <input className={inputClassName} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Sangeet reminder" autoFocus />
                </Field>
                <Field label="Category" hint="Marketing needs opt-in; utility is transactional.">
                  <select className={inputClassName} value={newCategory} onChange={(e) => setNewCategory(e.target.value as TemplateCategory)}>
                    <option value="utility">utility</option>
                    <option value="marketing">marketing</option>
                  </select>
                </Field>
              </div>
              <Field label="Message">
                <textarea ref={bodyRef} className={`${inputClassName} min-h-24`} value={newBody} onChange={(e) => setNewBody(e.target.value)} />
              </Field>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted">Insert:</span>
                {PLACEHOLDERS.map((p) => (
                  <button
                    key={p.token}
                    type="button"
                    onClick={() => insertPlaceholder(p.token)}
                    title={p.description}
                    className="rounded-full border border-border px-2 py-0.5 font-mono hover:border-accent"
                  >
                    {p.token}
                  </button>
                ))}
              </div>
            </div>
          )}

          {bodyForPreview && (
            <div className="rounded-lg bg-surface p-3 text-sm">
              <p className="mb-1 text-xs text-muted">Preview for {previewGuest?.name ?? "a guest"}</p>
              <p>{previewText}</p>
              {unknown.length > 0 && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  Unknown placeholder{unknown.length > 1 ? "s" : ""}: {unknown.join(", ")} — will be sent as-is.
                </p>
              )}
            </div>
          )}

          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={nextFromTemplate} disabled={busy}>
              {busy ? "Saving…" : "Next: audience"}
            </Button>
          </div>
        </div>
      )}

      {step === "audience" && (
        <div className="space-y-4">
          <div className="space-y-2 text-sm">
            <AudienceOption checked={audienceType === "all"} onChange={() => setAudienceType("all")} label="All guests" />
            <AudienceOption checked={audienceType === "function"} onChange={() => setAudienceType("function")} label="Attendees of a function">
              <select
                className={inputClassName}
                value={audience.type === "function" ? audience.functionId : ""}
                onChange={(e) => setFunctionId(e.target.value)}
                disabled={audienceType !== "function"}
              >
                {functions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </AudienceOption>
            <AudienceOption checked={audienceType === "side"} onChange={() => setAudienceType("side")} label="Guests by side">
              <select className={inputClassName} value={side} onChange={(e) => setSide(e.target.value as Side)} disabled={audienceType !== "side"}>
                {SIDES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </AudienceOption>
            <AudienceOption checked={audienceType === "tag"} onChange={() => setAudienceType("tag")} label="Guests by tag">
              <select
                className={inputClassName}
                value={audience.type === "tag" ? audience.tag : ""}
                onChange={(e) => setTag(e.target.value)}
                disabled={audienceType !== "tag"}
              >
                {allTags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </AudienceOption>
          </div>

          <div className="rounded-lg bg-surface p-3 text-sm">
            <p>
              <strong>{recipients.length}</strong> recipient{recipients.length === 1 ? "" : "s"} · estimated{" "}
              <strong>{formatINR(cost)}</strong>{" "}
              <span className="text-muted">({formatINR(data?.rate ?? 0)} per recipient)</span>
            </p>
            {recipients.length > 0 && (
              <p className="mt-1 text-xs text-muted">
                {recipients
                  .slice(0, 6)
                  .map((g) => g.name)
                  .join(", ")}
                {recipients.length > 6 ? ` +${recipients.length - 6} more` : ""}
              </p>
            )}
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep("template")}>
              Back
            </Button>
            <Button variant="primary" onClick={() => setStep("review")} disabled={recipients.length === 0}>
              Next: review
            </Button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-4">
          <Field label="Campaign name">
            <input className={inputClassName} value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
          </Field>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-border p-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted">Template</dt>
              <dd className="font-medium">{selectedTemplate?.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Audience</dt>
              <dd className="font-medium">
                {audience.type === "all" && "All guests"}
                {audience.type === "function" && `Attending ${functions.find((f) => f.id === audience.functionId)?.name}`}
                {audience.type === "side" && `${audience.side} side`}
                {audience.type === "tag" && `Tag: ${audience.tag}`}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Recipients</dt>
              <dd className="font-medium">{recipients.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Estimated cost</dt>
              <dd className="font-medium">
                {formatINR(cost)} <span className="text-xs text-muted">@ {formatINR(data?.rate ?? 0)}</span>
              </dd>
            </div>
            <div className="col-span-2 sm:col-span-4">
              <dt className="text-xs text-muted">Message as {previewGuest?.name ?? "a guest"} will see it</dt>
              <dd className="mt-1 rounded-lg bg-[#dcf8c6] px-3 py-2 text-neutral-900">{previewText}</dd>
            </div>
          </dl>

          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          <div className="flex flex-wrap justify-between gap-2 pt-2">
            <Button variant="ghost" onClick={() => setStep("audience")} disabled={busy}>
              Back
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => finish(false)} disabled={busy}>
                Save as draft
              </Button>
              <Button variant="primary" onClick={() => finish(true)} disabled={busy || recipients.length === 0}>
                {busy ? "Sending…" : `Confirm & send to ${recipients.length}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function AudienceOption({
  checked,
  onChange,
  label,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  children?: ReactNode;
}) {
  return (
    <div className={`rounded-lg border p-3 ${checked ? "border-accent bg-surface" : "border-border"}`}>
      <label className="flex cursor-pointer items-center gap-2">
        <input type="radio" name="audience" checked={checked} onChange={onChange} />
        <span className="font-medium">{label}</span>
      </label>
      {children && <div className="mt-2 pl-6">{children}</div>}
    </div>
  );
}
