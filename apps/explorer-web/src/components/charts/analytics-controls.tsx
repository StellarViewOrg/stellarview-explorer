"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { Resolution, TimeWindow } from "@/lib/indexer";

// ── Resolution Picker ──────────────────────────────────────────────────

interface ResolutionPickerProps {
  value: Resolution;
  onChange: (resolution: Resolution) => void;
  className?: string;
}

const RESOLUTIONS: Resolution[] = ["hourly", "daily", "weekly"];

export function ResolutionPicker({ value, onChange, className }: ResolutionPickerProps) {
  const t = useTranslations("analytics");

  return (
    <div className={cn("flex gap-1 rounded-lg bg-muted/50 p-1", className)}>
      {RESOLUTIONS.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            value === r
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t(`resolution.${r}`)}
        </button>
      ))}
    </div>
  );
}

// ── Date Range Picker ──────────────────────────────────────────────────

export type DateRangePreset = "24h" | "7d" | "30d" | "90d" | "1y" | "all";

interface DateRangePickerProps {
  value: DateRangePreset;
  onChange: (range: DateRangePreset) => void;
  className?: string;
}

const RANGE_PRESETS: DateRangePreset[] = ["24h", "7d", "30d", "90d", "1y", "all"];

/** Convert a preset label to an ISO `from` date string. `to` is always "now". */
export function rangePresetToISO(preset: DateRangePreset): { from: string; to: string } {
  const to = new Date().toISOString();
  const now = Date.now();

  const MS: Record<DateRangePreset, number> = {
    "24h": 24 * 60 * 60_000,
    "7d": 7 * 24 * 60 * 60_000,
    "30d": 30 * 24 * 60 * 60_000,
    "90d": 90 * 24 * 60 * 60_000,
    "1y": 365 * 24 * 60 * 60_000,
    all: 10 * 365 * 24 * 60 * 60_000, // ~10 years back
  };

  return { from: new Date(now - MS[preset]).toISOString(), to };
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const t = useTranslations("analytics");

  return (
    <div className={cn("flex gap-1 rounded-lg bg-muted/50 p-1", className)}>
      {RANGE_PRESETS.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
            value === r
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t(`range.${r}`)}
        </button>
      ))}
    </div>
  );
}

// ── Top-N Window Picker ────────────────────────────────────────────────

interface WindowPickerProps {
  value: TimeWindow;
  onChange: (window: TimeWindow) => void;
  className?: string;
}

const WINDOWS: TimeWindow[] = ["24h", "7d", "30d"];

export function WindowPicker({ value, onChange, className }: WindowPickerProps) {
  const t = useTranslations("analytics");

  return (
    <div className={cn("flex gap-1 rounded-lg bg-muted/50 p-1", className)}>
      {WINDOWS.map((w) => (
        <button
          key={w}
          type="button"
          onClick={() => onChange(w)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            value === w
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t(`range.${w}`)}
        </button>
      ))}
    </div>
  );
}
