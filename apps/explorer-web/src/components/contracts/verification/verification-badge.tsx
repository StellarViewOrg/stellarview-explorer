"use client";

import { useTranslations } from "next-intl";
import { CheckCircle2, XCircle, Clock, AlertTriangle, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { VerificationStatus } from "@/lib/indexer";

/** `null` covers "the verification service isn't reachable yet". */
export type VerificationBadgeStatus = VerificationStatus | "not_available";

interface VerificationBadgeProps {
  status: VerificationBadgeStatus;
  size?: "sm" | "default";
  className?: string;
}

const badgeStyles: Record<
  VerificationBadgeStatus,
  { icon: typeof CheckCircle2; className: string }
> = {
  verified: {
    icon: CheckCircle2,
    className: "bg-gradient-to-r from-success/20 to-success/10 text-success border-success/30",
  },
  unverified: {
    icon: XCircle,
    className: "text-muted-foreground border-muted-foreground/30",
  },
  pending: {
    icon: Clock,
    className:
      "bg-gradient-to-r from-warning/20 to-warning/10 text-warning border-warning/30 animate-pulse",
  },
  mismatch: {
    icon: AlertTriangle,
    className:
      "bg-gradient-to-r from-destructive/20 to-destructive/10 text-destructive border-destructive/30",
  },
  build_failed: {
    icon: AlertTriangle,
    className:
      "bg-gradient-to-r from-destructive/20 to-destructive/10 text-destructive border-destructive/30",
  },
  not_available: {
    icon: HelpCircle,
    className: "text-muted-foreground border-muted-foreground/30",
  },
};

const labelKeys: Record<VerificationBadgeStatus, string> = {
  verified: "badgeVerified",
  unverified: "badgeUnverified",
  pending: "badgePending",
  mismatch: "badgeMismatch",
  build_failed: "badgeBuildFailed",
  not_available: "badgeNotAvailable",
};

export function VerificationBadge({ status, size = "default", className }: VerificationBadgeProps) {
  const t = useTranslations("contract.verification");
  const config = badgeStyles[status];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        config.className,
        "transition-all duration-200",
        size === "sm" && "px-1.5 py-0 text-[10px]",
        className
      )}
    >
      <Icon className={cn("shrink-0", size === "sm" ? "mr-1 size-2.5" : "mr-1 size-3")} />
      <span>{t(labelKeys[status])}</span>
    </Badge>
  );
}
