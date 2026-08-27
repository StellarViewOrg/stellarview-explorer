"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingCard } from "@/components/common/loading-card";
import { ErrorState } from "@/components/common/error-state";
import { EmptyState } from "@/components/common/empty-state";
import { formatNumber, formatTimeAgo } from "@/lib/utils";
import { useLiquidityPoolActivity } from "@/lib/hooks";
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Info } from "lucide-react";
import type { Horizon } from "@stellar/stellar-sdk";

interface PoolActivityProps {
  id: string;
}

function reserveLabel(asset: string): string {
  return asset === "native" ? "XLM" : asset.split(":")[0];
}

function reservesText(reserves: Horizon.HorizonApi.Reserve[]): string {
  return reserves.map((r) => `${formatNumber(r.amount)} ${reserveLabel(r.asset)}`).join(" + ");
}

function ActivityRow({
  effect,
  t,
}: {
  effect: Horizon.ServerApi.EffectRecord;
  t: (key: string) => string;
}) {
  if (effect.type === "liquidity_pool_deposited") {
    return (
      <div className="flex items-center justify-between gap-3 border-b py-2.5 text-sm last:border-0">
        <div className="flex items-center gap-2.5">
          <div className="bg-success/10 flex size-8 items-center justify-center rounded-md">
            <ArrowDownToLine className="text-success size-4" />
          </div>
          <div>
            <p className="font-medium">{t("depositType")}</p>
            <p className="text-muted-foreground text-xs">{formatTimeAgo(effect.created_at)}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono">{reservesText(effect.reserves_deposited)}</p>
          <p className="text-muted-foreground text-xs">
            {t("sharesReceived")}: {formatNumber(effect.shares_received)}
          </p>
        </div>
      </div>
    );
  }

  if (effect.type === "liquidity_pool_withdrew") {
    return (
      <div className="flex items-center justify-between gap-3 border-b py-2.5 text-sm last:border-0">
        <div className="flex items-center gap-2.5">
          <div className="bg-destructive/10 flex size-8 items-center justify-center rounded-md">
            <ArrowUpFromLine className="text-destructive size-4" />
          </div>
          <div>
            <p className="font-medium">{t("withdrawType")}</p>
            <p className="text-muted-foreground text-xs">{formatTimeAgo(effect.created_at)}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono">{reservesText(effect.reserves_received)}</p>
          <p className="text-muted-foreground text-xs">
            {t("sharesRedeemed")}: {formatNumber(effect.shares_redeemed)}
          </p>
        </div>
      </div>
    );
  }

  if (effect.type === "liquidity_pool_trade") {
    return (
      <div className="flex items-center justify-between gap-3 border-b py-2.5 text-sm last:border-0">
        <div className="flex items-center gap-2.5">
          <div className="bg-primary/10 flex size-8 items-center justify-center rounded-md">
            <ArrowLeftRight className="text-primary size-4" />
          </div>
          <div>
            <p className="font-medium">{t("tradeType")}</p>
            <p className="text-muted-foreground text-xs">{formatTimeAgo(effect.created_at)}</p>
          </div>
        </div>
        <div className="text-right font-mono">
          <span className="text-destructive">
            -{formatNumber(effect.sold.amount)} {reserveLabel(effect.sold.asset)}
          </span>
          <span className="text-muted-foreground mx-1">/</span>
          <span className="text-success">
            +{formatNumber(effect.bought.amount)} {reserveLabel(effect.bought.asset)}
          </span>
        </div>
      </div>
    );
  }

  const genericLabel =
    effect.type === "liquidity_pool_created"
      ? t("createdType")
      : effect.type === "liquidity_pool_removed"
        ? t("removedType")
        : effect.type === "liquidity_pool_revoked"
          ? t("revokedType")
          : effect.type.replace(/_/g, " ");

  return (
    <div className="flex items-center justify-between gap-3 border-b py-2.5 text-sm last:border-0">
      <div className="flex items-center gap-2.5">
        <div className="bg-muted flex size-8 items-center justify-center rounded-md">
          <Info className="text-muted-foreground size-4" />
        </div>
        <p className="font-medium">{genericLabel}</p>
      </div>
      <p className="text-muted-foreground text-xs">{formatTimeAgo(effect.created_at)}</p>
    </div>
  );
}

export function PoolActivity({ id }: PoolActivityProps) {
  const t = useTranslations("liquidityPool");
  const { data, isLoading, error, refetch } = useLiquidityPoolActivity(id);

  if (isLoading) {
    return <LoadingCard rows={5} />;
  }

  if (error) {
    return (
      <ErrorState title={t("failedToLoadActivity")} message={error.message} onRetry={refetch} />
    );
  }

  // Horizon's liquidity pool effects feed also includes the account_credited/
  // account_debited effects from the same underlying operations (e.g. a path
  // payment routed through the pool). Those amounts are already reflected in
  // the liquidity_pool_trade row, so only surface pool-level effect types here.
  const poolEffects = (data?.records ?? []).filter((effect) =>
    effect.type.startsWith("liquidity_pool_")
  );

  if (!poolEffects.length) {
    return <EmptyState title={t("noActivity")} description={t("noActivityDesc")} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("activity")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {poolEffects.map((effect) => (
            <ActivityRow key={effect.id} effect={effect} t={t} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
