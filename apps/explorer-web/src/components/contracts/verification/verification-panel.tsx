"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, HelpCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useContractCode, useContractVerification, useVerificationSourceTree } from "@/lib/hooks";
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
  const record = verificationResult?.available ? verificationResult.data : null;
  const { data: treeResult } = useVerificationSourceTree(record ? wasmHash : "");
  const sourceTree = treeResult?.available ? treeResult.data : [];

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

  const hasSource = sourceTree.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <VerificationBadge status={record?.status ?? "unverified"} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">{t("tabOverview")}</TabsTrigger>
          {hasSource && <TabsTrigger value="source">{t("tabSource")}</TabsTrigger>}
          {hasSource && <TabsTrigger value="diff">{t("tabDiff")}</TabsTrigger>}
          <TabsTrigger value="submit">{t("tabSubmit")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-3">
          {record ? (
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              {(record.rustVersion || record.sorobanSdkVersion) && (
                <div>
                  <p className="text-muted-foreground">{t("toolchain")}</p>
                  <p className="font-mono">
                    rustc {record.rustVersion ?? "?"} / sdk {record.sorobanSdkVersion ?? "?"}
                  </p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">{t("submittedAt")}</p>
                <p>{formatDateTime(record.submittedAt)}</p>
              </div>
              {record.repositoryUrl && (
                <div className="sm:col-span-2">
                  <p className="text-muted-foreground">{t("repositoryUrl")}</p>
                  <a
                    href={record.repositoryUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary truncate underline"
                  >
                    {record.repositoryUrl}
                  </a>
                </div>
              )}
              {record.gitRef && (
                <div>
                  <p className="text-muted-foreground">{t("gitRef")}</p>
                  <p className="font-mono">{record.gitRef}</p>
                </div>
              )}
              {record.gitCommit && (
                <div>
                  <p className="text-muted-foreground">{t("gitCommit")}</p>
                  <p className="font-mono">{record.gitCommit}</p>
                </div>
              )}
              {record.failureReason && (
                <div className="sm:col-span-2">
                  <p className="text-muted-foreground">{t("submissionFailed")}</p>
                  <p>{record.failureReason}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{t("badgeUnverified")}</p>
          )}
        </TabsContent>

        {hasSource && (
          <TabsContent value="source" className="mt-4">
            <SourceBrowser wasmHash={wasmHash} tree={sourceTree} />
          </TabsContent>
        )}

        {hasSource && (
          <TabsContent value="diff" className="mt-4">
            <DiffTab currentWasmHash={wasmHash} currentTree={sourceTree} />
          </TabsContent>
        )}

        <TabsContent value="submit" className="mt-4">
          <SubmissionForm contractId={contractId} wasmHash={wasmHash} />
        </TabsContent>
      </Tabs>

      <Separator />
    </div>
  );
}
