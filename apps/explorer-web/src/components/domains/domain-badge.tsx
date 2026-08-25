"use client";

import { Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDomainsByAddress } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface DomainBadgeProps {
  /** Account (`G...`) or contract (`C...`) address to look up. */
  address: string;
  className?: string;
}

/**
 * "Also known as name.xlm" badge for an account or contract that owns a domain.
 *
 * Three outcomes, and the difference between them matters:
 *
 * - the address owns a domain: show it
 * - the address owns none: render nothing, so an address without a domain never
 *   gets a false positive
 * - the indexer hasn't ingested domain data yet, isn't configured, or failed:
 *   show a muted "not available yet" badge, so the feature reads as pending
 *   rather than broken or silently missing
 *
 * The distinction comes from the API body's `indexed` field, never from an HTTP
 * status, so this activates on its own once the indexer backfills.
 */
export function DomainBadge({ address, className }: DomainBadgeProps) {
  const { data: result, isLoading } = useDomainsByAddress(address);
  const t = useTranslations("domains");

  // Nothing to say until the first response lands.
  if (isLoading || !result) return null;

  if (!result.available) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn("text-muted-foreground border-dashed font-medium", className)}
          >
            <Globe className="opacity-60" />
            {t("notAvailable")}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{t("notAvailableHint")}</TooltipContent>
      </Tooltip>
    );
  }

  const domain = result.data.domain;
  if (!domain) return null;

  const extra = result.data.domains.length - 1;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn("bg-primary/15 text-primary border-primary/25 font-medium", className)}
        >
          <Globe />
          <span className="font-mono">{domain.name}</span>
          {extra > 0 && <span className="opacity-70">{t("more", { count: extra })}</span>}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{t("alsoKnownAs", { name: domain.name })}</TooltipContent>
    </Tooltip>
  );
}
