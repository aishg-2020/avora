"use client";

import { useMemo, useRef, useState } from "react";

import { Button, Modal, inputClassName } from "@/components/ui";
import { parseBoolean, parseCsv, splitTags } from "@/lib/csv";
import type { GuestImportRow } from "@/services/types";
import type { Side } from "@/lib/types";
import { CURRENT_EVENT_ID, getServices } from "@/services";

type TargetField = "ignore" | "name" | "phone" | "international" | "family" | "side" | "tags";

const TARGET_LABELS: Record<TargetField, string> = {
  ignore: "Ignore this column",
  name: "Guest name",
  phone: "Phone",
  international: "International? (yes/no)",
  family: "Family / party name",
  side: "Side (bride/groom/common)",
  tags: "Tags",
};

const AUTO_MAP: { pattern: RegExp; field: TargetField }[] = [
  { pattern: /^(guest)?name$/i, field: "name" },
  { pattern: /phone|mobile|contact/i, field: "phone" },
  { pattern: /international|nri|overseas/i, field: "international" },
  { pattern: /family|party|household/i, field: "family" },
  { pattern: /side/i, field: "side" },
  { pattern: /tags?/i, field: "tags" },
];

function guessField(header: string): TargetField {
  const found = AUTO_MAP.find(({ pattern }) => pattern.test(header));
  return found?.field ?? "ignore";
}

function toSide(value: string | undefined): Side {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "bride" || v === "groom" || v === "common") return v;
  return "common";
}

type Step = "upload" | "map" | "preview" | "done";

interface PreviewRow {
  index: number;
  row: GuestImportRow;
  error?: string;
}

export function ImportCsvModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, TargetField>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ guestsCreated: number; partiesCreated: number; errors: { row: number; message: string }[] } | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("upload");
    setFileName("");
    setHeaders([]);
    setRawRows([]);
    setMapping({});
    setResult(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function loadCsvText(text: string, name: string) {
    const parsed = parseCsv(text);
    if (parsed.headers.length === 0) {
      setFileName("");
      return;
    }
    setFileName(name);
    setHeaders(parsed.headers);
    setRawRows(parsed.rows);
    const nextMapping: Record<number, TargetField> = {};
    parsed.headers.forEach((h, i) => {
      nextMapping[i] = guessField(h);
    });
    setMapping(nextMapping);
    setStep("map");
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => loadCsvText(String(reader.result ?? ""), file.name);
    reader.readAsText(file);
  }

  function handlePaste(text: string) {
    loadCsvText(text, "Pasted data");
  }

  const previewRows: PreviewRow[] = useMemo(() => {
    const nameIdx = Object.entries(mapping).find(([, f]) => f === "name")?.[0];
    const phoneIdx = Object.entries(mapping).find(([, f]) => f === "phone")?.[0];
    const intlIdx = Object.entries(mapping).find(([, f]) => f === "international")?.[0];
    const familyIdx = Object.entries(mapping).find(([, f]) => f === "family")?.[0];
    const sideIdx = Object.entries(mapping).find(([, f]) => f === "side")?.[0];
    const tagsIdx = Object.entries(mapping).find(([, f]) => f === "tags")?.[0];

    return rawRows.map((cols, i) => {
      const name = nameIdx !== undefined ? (cols[Number(nameIdx)] ?? "").trim() : "";
      const phone = phoneIdx !== undefined ? (cols[Number(phoneIdx)] ?? "").trim() : "";
      const row: GuestImportRow = {
        name,
        phone,
        isInternational: intlIdx !== undefined ? parseBoolean(cols[Number(intlIdx)]) : false,
        familyName: familyIdx !== undefined ? (cols[Number(familyIdx)] ?? "").trim() || "Unassigned" : "Unassigned",
        side: sideIdx !== undefined ? toSide(cols[Number(sideIdx)]) : "common",
        tags: tagsIdx !== undefined ? splitTags(cols[Number(tagsIdx)]) : [],
      };
      const error = !name || !phone ? "Missing name or phone" : undefined;
      return { index: i, row, error };
    });
  }, [rawRows, mapping]);

  const validRows = previewRows.filter((r) => !r.error);
  const invalidRows = previewRows.filter((r) => r.error);

  async function commitImport() {
    setImporting(true);
    try {
      const res = await getServices().guests.importGuests(
        CURRENT_EVENT_ID,
        validRows.map((r) => r.row),
      );
      setResult(res);
      setStep("done");
      onImported();
    } finally {
      setImporting(false);
    }
  }

  const nameMapped = Object.values(mapping).includes("name");
  const phoneMapped = Object.values(mapping).includes("phone");

  return (
    <Modal open={open} onClose={handleClose} title="Import guests from CSV" wide>
      {step === "upload" && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Upload a CSV exported from Excel/Sheets, or paste rows below. The first row must be a header row.
          </p>
          <div
            className="rounded-xl border border-dashed border-border p-6 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
          >
            <p className="mb-3 text-sm text-muted">Drag a .csv file here, or</p>
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose file
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer text-muted">Or paste CSV text</summary>
            <textarea
              className={`${inputClassName} mt-2 h-32 font-mono text-xs`}
              placeholder={"name,phone,family,side,tags,international\nRajesh Sharma,+91 98290 11111,Sharma Family,bride,VIP,no"}
              onBlur={(e) => {
                if (e.target.value.trim()) handlePaste(e.target.value);
              }}
            />
          </details>
        </div>
      )}

      {step === "map" && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {fileName && <span className="font-medium text-foreground">{fileName}</span>} · {rawRows.length} row
            {rawRows.length === 1 ? "" : "s"} found. Map each column to a guest field.
          </p>
          <div className="max-h-80 overflow-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">CSV column</th>
                  <th className="px-3 py-2 font-medium">Sample</th>
                  <th className="px-3 py-2 font-medium">Maps to</th>
                </tr>
              </thead>
              <tbody>
                {headers.map((h, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{h || `Column ${i + 1}`}</td>
                    <td className="px-3 py-2 text-muted">{rawRows[0]?.[i] ?? "—"}</td>
                    <td className="px-3 py-2">
                      <select
                        className={inputClassName}
                        value={mapping[i] ?? "ignore"}
                        onChange={(e) => setMapping((m) => ({ ...m, [i]: e.target.value as TargetField }))}
                      >
                        {Object.entries(TARGET_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!(nameMapped && phoneMapped) && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Map at least “Guest name” and “Phone” to continue.
            </p>
          )}
          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={reset}>
              Back
            </Button>
            <Button variant="primary" disabled={!(nameMapped && phoneMapped)} onClick={() => setStep("preview")}>
              Preview import
            </Button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {validRows.length} guest{validRows.length === 1 ? "" : "s"} ready to import
            {invalidRows.length > 0 && `, ${invalidRows.length} row${invalidRows.length === 1 ? "" : "s"} will be skipped`}.
          </p>
          <div className="max-h-96 overflow-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Phone</th>
                  <th className="px-3 py-2 font-medium">Family</th>
                  <th className="px-3 py-2 font-medium">Side</th>
                  <th className="px-3 py-2 font-medium">Tags</th>
                  <th className="px-3 py-2 font-medium">Intl</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r) => (
                  <tr key={r.index} className={`border-t border-border ${r.error ? "bg-rose-50 dark:bg-rose-950/30" : ""}`}>
                    <td className="px-3 py-2">{r.index + 1}</td>
                    <td className="px-3 py-2">{r.row.name || "—"}</td>
                    <td className="px-3 py-2">{r.row.phone || "—"}</td>
                    <td className="px-3 py-2">{r.row.familyName}</td>
                    <td className="px-3 py-2 capitalize">{r.row.side}</td>
                    <td className="px-3 py-2">{r.row.tags.join(", ") || "—"}</td>
                    <td className="px-3 py-2">{r.row.isInternational ? "Yes" : "No"}</td>
                    <td className="px-3 py-2">
                      {r.error ? (
                        <span className="text-rose-600 dark:text-rose-400">{r.error}</span>
                      ) : (
                        <span className="text-emerald-700 dark:text-emerald-400">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep("map")}>
              Back
            </Button>
            <Button variant="primary" disabled={validRows.length === 0 || importing} onClick={commitImport}>
              {importing ? "Importing…" : `Import ${validRows.length} guest${validRows.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="space-y-4">
          <p className="text-sm">
            Imported <strong>{result.guestsCreated}</strong> guest{result.guestsCreated === 1 ? "" : "s"}
            {result.partiesCreated > 0 && (
              <>
                {" "}
                and created <strong>{result.partiesCreated}</strong> new famil{result.partiesCreated === 1 ? "y" : "ies"}
              </>
            )}
            .
          </p>
          {result.errors.length > 0 && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Skipped {result.errors.length} row{result.errors.length === 1 ? "" : "s"} with missing data.
            </p>
          )}
          <div className="flex justify-end pt-2">
            <Button variant="primary" onClick={handleClose}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
