"use client";

import { useState } from "react";
import { useRouter, Link } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingCard } from "@/components/common/loading-card";
import { NetworkBadge } from "@/components/common/network-badge";
import { DomainStatusBadge, DomainsUnavailable } from "@/components/domains";
import { useDomainsList } from "@/lib/hooks";
import { useNetwork } from "@/lib/providers";
import { isDomainName, truncateHash } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { DomainStatus } from "@/lib/indexer";
import { Globe, Search, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";

type StatusFilter = DomainStatus | "all";

const STATUS_FILTERS: StatusFilter[] = ["active", "expired", "revoked", "all"];

export default function DomainsPage() {
  const { network } = useNetwork();
  const router = useRouter();
  const t = useTranslations("domains");
  const tCommon = useTranslations("common");

  const [status, setStatus] = useState<StatusFilter>("active");
  // Cursor pagination is forward-only, so keep the pages we have walked through
  // to be able to step back without refetching from the start.
  const [cursors, setCursors] = useState<string[]>([""]);
  const [pageIndex, setPageIndex] = useState(0);
  const [nameQuery, setNameQuery] = useState("");
  const [nameError, setNameError] = useState("");

  const { data: result, isLoading } = useDomainsList(status, cursors[pageIndex]);

  const changeStatus = (next: StatusFilter) => {
    setStatus(next);
    setCursors([""]);
    setPageIndex(0);
  };

  // The read API has no name search, only resolve-by-name, so the field jumps
  // straight to the detail page for an exact name.
  const handleJumpToName = (e: React.FormEvent) => {
    e.preventDefault();
    const name = nameQuery.trim().toLowerCase();
    if (!isDomainName(name)) {
      setNameError(t("invalidName"));
      return;
    }
    router.push(`/domain/${encodeURIComponent(name)}`);
  };

  const domains = result?.available ? result.data.domains : [];
  const nextCursor = result?.available ? result.data.cursor : "";
  const hasNext = !!nextCursor && domains.length > 0;

  const goNext = () => {
    if (!hasNext) return;
    if (pageIndex === cursors.length - 1) {
      setCursors([...cursors, nextCursor]);
    }
    setPageIndex(pageIndex + 1);
  };

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

      {/* Jump straight to a name */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("findDomain")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleJumpToName} className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder={t("namePlaceholder")}
                aria-label={t("namePlaceholder")}
                value={nameQuery}
                onChange={(e) => {
                  setNameQuery(e.target.value);
                  setNameError("");
                }}
                className="font-mono"
              />
              <Button type="submit">
                <Search className="mr-2 size-4" />
                {tCommon("search")}
              </Button>
            </div>
            {nameError && <p className="text-destructive text-sm">{nameError}</p>}
          </form>
        </CardContent>
      </Card>

      {/* Registered domains */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
          <CardTitle className="text-base">{t("registered")}</CardTitle>
          <div className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map((filter) => (
              <Button
                key={filter}
                variant={status === filter ? "secondary" : "ghost"}
                size="xs"
                onClick={() => changeStatus(filter)}
              >
                {t(`filter.${filter}`)}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingCard rows={5} />
          ) : !result?.available ? (
            <DomainsUnavailable />
          ) : domains.length === 0 ? (
            <EmptyState title={t("noneRegistered")} description={t("noneRegisteredHint")} />
          ) : (
            <>
              <div className="space-y-2">
                {domains.map((domain) => (
                  <Link
                    key={domain.name}
                    href={`/domain/${encodeURIComponent(domain.name)}`}
                    className="bg-muted/30 hover:bg-muted/50 flex items-center justify-between gap-3 rounded-lg p-3 transition-colors"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Globe className="text-primary size-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm font-medium">{domain.name}</p>
                        <p className="text-muted-foreground truncate font-mono text-xs">
                          {truncateHash(domain.address)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="outline" className="hidden sm:inline-flex">
                        {t(`target.${domain.target_type}`)}
                      </Badge>
                      <DomainStatusBadge status={domain.status} />
                      <ArrowRight className="text-muted-foreground size-4" />
                    </div>
                  </Link>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageIndex(pageIndex - 1)}
                  disabled={pageIndex === 0}
                >
                  <ChevronLeft className="mr-1 size-4" />
                  {t("previous")}
                </Button>
                <span className={cn("text-muted-foreground text-xs tabular-nums")}>
                  {t("pageNumber", { page: pageIndex + 1 })}
                </span>
                <Button variant="outline" size="sm" onClick={goNext} disabled={!hasNext}>
                  {t("next")}
                  <ChevronRight className="ml-1 size-4" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
