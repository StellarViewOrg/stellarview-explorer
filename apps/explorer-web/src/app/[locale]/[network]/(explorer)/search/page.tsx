"use client";

import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { Suspense, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { detectEntityType, getEntityRoute, isDomainName } from "@/lib/utils";
import {
  Search,
  ArrowRightLeft,
  Users,
  FileCode,
  Coins,
  Layers,
  ArrowRight,
  Globe,
} from "lucide-react";
import { useDomainResolution } from "@/lib/hooks";
import { DOMAIN_STATUS_MESSAGE_KEY, normalizeDomainName } from "@/lib/stellar";
import { Link } from "@/i18n/navigation";
import type { EntityType } from "@/types";
import { useTranslations } from "next-intl";

const entityIcons: Record<EntityType, typeof Search> = {
  transaction: ArrowRightLeft,
  account: Users,
  contract: FileCode,
  asset: Coins,
  ledger: Layers,
  domain: Globe,
  unknown: Search,
};

function SearchResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") || "";
  const t = useTranslations("searchPage");
  const tEntity = useTranslations("entityTypes");
  const tSearch = useTranslations("search");

  const detectedType = query ? detectEntityType(query) : "unknown";

  // Soroban Domains resolve to an account or contract, so the target route is
  // only known once the registry lookup comes back.
  const isDomainQuery = isDomainName(query);
  const { data: resolution, isFetching: isResolving } = useDomainResolution(
    isDomainQuery ? normalizeDomainName(query) : ""
  );
  const domainRoute =
    resolution?.status === "resolved"
      ? getEntityRoute(resolution.targetType, resolution.address)
      : null;

  const route = isDomainQuery ? domainRoute : query ? getEntityRoute(detectedType, query) : null;
  const shouldRedirect = !!route && detectedType !== "unknown";
  const hasRedirected = useRef(false);

  // Redirect in an effect to avoid calling router.replace during render
  useEffect(() => {
    if (shouldRedirect && route && !hasRedirected.current) {
      hasRedirected.current = true;
      router.replace(route);
    }
  }, [shouldRedirect, route, router]);

  if (!query) {
    return <EmptyState title={t("noQuery")} description={t("noQueryHint")} icon="search" />;
  }

  if (shouldRedirect) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="animate-pulse">
            <p className="text-muted-foreground">{t("redirecting")}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // A domain that hasn't resolved: show why, rather than the generic
  // "try searching as..." list, which has nothing useful to offer here.
  if (isDomainQuery) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Globe className="text-muted-foreground mx-auto mb-4 size-8" />
          <p className="font-mono text-sm break-all">{normalizeDomainName(query)}</p>
          <p className="text-muted-foreground mt-2 text-sm">
            {isResolving || !resolution || resolution.status === "resolved"
              ? tSearch("domainResolving")
              : tSearch(DOMAIN_STATUS_MESSAGE_KEY[resolution.status])}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Show search results for ambiguous queries
  const Icon = entityIcons[detectedType];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-card/50 flex items-center gap-3 rounded-lg p-4">
              <Icon className="text-muted-foreground size-5" />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm break-all">{query}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {t("detectedAs")} {tEntity(detectedType)}
                </p>
              </div>
            </div>

            {/* Possible interpretations */}
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("trySearchingAs")}</p>

              {/* Transaction */}
              {query.length === 64 && (
                <Link
                  href={`/tx/${query}`}
                  className="bg-muted/50 hover:bg-muted flex items-center justify-between rounded-lg p-3 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <ArrowRightLeft className="text-primary size-4" />
                    <span className="text-sm">{tEntity("transaction")}</span>
                  </div>
                  <ArrowRight className="text-muted-foreground size-4" />
                </Link>
              )}

              {/* Account */}
              {query.startsWith("G") && query.length === 56 && (
                <Link
                  href={`/account/${query}`}
                  className="bg-muted/50 hover:bg-muted flex items-center justify-between rounded-lg p-3 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Users className="text-chart-2 size-4" />
                    <span className="text-sm">{tEntity("account")}</span>
                  </div>
                  <ArrowRight className="text-muted-foreground size-4" />
                </Link>
              )}

              {/* Contract */}
              {query.startsWith("C") && query.length === 56 && (
                <Link
                  href={`/contract/${query}`}
                  className="bg-muted/50 hover:bg-muted flex items-center justify-between rounded-lg p-3 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileCode className="text-chart-4 size-4" />
                    <span className="text-sm">{tEntity("contract")}</span>
                  </div>
                  <ArrowRight className="text-muted-foreground size-4" />
                </Link>
              )}

              {/* Ledger */}
              {/^\d+$/.test(query) && (
                <Link
                  href={`/ledger/${query}`}
                  className="bg-muted/50 hover:bg-muted flex items-center justify-between rounded-lg p-3 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Layers className="text-chart-1 size-4" />
                    <span className="text-sm">{tEntity("ledger")}</span>
                  </div>
                  <ArrowRight className="text-muted-foreground size-4" />
                </Link>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {detectedType === "unknown" && (
        <Card>
          <CardContent className="py-8">
            <EmptyState
              title={t("couldntIdentify")}
              description={t("couldntIdentifyMessage")}
              icon="search"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function SearchPage() {
  const t = useTranslations("searchPage");
  const tCommon = useTranslations("common");

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} backHref="/" backLabel={tCommon("home")} showCopy={false} />

      <Suspense
        fallback={
          <Card>
            <CardContent className="py-12 text-center">
              <div className="animate-pulse">
                <p className="text-muted-foreground">{tCommon("loading")}</p>
              </div>
            </CardContent>
          </Card>
        }
      >
        <SearchResultsContent />
      </Suspense>
    </div>
  );
}
