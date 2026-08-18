"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Download,
  Activity,
  Layers,
  ArrowLeftRight,
  Calculator,
  Shield,
  LineChart,
  Wallet,
  Coins,
  UserPlus,
  Users,
  Package,
  Trophy,
  ArrowRightLeft,
} from "lucide-react";
import { DashboardCharts } from "@/components/charts";
import { NetworkStatsCard } from "@/components/stats";
import { useLatestLedger, useRecentTransactions } from "@/lib/hooks";
import { useAnalyticsMode, useNetwork } from "@/lib/providers";
import { cn, formatCompactNumber } from "@/lib/utils";

import {
  ResolutionPicker,
  DateRangePicker,
  WindowPicker,
  rangePresetToISO,
} from "@/components/charts";
import type { DateRangePreset } from "@/components/charts";
import TimeSeriesChart from "@/components/charts/time-series-chart";
import TopNTable from "@/components/charts/top-n-table";
import { chartColors } from "@/components/charts/chart-config";
import type { Resolution, TimeWindow } from "@/lib/indexer";

// Statistical calculation functions
function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = calculateMean(values);
  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
  return Math.sqrt(calculateMean(squaredDiffs));
}

function calculateMin(values: number[]): number {
  return values.length > 0 ? Math.min(...values) : 0;
}

function calculateMax(values: number[]): number {
  return values.length > 0 ? Math.max(...values) : 0;
}

interface StatisticCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: number;
  className?: string;
}

function StatisticCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className,
}: StatisticCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium">{title}</p>
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="bg-primary/10 rounded-lg p-2">
              <Icon className="text-primary size-4" />
            </div>
            {trend !== undefined && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px]",
                  trend >= 0
                    ? "border-green-500/30 text-green-500"
                    : "border-red-500/30 text-red-500"
                )}
              >
                {trend >= 0 ? (
                  <TrendingUp className="mr-1 size-3" />
                ) : (
                  <TrendingDown className="mr-1 size-3" />
                )}
                {Math.abs(trend).toFixed(2)}%
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface StatisticsTableProps {
  title: string;
  data: {
    label: string;
    value: string | number;
    description?: string;
  }[];
}

function StatisticsTable({ title, data }: StatisticsTableProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="text-primary size-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.map((item, i) => (
            <div key={i} className="bg-muted/30 flex items-center justify-between rounded-lg p-3">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                {item.description && (
                  <p className="text-muted-foreground text-xs">{item.description}</p>
                )}
              </div>
              <p className="font-mono text-sm font-semibold tabular-nums">{item.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const t = useTranslations("analytics");
  const { isAnalyticsMode, settings } = useAnalyticsMode();
  const { network } = useNetwork();

  // State for History and Top N tabs
  const [resolution, setResolution] = useState<Resolution>("daily");
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>("30d");
  const [topNWindow, setTopNWindow] = useState<TimeWindow>("7d");

  const dateRange = useMemo(() => rangePresetToISO(dateRangePreset), [dateRangePreset]);

  // Fetch data
  const { data: latestLedger, isLoading: ledgerLoading } = useLatestLedger();
  const { data: recentTxs, isLoading: txLoading } = useRecentTransactions(100);

  // Calculate transaction statistics
  const txStats = useMemo(() => {
    if (!recentTxs?.records) return null;

    const txs = recentTxs.records;
    const opCounts = txs.map((tx) => tx.operation_count);
    const fees = txs.map((tx) => Number(tx.fee_charged));
    const successCount = txs.filter((tx) => tx.successful).length;

    return {
      total: txs.length,
      successful: successCount,
      failed: txs.length - successCount,
      successRate: (successCount / txs.length) * 100,
      operations: {
        mean: calculateMean(opCounts),
        median: calculateMedian(opCounts),
        stdDev: calculateStdDev(opCounts),
        min: calculateMin(opCounts),
        max: calculateMax(opCounts),
        total: opCounts.reduce((sum, val) => sum + val, 0),
      },
      fees: {
        mean: calculateMean(fees),
        median: calculateMedian(fees),
        stdDev: calculateStdDev(fees),
        min: calculateMin(fees),
        max: calculateMax(fees),
      },
    };
  }, [recentTxs]);

  // Export data function
  const exportData = (format: "json" | "csv") => {
    if (!txStats) return;

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      network,
      transactionStats: txStats,
      latestLedger: latestLedger
        ? {
            sequence: latestLedger.sequence,
            closedAt: latestLedger.closed_at,
            txCount: latestLedger.successful_transaction_count,
            operationCount: latestLedger.operation_count,
            protocolVersion: latestLedger.protocol_version,
          }
        : null,
    };

    let content: string;
    let mimeType: string;
    let filename: string;

    if (format === "json") {
      content = JSON.stringify(exportPayload, null, 2);
      mimeType = "application/json";
      filename = `stellar-analytics-${network}.json`;
    } else {
      // CSV format
      const lines: string[] = [
        "Category,Metric,Value",
        `Network,Name,${network}`,
        `Network,Latest Ledger,${latestLedger?.sequence ?? "N/A"}`,
        `Network,Ledger TX Count,${latestLedger?.successful_transaction_count ?? "N/A"}`,
        `Network,Ledger Operations,${latestLedger?.operation_count ?? "N/A"}`,
        `Network,Protocol Version,${latestLedger?.protocol_version ?? "N/A"}`,
        `Transactions,Sample Size,${txStats.total}`,
        `Transactions,Success Rate,${txStats.successRate.toFixed(2)}%`,
        `Transactions,Successful,${txStats.successful}`,
        `Transactions,Failed,${txStats.failed}`,
        `Operations,Mean per TX,${txStats.operations.mean.toFixed(2)}`,
        `Operations,Median per TX,${txStats.operations.median}`,
        `Operations,Std Dev,${txStats.operations.stdDev.toFixed(2)}`,
        `Operations,Min,${txStats.operations.min}`,
        `Operations,Max,${txStats.operations.max}`,
        `Fees,Mean (stroops),${txStats.fees.mean.toFixed(0)}`,
        `Fees,Median (stroops),${txStats.fees.median}`,
        `Fees,Min (stroops),${txStats.fees.min}`,
        `Fees,Max (stroops),${txStats.fees.max}`,
      ];
      content = lines.join("\n");
      mimeType = "text/csv";
      filename = `stellar-analytics-${network}.csv`;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isLoading = ledgerLoading || txLoading;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold">
            <div className="bg-primary/10 rounded-lg p-2">
              <BarChart3 className="text-primary size-6" />
            </div>
            {t("title")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Export buttons */}
          {settings.enableDataExport && (
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportData("json")}
                disabled={isLoading}
              >
                <Download className="mr-1 size-4" />
                JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportData("csv")}
                disabled={isLoading}
              >
                <Download className="mr-1 size-4" />
                CSV
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Analytics Mode Banner */}
      {!isAnalyticsMode && (
        <Card className="border-chart-2/30 bg-chart-2/5">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="bg-chart-2/10 rounded-lg p-2">
              <BarChart3 className="text-chart-2 size-5" />
            </div>
            <div className="flex-1">
              <p className="font-medium">{t("enableBanner.title")}</p>
              <p className="text-muted-foreground text-sm">{t("enableBanner.description")}</p>
            </div>
            <Badge variant="outline" className="border-chart-2/30 text-chart-2">
              PRO
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">{t("keyMetrics")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatisticCard
            title={t("metrics.latestLedger")}
            value={latestLedger ? `#${latestLedger.sequence.toLocaleString()}` : "-"}
            icon={Layers}
          />
          <StatisticCard
            title={t("metrics.ledgerTxCount")}
            value={latestLedger ? latestLedger.successful_transaction_count : "-"}
            icon={ArrowLeftRight}
          />
          <StatisticCard
            title={t("metrics.ledgerOperations")}
            value={latestLedger ? latestLedger.operation_count : "-"}
            icon={Activity}
          />
          <StatisticCard
            title={t("metrics.protocolVersion")}
            value={latestLedger ? `v${latestLedger.protocol_version}` : "-"}
            icon={Shield}
          />
        </div>
      </section>

      {/* Tabs for different analytics views */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="overview">{t("tabs.overview")}</TabsTrigger>
          <TabsTrigger value="history">{t("tabs.history")}</TabsTrigger>
          <TabsTrigger value="top-n">{t("tabs.topN")}</TabsTrigger>
          <TabsTrigger value="transactions">{t("tabs.transactions")}</TabsTrigger>
          <TabsTrigger value="network">{t("tabs.network")}</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <DashboardCharts />

          {isAnalyticsMode && settings.showStatistics && txStats && (
            <div className="grid gap-4 md:grid-cols-2">
              <StatisticsTable
                title={t("statistics.operationsPerTx")}
                data={[
                  { label: t("stats.mean"), value: txStats.operations.mean.toFixed(2) },
                  { label: t("stats.median"), value: txStats.operations.median },
                  { label: t("stats.stdDev"), value: txStats.operations.stdDev.toFixed(2) },
                  { label: t("stats.min"), value: txStats.operations.min },
                  { label: t("stats.max"), value: txStats.operations.max },
                  { label: t("stats.total"), value: txStats.operations.total },
                ]}
              />
              <StatisticsTable
                title={t("statistics.feesStroops")}
                data={[
                  { label: t("stats.mean"), value: formatCompactNumber(txStats.fees.mean) },
                  { label: t("stats.median"), value: formatCompactNumber(txStats.fees.median) },
                  { label: t("stats.stdDev"), value: formatCompactNumber(txStats.fees.stdDev) },
                  { label: t("stats.min"), value: formatCompactNumber(txStats.fees.min) },
                  { label: t("stats.max"), value: formatCompactNumber(txStats.fees.max) },
                ]}
              />
            </div>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">{t("tabs.history")}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <ResolutionPicker value={resolution} onChange={setResolution} />
              <DateRangePicker value={dateRangePreset} onChange={setDateRangePreset} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <TimeSeriesChart
              metric="tx_volume"
              title={t("metrics.txVolume")}
              icon={LineChart}
              color={chartColors.primary}
              resolution={resolution}
              from={dateRange.from}
              to={dateRange.to}
            />
            <TimeSeriesChart
              metric="active_accounts"
              title={t("metrics.activeAccounts")}
              icon={Users}
              color={chartColors.success}
              resolution={resolution}
              from={dateRange.from}
              to={dateRange.to}
            />
            <TimeSeriesChart
              metric="fee_classic"
              title={t("metrics.classicFees")}
              icon={Wallet}
              color={chartColors.warning}
              unit="XLM"
              resolution={resolution}
              from={dateRange.from}
              to={dateRange.to}
            />
            <TimeSeriesChart
              metric="fee_soroban"
              title={t("metrics.sorobanFees")}
              icon={Coins}
              color={chartColors.purple}
              unit="XLM"
              resolution={resolution}
              from={dateRange.from}
              to={dateRange.to}
            />
            <TimeSeriesChart
              metric="new_accounts"
              title={t("metrics.newAccounts")}
              icon={UserPlus}
              color={chartColors.red}
              resolution={resolution}
              from={dateRange.from}
              to={dateRange.to}
            />
            <TimeSeriesChart
              metric="asset_supply"
              title={t("metrics.assetSupply")}
              icon={Package}
              color={chartColors.primary}
              resolution={resolution}
              from={dateRange.from}
              to={dateRange.to}
            />
          </div>
        </TabsContent>

        {/* Top N Tab */}
        <TabsContent value="top-n" className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">{t("tabs.topN")}</h2>
            <WindowPicker value={topNWindow} onChange={setTopNWindow} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <TopNTable
              metric="contract_activity"
              title={t("topN.contracts")}
              icon={Trophy}
              window={topNWindow}
              limit={10}
            />
            <TopNTable
              metric="asset_transfers"
              title={t("topN.assets")}
              icon={ArrowRightLeft}
              window={topNWindow}
              limit={10}
            />
            <TopNTable
              metric="highest_fees"
              title={t("topN.highestFees")}
              icon={Wallet}
              window={topNWindow}
              limit={10}
            />
          </div>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-6">
          {txStats && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatisticCard
                  title={t("tx.sampleSize")}
                  value={txStats.total}
                  subtitle={t("tx.recentTransactions")}
                  icon={Activity}
                />
                <StatisticCard
                  title={t("tx.successRate")}
                  value={`${txStats.successRate.toFixed(1)}%`}
                  icon={TrendingUp}
                  trend={txStats.successRate - 95} // Compare to 95% baseline
                />
                <StatisticCard
                  title={t("tx.successful")}
                  value={txStats.successful}
                  icon={Activity}
                />
                <StatisticCard title={t("tx.failed")} value={txStats.failed} icon={TrendingDown} />
              </div>

              {isAnalyticsMode && settings.showStatistics && (
                <div className="grid gap-4 md:grid-cols-3">
                  <StatisticsTable
                    title={t("statistics.operationsPerTx")}
                    data={[
                      { label: t("stats.mean"), value: txStats.operations.mean.toFixed(2) },
                      { label: t("stats.median"), value: txStats.operations.median },
                      { label: t("stats.stdDev"), value: txStats.operations.stdDev.toFixed(2) },
                      {
                        label: t("stats.range"),
                        value: `${txStats.operations.min} - ${txStats.operations.max}`,
                      },
                    ]}
                  />
                  <StatisticsTable
                    title={t("statistics.feesStroops")}
                    data={[
                      { label: t("stats.mean"), value: formatCompactNumber(txStats.fees.mean) },
                      { label: t("stats.median"), value: formatCompactNumber(txStats.fees.median) },
                      { label: t("stats.stdDev"), value: formatCompactNumber(txStats.fees.stdDev) },
                      {
                        label: t("stats.range"),
                        value: `${txStats.fees.min} - ${formatCompactNumber(txStats.fees.max)}`,
                      },
                    ]}
                  />
                  <StatisticsTable
                    title={t("statistics.summary")}
                    data={[
                      { label: t("tx.totalOperations"), value: txStats.operations.total },
                      { label: t("tx.avgOpsPerTx"), value: txStats.operations.mean.toFixed(2) },
                      { label: t("tx.successRate"), value: `${txStats.successRate.toFixed(2)}%` },
                    ]}
                  />
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Network Tab */}
        <TabsContent value="network" className="space-y-6">
          <NetworkStatsCard />

          {latestLedger && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Layers className="text-primary size-4" />
                  {t("network.latestLedger")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs">{t("network.sequence")}</p>
                    <p className="font-mono text-lg font-bold">
                      #{latestLedger.sequence.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs">{t("network.transactions")}</p>
                    <p className="text-lg font-bold">{latestLedger.successful_transaction_count}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs">{t("network.operations")}</p>
                    <p className="text-lg font-bold">{latestLedger.operation_count}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs">{t("network.protocolVersion")}</p>
                    <p className="text-lg font-bold">v{latestLedger.protocol_version}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
