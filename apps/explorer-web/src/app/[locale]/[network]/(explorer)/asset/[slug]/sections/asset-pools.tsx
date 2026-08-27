"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingCard } from "@/components/common/loading-card";
import { ErrorState } from "@/components/common/error-state";
import { EmptyState } from "@/components/common/empty-state";
import { HashDisplay } from "@/components/common/hash-display";
import { Link } from "@/i18n/navigation";
import {
  PairTable,
  PairTableSkeleton,
  PairTableNotAvailable,
  type PairData,
  type PairSortKey,
  type SortDirection,
} from "@/components/pairs";
import { useAssetLiquidityPools, useDexPairs } from "@/lib/hooks";
import { DEX_PAIRS_FETCH_LIMIT } from "@/lib/constants";
import { formatNumber } from "@/lib/utils";
import { Droplets } from "lucide-react";
import type { Horizon } from "@stellar/stellar-sdk";

interface AssetPoolsProps {
  code: string;
  issuer: string;
}

function reserveLabel(asset: string): string {
  return asset === "native" ? "XLM" : asset.split(":")[0];
}

function AssetPoolsList({ code, issuer }: AssetPoolsProps) {
  const t = useTranslations("assetDetails");
  const { data, isLoading, error, refetch } = useAssetLiquidityPools(code, issuer);

  if (isLoading) return <LoadingCard rows={3} />;
  if (error) {
    return <ErrorState title={t("failedToLoadPools")} message={error.message} onRetry={refetch} />;
  }
  if (!data?.records?.length) {
    return <EmptyState title={t("noPools")} description={t("noPoolsDesc")} />;
  }

  return (
    <div className="space-y-2">
      {data.records.map((pool: Horizon.ServerApi.LiquidityPoolRecord) => (
        <Link key={pool.id} href={`/liquidity-pool/${pool.id}`} className="group block">
          <div className="hover:bg-muted/50 flex items-center justify-between gap-3 rounded-lg p-3 transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="bg-primary/10 flex size-8 items-center justify-center rounded-md">
                <Droplets className="text-primary size-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  {pool.reserves.map((r, i) => (
                    <span key={r.asset} className="flex items-center gap-1.5">
                      <Badge variant="secondary">{reserveLabel(r.asset)}</Badge>
                      {i < pool.reserves.length - 1 && (
                        <span className="text-muted-foreground">/</span>
                      )}
                    </span>
                  ))}
                </div>
                <HashDisplay
                  hash={pool.id}
                  truncate
                  startLength={6}
                  endLength={6}
                  copyable={false}
                  className="text-muted-foreground text-xs"
                />
              </div>
            </div>
            <div className="text-right">
              {pool.reserves.map((r) => (
                <p key={r.asset} className="font-mono text-sm tabular-nums">
                  {formatNumber(r.amount)} {reserveLabel(r.asset)}
                </p>
              ))}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function AssetPairsList({ code, issuer }: AssetPoolsProps) {
  const { data: result, isLoading } = useDexPairs(DEX_PAIRS_FETCH_LIMIT);
  const [sortKey, setSortKey] = useState<PairSortKey>("volume");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const handleSortChange = (key: PairSortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const pairs: PairData[] = useMemo(() => {
    if (!result || !result.available) return [];
    const filtered = result.data.data.filter(
      (p) =>
        (p.base.code === code && p.base.issuer === issuer) ||
        (p.counter.code === code && p.counter.issuer === issuer)
    );
    return [...filtered].sort((a, b) => {
      const aVal = sortKey === "volume" ? a.volume24h : (a.liquidity ?? -Infinity);
      const bVal = sortKey === "volume" ? b.volume24h : (b.liquidity ?? -Infinity);
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [result, code, issuer, sortKey, sortDir]);

  if (isLoading) return <PairTableSkeleton rows={3} />;
  if (!result || !result.available) {
    return <PairTableNotAvailable />;
  }

  return (
    <PairTable pairs={pairs} sortKey={sortKey} sortDir={sortDir} onSortChange={handleSortChange} />
  );
}

export function AssetPools({ code, issuer }: AssetPoolsProps) {
  const t = useTranslations("assetDetails");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("liquidityPools")}</CardTitle>
        </CardHeader>
        <CardContent>
          <AssetPoolsList code={code} issuer={issuer} />
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">{t("tradingPairs")}</h3>
        <AssetPairsList code={code} issuer={issuer} />
      </div>
    </div>
  );
}
