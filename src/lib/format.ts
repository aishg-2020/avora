const IST = "Asia/Kolkata";

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    timeZone: IST,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { timeZone: IST, day: "numeric", month: "short", year: "numeric" });

export const formatINR = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount);

export const humanize = (value: string) => value.replace(/_/g, " ");

/** "+91 98290 11111" → "+91 XXXXX X1111": keeps the country code and the
 * last four digits, masks everything else, preserves spacing. */
export const maskPhone = (phone: string) => {
  const trimmed = phone.trim();
  const match = trimmed.match(/^(\+\d{1,3})(.*)$/);
  const country = match ? match[1] : "";
  const rest = match ? match[2] : trimmed;
  const digits = rest.replace(/\D/g, "");
  const keep = Math.min(4, digits.length);
  let seen = 0;
  const masked = rest.replace(/\d/g, () => (++seen > digits.length - keep ? digits[seen - 1] : "X"));
  return `${country}${masked}`;
};

/** Masks all but the last four characters of an ID number. Input that is
 * already masked (contains X's) is left alone so re-saving is idempotent. */
export const maskIdNumber = (value: string) => {
  const trimmed = value.trim();
  if (/X/.test(trimmed)) return trimmed;
  const chars = trimmed.replace(/\s/g, "");
  const keep = Math.min(4, chars.length);
  let seen = 0;
  return trimmed.replace(/\S/g, (c) => (++seen > chars.length - keep ? c : "X"));
};

// All event times are entered, stored and shown in the event's zone (IST for
// now) so a planner in London sees the same "7:00 pm Pheras" as one in
// Jaipur. Inputs are therefore anchored to IST rather than the browser zone.
const IST_OFFSET = "+05:30";

/** ISO datetime → value for `<input type="datetime-local">`, in IST. */
export const toDateTimeLocal = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
};

/** `<input type="datetime-local">` value (read as IST) → ISO datetime with
 * an explicit +05:30 offset, matching the seed data. Returns "" if invalid. */
export const fromDateTimeLocal = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return "";
  const iso = `${value}:00${IST_OFFSET}`;
  return Number.isNaN(new Date(iso).getTime()) ? "" : iso;
};
