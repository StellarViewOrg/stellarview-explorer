"use client";

import { useTranslations } from "next-intl";
import { useContractCode, useContractVerification } from "@/lib/hooks";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Hash, Loader2, FileCode } from "lucide-react";
import { formatCompactNumber } from "@/lib/utils";
import { VerificationBadge } from "./verification/verification-badge";

interface ContractVerificationProps {
  contractId: string;
}

export function ContractVerification({ contractId }: ContractVerificationProps) {
  const t = useTranslations("contract");
  const { data: codeData, isLoading } = useContractCode(contractId);
  const wasmHash = codeData?.type === "wasm" ? codeData.wasmHash : "";
  const { data: verificationResult } = useContractVerification(wasmHash);
  const verificationStatus = !wasmHash
    ? null
    : !verificationResult
      ? null
      : verificationResult.available
        ? (verificationResult.data?.status ?? "unverified")
        : "not_available";

  if (isLoading) {
    return (
      <div className="bg-muted/30 rounded-lg border p-4">
        <div className="flex items-center gap-3">
          <Loader2 className="text-muted-foreground size-5 animate-spin" />
          <span className="text-muted-foreground text-sm">{t("checkingVerification")}</span>
        </div>
      </div>
    );
  }

  if (!codeData) {
    return null;
  }

  // Stellar Asset Contract (SAC) - no WASM hash
  if (codeData.type === "sac") {
    return (
      <div className="bg-muted/30 rounded-lg border p-4">
        <div className="flex items-center gap-3">
          <FileCode className="text-muted-foreground size-5" />
          <div>
            <p className="text-sm font-medium">{t("stellarAssetContract")}</p>
            <p className="text-muted-foreground text-xs">{t("sacDescription")}</p>
          </div>
        </div>
      </div>
    );
  }

  // WASM contract - show hash and code size
  return (
    <div className="bg-muted/30 rounded-lg border p-4">
      <div className="space-y-3">
        {verificationStatus && (
          <div className="flex items-center justify-between">
            <VerificationBadge status={verificationStatus} size="sm" />
          </div>
        )}
        {/* WASM Hash */}
        {codeData.wasmHash && (
          <div className="flex items-center gap-2 text-xs">
            <Hash className="text-muted-foreground size-3.5 shrink-0" />
            <span className="text-muted-foreground">{t("wasmHash")}:</span>
            <code className="truncate font-mono">
              {codeData.wasmHash.slice(0, 8)}...{codeData.wasmHash.slice(-8)}
            </code>
          </div>
        )}

        {/* Code Size */}
        {codeData.codeSize > 0 && (
          <>
            <Separator />
            <div className="flex items-center gap-2 text-xs">
              <FileCode className="text-muted-foreground size-3.5 shrink-0" />
              <span className="text-muted-foreground">{t("codeSize")}:</span>
              <Badge variant="outline" className="font-mono text-[10px]">
                {formatCompactNumber(codeData.codeSize)} {t("bytes")}
              </Badge>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
