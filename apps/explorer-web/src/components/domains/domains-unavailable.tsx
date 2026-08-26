"use client";

import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import { useTranslations } from "next-intl";

/**
 * Shown whenever the indexer has no domain data to give: not ingested yet, not
 * configured, or unreachable.
 *
 * Deliberately a "not available yet" state rather than an error or a hidden
 * feature, so the section reads as pending. It activates on its own once the
 * indexer backfills.
 */
export function DomainsUnavailable() {
  const t = useTranslations("domains");

  return (
    <Card>
      <CardContent className="py-8">
        <EmptyState title={t("notAvailable")} description={t("notAvailableHint")} icon="search" />
      </CardContent>
    </Card>
  );
}
