"use client";

import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface NotAvailableStateProps {
  /** Height to match the chart area. */
  height?: number;
  className?: string;
}

/**
 * Empty state shown when a metric hasn't been aggregated by the indexer yet.
 * Used inside chart wrappers to maintain consistent layout while clearly
 * communicating that data will appear once the indexer ships real aggregates.
 */
export function NotAvailableState({ height = 180, className }: NotAvailableStateProps) {
  const t = useTranslations("analytics");

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg",
        "border-muted-foreground/20 bg-muted/10 border border-dashed",
        className
      )}
      style={{ height }}
    >
      <div className="bg-muted/30 rounded-full p-3">
        <AlertCircle className="text-muted-foreground size-5" />
      </div>
      <div className="text-center">
        <p className="text-muted-foreground text-sm font-medium">{t("notAvailable.title")}</p>
        <p className="text-muted-foreground/70 mt-1 max-w-[240px] text-xs">
          {t("notAvailable.description")}
        </p>
      </div>
    </div>
  );
}
