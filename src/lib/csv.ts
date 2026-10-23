// Tiny dependency-free CSV parser used by the guest CSV import wizard.
// Handles quoted fields (", "" escaping), commas inside quotes, and
// CRLF/LF line endings. Good enough for the "export from Excel/Sheets"
// files a wedding planner would actually upload — not a full RFC 4180
// implementation.

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

export function parseCsv(text: string): ParsedCsv {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  // Normalize CRLF to LF up front so the loop only has to deal with \n.
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      pushField();
    } else if (char === "\n") {
      pushRow();
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) pushRow();

  // Drop blank trailing/stray lines (e.g. a final newline in the file).
  const cleaned = rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ""));

  const [headers = [], ...dataRows] = cleaned;
  return { headers: headers.map((h) => h.trim()), rows: dataRows };
}

export function splitTags(value: string | undefined): string[] {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(/[;,]/)
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  );
}

export function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  return ["yes", "y", "true", "1", "international"].includes(value.trim().toLowerCase());
}

// ---------------------------------------------------------------------------
// Export side: build a CSV string and trigger a download entirely in the
// browser (Blob + object URL), no server round-trip.
// ---------------------------------------------------------------------------

export type CsvCell = string | number | boolean | null | undefined;

const escapeCell = (value: CsvCell): string => {
  if (value === null || value === undefined) return "";
  const text = typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(escapeCell).join(","));
  // BOM so Excel opens UTF-8 (₹, names with accents) correctly.
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function downloadCsv(filename: string, headers: string[], rows: CsvCell[][]) {
  const blob = new Blob([toCsv(headers, rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
