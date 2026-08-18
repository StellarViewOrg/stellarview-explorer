import type { TimeSeriesDataPoint, TopNEntry } from "@/lib/indexer";

/**
 * Trigger a file download in the browser.
 */
function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export time-series data as JSON.
 */
export function exportTimeSeriesJSON(
  data: TimeSeriesDataPoint[],
  metric: string,
  network: string
): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    network,
    metric,
    points: data.length,
    data,
  };
  triggerDownload(
    JSON.stringify(payload, null, 2),
    `stellar-${metric}-${network}.json`,
    "application/json"
  );
}

/**
 * Export time-series data as CSV.
 */
export function exportTimeSeriesCSV(
  data: TimeSeriesDataPoint[],
  metric: string,
  network: string
): void {
  const header = "Timestamp,Value";
  const rows = data.map((d) => `${d.timestamp},${d.value}`);
  triggerDownload(
    [header, ...rows].join("\n"),
    `stellar-${metric}-${network}.csv`,
    "text/csv"
  );
}

/**
 * Export Top-N data as JSON.
 */
export function exportTopNJSON(data: TopNEntry[], metric: string, network: string): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    network,
    metric,
    entries: data.length,
    data,
  };
  triggerDownload(
    JSON.stringify(payload, null, 2),
    `stellar-top-${metric}-${network}.json`,
    "application/json"
  );
}

/**
 * Export Top-N data as CSV.
 */
export function exportTopNCSV(data: TopNEntry[], metric: string, network: string): void {
  const header = "Rank,ID,Label,Value";
  const rows = data.map((d, i) => `${i + 1},${d.id},${escapeCsv(d.label)},${d.value}`);
  triggerDownload(
    [header, ...rows].join("\n"),
    `stellar-top-${metric}-${network}.csv`,
    "text/csv"
  );
}

/** Escape a value for safe CSV embedding. */
function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
