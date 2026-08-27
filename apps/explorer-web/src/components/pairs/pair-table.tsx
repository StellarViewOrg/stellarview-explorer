"use client";

import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AssetLogo } from "@/components/common/asset-logo";
import { NotAvailableState } from "@/components/charts/not-available-state";
import { EmptyState } from "@/components/common/empty-state";
import { PriceChange } from "@/components/assets/asset-table";
import { formatCompactNumber, formatNumber, buildPairSlug, cn } from "@/lib/utils";

export interface PairAssetData {
  code: string;
  issuer: string;
}

export interface PairData {
  id: string;
  base: PairAssetData;
  counter: PairAssetData;
  lastPrice: number | null;
  priceChange24h: number | null;
  volume24h: number;
  liquidity: number | null;
}

export type PairSortKey = "volume" | "liquidity";
export type SortDirection = "asc" | "desc";

interface PairTableProps {
  pairs: PairData[];
  title?: string;
  sortKey: PairSortKey;
  sortDir: SortDirection;
  onSortChange: (key: PairSortKey) => void;
}

export function PairTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Card role="status" aria-busy="true">
      <CardHeader>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Not-available variant sized like a table (rather than a chart) for when
 * indexer#31's pair aggregates haven't been populated yet.
 */
export function PairTableNotAvailable({ title }: { title?: string }) {
  const t = useTranslations("pairs");
  return (
    <Card>
      {title && (
        <CardHeader className="pb-4">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={title ? "pt-0" : ""}>
        <NotAvailableState
          height={280}
          title={t("notAvailable.title")}
          description={t("notAvailable.description")}
        />
      </CardContent>
    </Card>
  );
}

function SortableHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDirection;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "hover:text-foreground flex items-center justify-end gap-1 transition-colors",
        active && "text-foreground"
      )}
    >
      {label}
      {active &&
        (dir === "desc" ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
    </button>
  );
}

export function PairTable({ pairs, title, sortKey, sortDir, onSortChange }: PairTableProps) {
  const t = useTranslations("components.pairTable");

  if (!pairs || pairs.length === 0) {
    return (
      <Card>
        {title && (
          <CardHeader className="pb-4">
            <CardTitle className="text-base">{title}</CardTitle>
          </CardHeader>
        )}
        <CardContent className={title ? "pt-0" : ""}>
          <EmptyState title={t("noPairsFound")} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {title && (
        <CardHeader className="pb-4">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={title ? "pt-0" : ""}>
        <div className="text-muted-foreground mb-3 hidden gap-4 border-b pb-3 text-xs font-medium md:grid md:grid-cols-12">
          <div className="col-span-4">{t("pair")}</div>
          <div className="col-span-2 text-right">{t("price")}</div>
          <div className="col-span-2 text-right">{t("change24h")}</div>
          <div className="col-span-2 text-right">
            <SortableHeader
              label={t("volume24h")}
              active={sortKey === "volume"}
              dir={sortDir}
              onClick={() => onSortChange("volume")}
            />
          </div>
          <div className="col-span-2 text-right">
            <SortableHeader
              label={t("liquidity")}
              active={sortKey === "liquidity"}
              dir={sortDir}
              onClick={() => onSortChange("liquidity")}
            />
          </div>
        </div>

        <div className="space-y-2">
          {pairs.map((pair) => (
            <Link
              key={pair.id}
              href={`/pair/${buildPairSlug(pair.base, pair.counter)}`}
              className="group block"
            >
              <div className="hover:bg-muted/50 grid grid-cols-2 items-center gap-4 rounded-lg p-3 transition-colors md:grid-cols-12">
                <div className="flex items-center gap-2 md:col-span-4">
                  <div className="flex -space-x-2">
                    <AssetLogo code={pair.base.code} issuer={pair.base.issuer} size="sm" />
                    <AssetLogo code={pair.counter.code} issuer={pair.counter.issuer} size="sm" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-semibold">
                      {pair.base.code}
                      <span className="text-muted-foreground mx-1">/</span>
                      {pair.counter.code}
                    </span>
                  </div>
                </div>

                <div className="col-span-2 hidden text-right md:block">
                  {pair.lastPrice !== null ? (
                    <span className="font-mono text-sm">
                      {formatNumber(pair.lastPrice, { maximumFractionDigits: 7 })}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </div>

                <div className="col-span-2 hidden justify-end md:flex">
                  {pair.priceChange24h !== null ? (
                    <PriceChange change={pair.priceChange24h} />
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </div>

                <div className="col-span-2 text-right">
                  <span className="font-mono text-sm">
                    {formatCompactNumber(pair.volume24h)} {pair.counter.code}
                  </span>
                </div>

                <div className="col-span-2 hidden text-right md:block">
                  {pair.liquidity !== null ? (
                    <span className="font-mono text-sm">
                      {formatCompactNumber(pair.liquidity)} {pair.counter.code}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </div>

                <div className="flex justify-end md:hidden">
                  {pair.priceChange24h !== null ? (
                    <PriceChange change={pair.priceChange24h} />
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
