"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import { NotAvailableState } from "./not-available-state";
import { ChartSkeleton } from "./chart-wrapper";
import { useIndexerTopN } from "@/lib/hooks";
import { useNetwork } from "@/lib/providers";
import { formatCompactNumber, truncateHash } from "@/lib/utils";
import { exportTopNCSV, exportTopNJSON } from "@/lib/utils/analytics-export";
import { useTranslations } from "next-intl";
import type { TopNMetric, TimeWindow, TopNEntry } from "@/lib/indexer";
import type { LucideIcon } from "lucide-react";

interface TopNTableProps {
  metric: TopNMetric;
  title: string;
  icon: LucideIcon;
  window: TimeWindow;
  limit?: number;
}

const RANK_COLORS = [
  "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  "bg-gray-400/15 text-gray-400 border-gray-400/30",
  "bg-amber-600/15 text-amber-600 border-amber-600/30",
];

function RankBadge({ rank }: { rank: number }) {
  return (
    <Badge
      variant="outline"
      className={`size-7 justify-center p-0 text-xs tabular-nums ${RANK_COLORS[rank - 1] ?? "border-muted-foreground/30 text-muted-foreground"}`}
    >
      {rank}
    </Badge>
  );
}

export default function TopNTable({
  metric,
  title,
  icon: Icon,
  window,
  limit = 10,
}: TopNTableProps) {
  const t = useTranslations("analytics");
  const { network } = useNetwork();
  const { data: result, isLoading } = useIndexerTopN(metric, window, limit);

  const isAvailable = result?.available === true;
  const entries: TopNEntry[] = isAvailable ? result.data.data : [];

  const handleExport = (format: "csv" | "json") => {
    if (format === "csv") {
      exportTopNCSV(entries, metric, network);
    } else {
      exportTopNJSON(entries, metric, network);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="bg-primary/10 flex size-7 items-center justify-center rounded-lg">
            <Icon className="text-primary size-3.5" />
          </div>
          {title}
        </CardTitle>
        {isAvailable && entries.length > 0 && (
          <div className="flex gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => handleExport("json")}
              title={t("export.json")}
            >
              <Download className="size-3.5" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ChartSkeleton height={200} />
        ) : !isAvailable ? (
          <NotAvailableState height={200} />
        ) : (
          <div className="space-y-2">
            {entries.map((entry, i) => (
              <div
                key={entry.id}
                className="bg-muted/30 hover:bg-muted/50 flex items-center justify-between rounded-lg p-3 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <RankBadge rank={i + 1} />
                  <div>
                    <p className="text-sm font-medium">{entry.label}</p>
                    <p className="text-muted-foreground font-mono text-xs">
                      {truncateHash(entry.id)}
                    </p>
                  </div>
                </div>
                <p className="font-mono text-sm font-semibold tabular-nums">
                  {formatCompactNumber(entry.value)}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
