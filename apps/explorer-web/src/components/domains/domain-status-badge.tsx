"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DomainStatus } from "@/lib/indexer";
import { useTranslations } from "next-intl";

interface DomainStatusBadgeProps {
  status: DomainStatus;
  className?: string;
}

const statusStyles: Record<DomainStatus, string> = {
  active: "bg-success/15 text-success border-success/25",
  expired: "bg-warning/15 text-warning border-warning/25",
  revoked: "bg-destructive/15 text-destructive border-destructive/25",
};

/** Lifecycle state of a registration, computed by the indexer at read time. */
export function DomainStatusBadge({ status, className }: DomainStatusBadgeProps) {
  const t = useTranslations("domains");

  return (
    <Badge variant="outline" className={cn(statusStyles[status], "font-medium", className)}>
      {t(`status.${status}`)}
    </Badge>
  );
}
