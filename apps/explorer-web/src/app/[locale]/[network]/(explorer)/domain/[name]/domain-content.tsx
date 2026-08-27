"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingCard } from "@/components/common/loading-card";
import { DomainStatusBadge, DomainsUnavailable } from "@/components/domains";
import { Link } from "@/i18n/navigation";
import { useDomainDetail } from "@/lib/hooks";
import { formatDateTime, truncateHash } from "@/lib/utils";
import type { DomainEventType, DomainRecord, DomainEventRecord } from "@/lib/indexer";
import { Globe, ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

interface DomainContentProps {
  name: string;
}

const eventStyles: Record<DomainEventType, string> = {
  register: "bg-success/15 text-success border-success/25",
  transfer: "bg-primary/15 text-primary border-primary/25",
  renew: "bg-chart-1/15 text-chart-1 border-chart-1/25",
  claim: "bg-warning/15 text-warning border-warning/25",
  revoke: "bg-destructive/15 text-destructive border-destructive/25",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-sm break-all">{children}</span>
    </div>
  );
}

export function DomainContent({ name }: DomainContentProps) {
  const { data: result, isLoading } = useDomainDetail(name);
  const t = useTranslations("domains");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const header = (
    <>
      <Breadcrumbs
        items={[
          { label: t("title"), href: "/domains" },
          { label: name, href: `/domain/${encodeURIComponent(name)}` },
        ]}
      />
      <PageHeader
        title={name}
        backHref="/domains"
        backLabel={t("title")}
        showCopy={false}
        badge={<Globe className="text-primary size-5" />}
      />
    </>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        {header}
        <LoadingCard rows={6} />
      </div>
    );
  }

  // Not indexed, not configured, or unreachable. All read the same to a visitor.
  if (!result?.available) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <CardContent className="py-8">
            <DomainsUnavailable />
          </CardContent>
        </Card>
      </div>
    );
  }

  const domain: DomainRecord | null = result.data.domain;
  const events: DomainEventRecord[] = result.data.events;

  if (!domain) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <CardContent className="py-8">
            <EmptyState title={t("notRegistered")} description={t("notRegisteredHint")} />
          </CardContent>
        </Card>
      </div>
    );
  }

  const targetHref =
    domain.target_type === "contract"
      ? `/contract/${domain.address}`
      : `/account/${domain.address}`;

  return (
    <div className="space-y-6">
      {header}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("registration")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label={t("field.status")}>
            <DomainStatusBadge status={domain.status} />
          </Field>
          <Field label={t("field.resolvesTo")}>
            <Link href={targetHref} className="text-primary font-mono hover:underline">
              {truncateHash(domain.address, 8, 8)}
            </Link>
          </Field>
          <Field label={t("field.targetType")}>
            <Badge variant="outline">{t(`target.${domain.target_type}`)}</Badge>
          </Field>
          <Field label={t("field.owner")}>
            <Link
              href={`/account/${domain.owner}`}
              className="text-primary font-mono hover:underline"
            >
              {truncateHash(domain.owner, 8, 8)}
            </Link>
          </Field>
          <Field label={t("field.registeredAt")}>
            {formatDateTime(domain.registered_at, locale)}
          </Field>
          <Field label={t("field.expiresAt")}>{formatDateTime(domain.expires_at, locale)}</Field>
          <Field label={t("field.lastEventLedger")}>
            <Link
              href={`/ledger/${domain.last_event_ledger}`}
              className="text-primary font-mono hover:underline"
            >
              {domain.last_event_ledger}
            </Link>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("history")}</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <EmptyState title={t("noEvents")} description={t("noEventsHint")} />
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <div
                  key={`${event.transaction_hash}-${event.ledger_sequence}-${event.event_type}`}
                  className="bg-muted/30 flex items-center justify-between gap-3 rounded-lg p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Badge variant="outline" className={eventStyles[event.event_type]}>
                      {t(`event.${event.event_type}`)}
                    </Badge>
                    <div className="min-w-0">
                      {event.address && (
                        <p className="truncate font-mono text-xs">{truncateHash(event.address)}</p>
                      )}
                      <p className="text-muted-foreground text-xs">
                        {formatDateTime(event.created_at, locale)}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/tx/${event.transaction_hash}`}
                    className="text-primary flex shrink-0 items-center gap-1 font-mono text-xs hover:underline"
                    aria-label={tCommon("viewAll")}
                  >
                    {truncateHash(event.transaction_hash)}
                    <ArrowRight className="size-3" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
