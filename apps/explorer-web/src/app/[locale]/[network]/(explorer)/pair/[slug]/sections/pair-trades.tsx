"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingCard } from "@/components/common/loading-card";
import { ErrorState } from "@/components/common/error-state";
import { EmptyState } from "@/components/common/empty-state";
import { usePairTrades } from "@/lib/hooks";
import { formatNumber, formatTimeAgo, cn } from "@/lib/utils";
import type { Horizon } from "@stellar/stellar-sdk";

interface PairTradesProps {
  baseCode: string;
  baseIssuer: string;
  counterCode: string;
  counterIssuer: string;
}

export function PairTrades({ baseCode, baseIssuer, counterCode, counterIssuer }: PairTradesProps) {
  const t = useTranslations("pair");
  const { data, isLoading, error, refetch } = usePairTrades(
    baseCode,
    baseIssuer,
    counterCode,
    counterIssuer
  );

  if (isLoading) return <LoadingCard rows={5} />;
  if (error) {
    return <ErrorState title={t("failedToLoadTrades")} message={error.message} onRetry={refetch} />;
  }
  if (!data?.records?.length) {
    return <EmptyState title={t("noTrades")} description={t("noTradesDesc")} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("recentTrades")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-muted-foreground mb-2 hidden grid-cols-4 gap-2 text-xs font-medium sm:grid">
          <span>{t("time")}</span>
          <span className="text-right">{t("price")}</span>
          <span className="text-right">{t("amountOf", { code: baseCode })}</span>
          <span className="text-right">{t("amountOf", { code: counterCode })}</span>
        </div>
        <div className="space-y-1">
          {data.records.map((trade: Horizon.ServerApi.TradeRecord) => {
            const price = trade.price
              ? parseFloat(trade.price.n) / parseFloat(trade.price.d)
              : null;
            const isBuy = !trade.base_is_seller;
            return (
              <div
                key={trade.id}
                className="grid grid-cols-2 gap-2 border-b py-1.5 text-xs last:border-0 sm:grid-cols-4"
              >
                <span className="text-muted-foreground">
                  {formatTimeAgo(trade.ledger_close_time)}
                </span>
                <span
                  className={cn(
                    "text-right font-mono",
                    isBuy ? "text-success" : "text-destructive"
                  )}
                >
                  {price !== null ? formatNumber(price, { maximumFractionDigits: 7 }) : "—"}
                </span>
                <span className="text-right font-mono">{formatNumber(trade.base_amount)}</span>
                <span className="text-right font-mono">{formatNumber(trade.counter_amount)}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
