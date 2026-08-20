"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { NetworkBadge } from "@/components/common/network-badge";
import {
  PairTable,
  PairTableSkeleton,
  PairTableNotAvailable,
  type PairData,
  type PairSortKey,
  type SortDirection,
} from "@/components/pairs";
import { useNetwork } from "@/lib/providers";
import { useDexPairs } from "@/lib/hooks";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { paginate } from "@/lib/utils";
import { Search, CandlestickChart } from "lucide-react";

// The indexer's pair list response has no cursor/pagination metadata (see
// PairsResponse in lib/indexer/dex-types.ts), so we fetch a larger batch once
// and paginate client-side over the filtered/sorted result.
const PAIRS_FETCH_LIMIT = 100;

function matchesSearch(pair: PairData, query: string): boolean {
  if (!query) return true;
  const q = query.trim().toUpperCase();
  return pair.base.code.toUpperCase().includes(q) || pair.counter.code.toUpperCase().includes(q);
}

export default function PairsPage() {
  const t = useTranslations("pairs");
  const tCommon = useTranslations("common");
  const { network } = useNetwork();
  const { data: result, isLoading } = useDexPairs(PAIRS_FETCH_LIMIT);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<PairSortKey>("volume");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [page, setPage] = useState(0);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  const handleSortChange = (key: PairSortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  };

  const pairs: PairData[] = useMemo(() => {
    if (!result || !result.available) return [];
    return result.data.data;
  }, [result]);

  const visiblePairs = useMemo(() => {
    const filtered = pairs.filter((p) => matchesSearch(p, search));
    return [...filtered].sort((a, b) => {
      const aVal = sortKey === "volume" ? a.volume24h : (a.liquidity ?? -Infinity);
      const bVal = sortKey === "volume" ? b.volume24h : (b.liquidity ?? -Infinity);
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [pairs, search, sortKey, sortDir]);

  const {
    items: pagedPairs,
    pageCount,
    currentPage,
  } = paginate(visiblePairs, page, DEFAULT_PAGE_SIZE);

  const isAvailable = result?.available === true;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        backHref="/"
        backLabel={tCommon("home")}
        showCopy={false}
        badge={<NetworkBadge network={network} />}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("findPair")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <PairTableSkeleton rows={10} />
      ) : !isAvailable ? (
        <PairTableNotAvailable title={t("allPairs")} />
      ) : (
        <div className="space-y-3">
          <PairTable
            pairs={pagedPairs}
            title={t("allPairs")}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortChange={handleSortChange}
          />
          {visiblePairs.length > 0 && (
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
              >
                {tCommon("previous")}
              </Button>
              <span className="text-muted-foreground text-sm">
                {tCommon("pageOf", { page: currentPage + 1, total: pageCount })}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={currentPage >= pageCount - 1}
              >
                {tCommon("next")}
              </Button>
            </div>
          )}
        </div>
      )}

      <Card>
        <CardContent className="py-8">
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <div className="bg-chart-3/10 flex size-16 items-center justify-center rounded-2xl">
                <CandlestickChart className="text-chart-3 size-8" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold">{t("aboutPairs")}</h3>
              <p className="text-muted-foreground mx-auto mt-2 max-w-md">
                {t("aboutPairsDescription")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
