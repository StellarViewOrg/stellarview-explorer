"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { NetworkBadge } from "@/components/common/network-badge";
import { AssetLogo } from "@/components/common/asset-logo";
import CandlestickChart from "@/components/charts/candlestick-chart";
import {
  DateRangePicker,
  rangePresetToISO,
  CandleResolutionPicker,
  type DateRangePreset,
} from "@/components/charts";
import { PairTrades } from "./sections/pair-trades";
import { PairOrderbook } from "./sections/pair-orderbook";
import { useNetwork } from "@/lib/providers";
import { parsePairSlug } from "@/lib/utils";
import { BarChart3, BookOpen } from "lucide-react";
import type { CandleResolution } from "@/lib/indexer";

interface PairContentProps {
  slug: string;
}

export function PairContent({ slug }: PairContentProps) {
  const t = useTranslations("pair");
  const { network } = useNetwork();
  const [resolution, setResolution] = useState<CandleResolution>("1h");
  const [range, setRange] = useState<DateRangePreset>("7d");

  const parsed = parsePairSlug(slug);
  if (!parsed) {
    return notFound();
  }
  const { base, counter } = parsed;
  const pairLabel = `${base.code} / ${counter.code}`;
  const { from, to } = rangePresetToISO(range);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: t("pairs"), href: "/pairs" },
          { label: pairLabel, href: `/pair/${slug}` },
        ]}
      />

      <PageHeader
        title={pairLabel}
        backHref="/pairs"
        backLabel={t("pairs")}
        showCopy={false}
        badge={<NetworkBadge network={network} />}
      />

      <div className="flex items-center gap-3">
        <div className="flex -space-x-2">
          <AssetLogo code={base.code} issuer={base.issuer} size="lg" />
          <AssetLogo code={counter.code} issuer={counter.issuer} size="lg" />
        </div>
        <div>
          <p className="text-lg font-semibold">{pairLabel}</p>
          <p className="text-muted-foreground text-xs">{t("subtitle")}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <CandleResolutionPicker value={resolution} onChange={setResolution} />
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      <CandlestickChart pairId={slug} resolution={resolution} from={from} to={to} height={320} />

      <Tabs defaultValue="trades" className="w-full">
        <TabsList>
          <TabsTrigger value="trades">
            <BarChart3 className="mr-1.5 size-3.5" />
            {t("trades")}
          </TabsTrigger>
          <TabsTrigger value="orderbook">
            <BookOpen className="mr-1.5 size-3.5" />
            {t("orderbook")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="trades" className="mt-4">
          <PairTrades
            baseCode={base.code}
            baseIssuer={base.issuer}
            counterCode={counter.code}
            counterIssuer={counter.issuer}
          />
        </TabsContent>
        <TabsContent value="orderbook" className="mt-4">
          <PairOrderbook
            baseCode={base.code}
            baseIssuer={base.issuer}
            counterCode={counter.code}
            counterIssuer={counter.issuer}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
