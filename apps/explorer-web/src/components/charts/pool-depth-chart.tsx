"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Waves } from "lucide-react";
import { useTranslations } from "next-intl";
import { ChartWrapper } from "./chart-wrapper";
import { NotAvailableState } from "./not-available-state";
import { chartColors, chartAxisStyle, chartGridStyle } from "./chart-config";
import { usePoolDepth } from "@/lib/hooks";
import { formatCompactNumber } from "@/lib/utils";
import type { CandleResolution, PoolReserve } from "@/lib/indexer";

interface PoolDepthChartProps {
  poolId: string;
  resolution: CandleResolution;
  from: string;
  to: string;
  height?: number;
}

interface DepthDatum {
  timestamp: string;
  tvl: number;
  reserves: PoolReserve[];
}

function formatTimestamp(timestamp: string, resolution: CandleResolution): string {
  const date = new Date(timestamp);
  if (resolution === "1m" || resolution === "1h") {
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function reserveLabel(asset: string): string {
  return asset === "native" ? "XLM" : asset.split(":")[0];
}

interface DepthTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: DepthDatum }>;
}

function DepthTooltip({ active, payload }: DepthTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const date = new Date(point.timestamp);
  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="border-border bg-popover rounded-lg border px-3 py-2 shadow-lg">
      <p className="text-muted-foreground mb-1 text-xs">{dateStr}</p>
      <div className="space-y-0.5 text-xs">
        {point.reserves.map((r) => (
          <div key={r.asset} className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{reserveLabel(r.asset)}</span>
            <span className="text-foreground font-mono">{formatCompactNumber(r.amount)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 pt-0.5 font-medium">
          <span className="text-muted-foreground">TVL</span>
          <span className="text-foreground font-mono">{formatCompactNumber(point.tvl)}</span>
        </div>
      </div>
    </div>
  );
}

export function PoolDepthChart({
  poolId,
  resolution,
  from,
  to,
  height = 280,
}: PoolDepthChartProps) {
  const t = useTranslations("liquidityPool");
  const { data: result, isLoading } = usePoolDepth(poolId, resolution, from, to);

  const isAvailable = result?.available === true;
  const depth: DepthDatum[] = useMemo(() => {
    if (!result || !result.available) return [];
    return result.data.data.map((d) => ({
      timestamp: d.timestamp,
      tvl: d.tvl,
      reserves: d.reserves,
    }));
  }, [result]);

  return (
    <ChartWrapper title={t("depthChart")} icon={Waves} loading={isLoading}>
      {!isAvailable && !isLoading ? (
        <NotAvailableState
          height={height}
          title={t("notAvailable.title")}
          description={t("notAvailable.description")}
        />
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={depth} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="poolDepthFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColors.primary} stopOpacity={0.35} />
                <stop offset="95%" stopColor={chartColors.primary} stopOpacity={0} />
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
              domain={["auto", "auto"]}
              tickFormatter={(v: number) => formatCompactNumber(v)}
            />
            <Tooltip content={<DepthTooltip />} />
            <Area
              type="monotone"
              dataKey="tvl"
              stroke={chartColors.primary}
              strokeWidth={2}
              fill="url(#poolDepthFill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartWrapper>
  );
}
