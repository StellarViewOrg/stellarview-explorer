"use client";

import { useMemo } from "react";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { CandlestickChart as CandlestickIcon } from "lucide-react";
import { ChartWrapper } from "./chart-wrapper";
import { NotAvailableState } from "./not-available-state";
import { chartColors, chartAxisStyle, chartGridStyle } from "./chart-config";
import { usePairCandles } from "@/lib/hooks";
import { formatNumber } from "@/lib/utils";
import { useTranslations } from "next-intl";
import type { Candle, CandleResolution } from "@/lib/indexer";

interface CandlestickChartProps {
  pairId: string;
  resolution: CandleResolution;
  from: string;
  to: string;
  height?: number;
}

interface CandleDatum extends Candle {
  range: [number, number];
}

function formatTimestamp(timestamp: string, resolution: CandleResolution): string {
  const date = new Date(timestamp);
  if (resolution === "1m" || resolution === "1h") {
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface CandleShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: CandleDatum;
}

/**
 * Renders one OHLC candle. Recharts gives us pixel `y`/`height` for the
 * `range` dataKey ([low, high]) already mapped through the Y axis scale, so
 * we derive the open/close pixel positions by interpolating within that
 * range rather than re-scaling manually.
 */
function CandleShape({ x = 0, y = 0, width = 0, height = 0, payload }: CandleShapeProps) {
  if (!payload) return null;
  const { open, close, high, low } = payload;

  const wickX = x + width / 2;
  const bodyWidth = Math.max(width * 0.6, 2);
  const bodyX = x + (width - bodyWidth) / 2;
  const isUp = close >= open;
  const color = isUp ? chartColors.success : chartColors.red;

  if (high === low) {
    const midY = y + height / 2;
    return <line x1={x} x2={x + width} y1={midY} y2={midY} stroke={color} strokeWidth={1} />;
  }

  const pxPerUnit = height / (high - low);
  const openY = y + (high - open) * pxPerUnit;
  const closeY = y + (high - close) * pxPerUnit;
  const bodyY = Math.min(openY, closeY);
  const bodyHeight = Math.max(Math.abs(closeY - openY), 1);

  return (
    <g>
      <line x1={wickX} x2={wickX} y1={y} y2={y + height} stroke={color} strokeWidth={1} />
      <rect x={bodyX} y={bodyY} width={bodyWidth} height={bodyHeight} fill={color} />
    </g>
  );
}

interface CandleTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: CandleDatum }>;
  resolution: CandleResolution;
}

function CandleTooltip({ active, payload, resolution }: CandleTooltipProps) {
  if (!active || !payload?.length) return null;
  const candle = payload[0].payload;
  const date = new Date(candle.timestamp);
  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeStr =
    resolution === "1d"
      ? ""
      : date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

  const fmt = (v: number) => formatNumber(v, { maximumFractionDigits: 7 });

  return (
    <div className="border-border bg-popover rounded-lg border px-3 py-2 shadow-lg">
      <p className="text-muted-foreground mb-1 text-xs">
        {dateStr} {timeStr}
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
        <span className="text-muted-foreground">O</span>
        <span className="text-foreground text-right font-mono">{fmt(candle.open)}</span>
        <span className="text-muted-foreground">H</span>
        <span className="text-foreground text-right font-mono">{fmt(candle.high)}</span>
        <span className="text-muted-foreground">L</span>
        <span className="text-foreground text-right font-mono">{fmt(candle.low)}</span>
        <span className="text-muted-foreground">C</span>
        <span className="text-foreground text-right font-mono">{fmt(candle.close)}</span>
      </div>
    </div>
  );
}

export default function CandlestickChart({
  pairId,
  resolution,
  from,
  to,
  height = 280,
}: CandlestickChartProps) {
  const t = useTranslations("pair");
  const { data: result, isLoading } = usePairCandles(pairId, resolution, from, to);

  const isAvailable = result?.available === true;
  const candles: CandleDatum[] = useMemo(() => {
    if (!result || !result.available) return [];
    return result.data.data.map((c) => ({ ...c, range: [c.low, c.high] as [number, number] }));
  }, [result]);

  return (
    <ChartWrapper title={t("candles")} icon={CandlestickIcon} loading={isLoading}>
      {!isAvailable && !isLoading ? (
        <NotAvailableState
          height={height}
          title={t("notAvailable.title")}
          description={t("notAvailable.description")}
        />
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={candles} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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
              tickFormatter={(v: number) => formatNumber(v, { maximumFractionDigits: 4 })}
            />
            <Tooltip content={<CandleTooltip resolution={resolution} />} />
            <Bar
              dataKey="range"
              shape={(props: CandleShapeProps) => <CandleShape {...props} />}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </ChartWrapper>
  );
}
