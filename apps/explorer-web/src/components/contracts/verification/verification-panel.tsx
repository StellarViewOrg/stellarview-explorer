"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, HelpCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useContractCode, useContractVerification } from "@/lib/hooks";
import { formatDateTime } from "@/lib/utils";
import { VerificationBadge } from "./verification-badge";
import { SourceBrowser } from "./source-browser";
import { SubmissionForm } from "./submission-form";
import { DiffTab } from "./diff-tab";

interface VerificationPanelProps {
  contractId: string;
}

export function VerificationPanel({ contractId }: VerificationPanelProps) {
  const t = useTranslations("contract.verification");
  const [tab, setTab] = useState("overview");
  const { data: codeData, isLoading: codeLoading } = useContractCode(contractId);
  const wasmHash = codeData?.type === "wasm" ? codeData.wasmHash : "";
  const { data: verificationResult, isLoading: verificationLoading } =
    useContractVerification(wasmHash);

  if (codeLoading || (!!wasmHash && verificationLoading)) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
        <Loader2 className="size-4 animate-spin" />
        {t("checkingVerification")}
      </div>
    );
  }

  if (codeData?.type === "sac") {
    return null;
  }

  if (!verificationResult || !verificationResult.available) {
    return (
      <div className="bg-muted/30 flex flex-col items-center gap-2 rounded-lg border p-8 text-center">
        <HelpCircle className="text-muted-foreground size-8" />
        <p className="font-medium">{t("notAvailableTitle")}</p>
        <p className="text-muted-foreground max-w-md text-sm">{t("notAvailableDescription")}</p>
      </div>
    );
  }

  const record = verificationResult.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <VerificationBadge status={record?.status ?? "unverified"} />
        {record?.verifiedAt && (
          <span className="text-muted-foreground text-xs">
            {t("verificationTimestamp")} {formatDateTime(record.verifiedAt)}
          </span>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">{t("tabOverview")}</TabsTrigger>
          {record && record.sourceTree.length > 0 && (
            <TabsTrigger value="source">{t("tabSource")}</TabsTrigger>
          )}
          {record && record.sourceTree.length > 0 && (
            <TabsTrigger value="diff">{t("tabDiff")}</TabsTrigger>
          )}
          <TabsTrigger value="submit">{t("tabSubmit")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-3">
          {record ? (
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground">{t("toolchain")}</p>
                <p className="font-mono">
                  rustc {record.toolchain.rustVersion} / sdk {record.toolchain.sdkVersion}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("buildProfile")}</p>
                <p>
                  {record.buildProfile === "release"
                    ? t("profileRelease")
                    : t("profileReleaseWithLogs")}
                </p>
              </div>
              {record.submitter && (
                <div>
                  <p className="text-muted-foreground">{t("submittedBy")}</p>
                  <p className="truncate font-mono">{record.submitter}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">{t("submittedAt")}</p>
                <p>{formatDateTime(record.submittedAt)}</p>
              </div>
              {record.source?.type === "git" && (
                <div className="sm:col-span-2">
                  <p className="text-muted-foreground">{t("repositoryUrl")}</p>
                  <a
                    href={record.source.repositoryUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary truncate underline"
                  >
                    {record.source.repositoryUrl}
                  </a>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{t("badgeUnverified")}</p>
          )}
        </TabsContent>

        {record && record.sourceTree.length > 0 && (
          <TabsContent value="source" className="mt-4">
            <SourceBrowser wasmHash={wasmHash} tree={record.sourceTree} />
          </TabsContent>
        )}

        {record && record.sourceTree.length > 0 && (
          <TabsContent value="diff" className="mt-4">
            <DiffTab currentWasmHash={wasmHash} currentTree={record.sourceTree} />
          </TabsContent>
        )}

        <TabsContent value="submit" className="mt-4">
          <SubmissionForm contractId={contractId} />
        </TabsContent>
      </Tabs>

      <Separator />
    </div>
  );
}
