"use client";

import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartWrapper } from "./chart-wrapper";
import { NotAvailableState } from "./not-available-state";
import { chartColors, chartAxisStyle, chartGridStyle } from "./chart-config";
import { useIndexerTimeSeries } from "@/lib/hooks";
import { useNetwork } from "@/lib/providers";
import { formatCompactNumber } from "@/lib/utils";
import { exportTimeSeriesCSV, exportTimeSeriesJSON } from "@/lib/utils/analytics-export";
import { useTranslations } from "next-intl";
import type { TimeSeriesMetric, Resolution, TimeSeriesDataPoint } from "@/lib/indexer";
import type { LucideIcon } from "lucide-react";

interface TimeSeriesChartProps {
  metric: TimeSeriesMetric;
  title: string;
  icon: LucideIcon;
  color?: string;
  unit?: string;
  resolution: Resolution;
  from: string;
  to: string;
  height?: number;
}

function formatTimestamp(timestamp: string, resolution: Resolution): string {
  const date = new Date(timestamp);
  if (resolution === "hourly") {
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  if (resolution === "daily") {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: { timestamp: string } }>;
  resolution: Resolution;
  unit?: string;
}

function ChartTooltip({ active, payload, resolution, unit }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const ts = payload[0].payload.timestamp;
  const date = new Date(ts);
  const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const timeStr =
    resolution === "hourly"
      ? date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
      : "";

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="text-sm font-medium text-foreground">
        {formatCompactNumber(payload[0].value)}
        {unit && <span className="ml-1 text-xs text-muted-foreground">{unit}</span>}
      </p>
      <p className="text-xs text-muted-foreground">
        {dateStr} {timeStr}
      </p>
    </div>
  );
}

export default function TimeSeriesChart({
  metric,
  title,
  icon: Icon,
  color = chartColors.primary,
  unit,
  resolution,
  from,
  to,
  height = 220,
}: TimeSeriesChartProps) {
  const t = useTranslations("analytics");
  const { network } = useNetwork();
  const { data: result, isLoading } = useIndexerTimeSeries(metric, resolution, from, to);

  const isAvailable = result?.available === true;
  const seriesData: TimeSeriesDataPoint[] = isAvailable ? result.data.data : [];

  // Compute summary stat
  const summary = useMemo(() => {
    if (seriesData.length === 0) return null;
    const total = seriesData.reduce((sum, d) => sum + d.value, 0);
    const latest = seriesData[seriesData.length - 1].value;
    return { total, latest };
  }, [seriesData]);

  // Unique gradient ID per metric to avoid SVG collisions
  const gradientId = `ts-gradient-${metric}`;

  const handleExport = (format: "csv" | "json") => {
    if (format === "csv") {
      exportTimeSeriesCSV(seriesData, metric, network);
    } else {
      exportTimeSeriesJSON(seriesData, metric, network);
    }
  };

  return (
    <ChartWrapper
      title={title}
      icon={Icon}
      loading={isLoading}
      headerRight={
        isAvailable && seriesData.length > 0 ? (
          <div className="flex items-center gap-2">
            {summary && (
              <span className="text-sm font-bold tabular-nums" style={{ color }}>
                {formatCompactNumber(summary.latest)}
                {unit && <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>}
              </span>
            )}
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
          </div>
        ) : null
      }
    >
      {!isAvailable && !isLoading ? (
        <NotAvailableState height={height} />
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={seriesData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid {...chartGridStyle} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(ts: string) => formatTimestamp(ts, resolution)}
              {...chartAxisStyle}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={50}
            />
            <YAxis
              {...chartAxisStyle}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatCompactNumber(v)}
              domain={[0, "auto"]}
            />
            <Tooltip content={<ChartTooltip resolution={resolution} unit={unit} />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              animationDuration={300}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartWrapper>
  );
}
