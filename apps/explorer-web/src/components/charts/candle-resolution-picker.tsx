"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { CandleResolution } from "@/lib/indexer";

const CANDLE_RESOLUTIONS: CandleResolution[] = ["1m", "1h", "1d"];

interface CandleResolutionPickerProps {
  value: CandleResolution;
  onChange: (resolution: CandleResolution) => void;
  className?: string;
}

/** Resolution picker for indexer-backed candle/depth time series (1m/1h/1d buckets). */
export function CandleResolutionPicker({
  value,
  onChange,
  className,
}: CandleResolutionPickerProps) {
  const t = useTranslations("pair");

  return (
    <div className={cn("bg-muted/50 flex gap-1 rounded-lg p-1", className)}>
      {CANDLE_RESOLUTIONS.map((r) => (
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
