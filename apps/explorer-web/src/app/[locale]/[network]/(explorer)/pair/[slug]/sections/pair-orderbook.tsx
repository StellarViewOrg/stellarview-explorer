"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingCard } from "@/components/common/loading-card";
import { ErrorState } from "@/components/common/error-state";
import { EmptyState } from "@/components/common/empty-state";
import { usePairOrderbook } from "@/lib/hooks";
import { formatCompactNumber } from "@/lib/utils";

interface PairOrderbookProps {
  baseCode: string;
  baseIssuer: string;
  counterCode: string;
  counterIssuer: string;
}

export function PairOrderbook({
  baseCode,
  baseIssuer,
  counterCode,
  counterIssuer,
}: PairOrderbookProps) {
  const t = useTranslations("pair");
  const { data, isLoading, error, refetch } = usePairOrderbook(
    baseCode,
    baseIssuer,
    counterCode,
    counterIssuer
  );

  if (isLoading) return <LoadingCard rows={5} />;
  if (error) {
    return (
      <ErrorState title={t("failedToLoadOrderbook")} message={error.message} onRetry={refetch} />
    );
  }
  if (!data?.bids?.length && !data?.asks?.length) {
    return <EmptyState title={t("emptyOrderbook")} description={t("emptyOrderbookDesc")} />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {data.midPrice !== null && (
        <div className="col-span-full grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-xl font-semibold tabular-nums">
                {data.bestBid?.toFixed(7) ?? "—"}
              </div>
              <div className="text-muted-foreground mt-1 text-xs">{t("bestBid")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-xl font-semibold tabular-nums">
                {data.midPrice?.toFixed(7) ?? "—"}
              </div>
              <div className="text-muted-foreground mt-1 text-xs">{t("midPrice")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-xl font-semibold tabular-nums">
                {data.bestAsk?.toFixed(7) ?? "—"}
              </div>
              <div className="text-muted-foreground mt-1 text-xs">{t("bestAsk")}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-success text-base">{t("bids")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="text-muted-foreground grid grid-cols-2 text-xs">
              <span>{t("price")}</span>
              <span className="text-right">{t("amount")}</span>
            </div>
            {data.bids.map((bid, i) => (
              <div key={i} className="text-success/90 grid grid-cols-2 text-sm tabular-nums">
                <span>{parseFloat(bid.price).toFixed(7)}</span>
                <span className="text-right">{formatCompactNumber(parseFloat(bid.amount))}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-destructive text-base">{t("asks")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="text-muted-foreground grid grid-cols-2 text-xs">
              <span>{t("price")}</span>
              <span className="text-right">{t("amount")}</span>
            </div>
            {data.asks.map((ask, i) => (
              <div key={i} className="text-destructive/90 grid grid-cols-2 text-sm tabular-nums">
                <span>{parseFloat(ask.price).toFixed(7)}</span>
                <span className="text-right">{formatCompactNumber(parseFloat(ask.amount))}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {data.spread !== null && (
        <div className="col-span-full">
          <p className="text-muted-foreground text-center text-sm">
            {t("spread")}:{" "}
            <span className="text-foreground font-medium">{data.spread.toFixed(4)}%</span>
          </p>
        </div>
      )}
    </div>
  );
}
