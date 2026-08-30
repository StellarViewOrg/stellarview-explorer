"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSubmitVerification, useVerificationSubmission } from "@/lib/hooks";
import type { VerificationBuildProfile, VerificationSourceRef } from "@/lib/indexer";

interface SubmissionFormProps {
  contractId: string;
}

type SourceType = "git" | "archive";

export function SubmissionForm({ contractId }: SubmissionFormProps) {
  const t = useTranslations("contract.verification");
  const [sourceType, setSourceType] = useState<SourceType>("git");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [commit, setCommit] = useState("");
  const [archiveUrl, setArchiveUrl] = useState("");
  const [rustVersion, setRustVersion] = useState("");
  const [sdkVersion, setSdkVersion] = useState("");
  const [buildProfile, setBuildProfile] = useState<VerificationBuildProfile>("release");
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  const submit = useSubmitVerification();
  const polled = useVerificationSubmission(submissionId ?? "");

  const isValid =
    (sourceType === "git" ? !!repositoryUrl && !!commit : !!archiveUrl) &&
    !!rustVersion &&
    !!sdkVersion;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isValid) return;

    const source: VerificationSourceRef =
      sourceType === "git"
        ? { type: "git", repositoryUrl, commit }
        : { type: "archive", archiveUrl };

    submit.mutate(
      {
        contractId,
        source,
        toolchain: { rustVersion, sdkVersion },
        buildProfile,
      },
      {
        onSuccess: (result) => {
          if (result.available) setSubmissionId(result.data.submissionId);
        },
      }
    );
  }

  const submissionRecord = polled.data?.available ? polled.data.data : null;
  const isPolling = !!submissionId && submissionRecord?.status === "pending";

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{t("submitDescription")}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>{t("sourceTypeGit")}</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={sourceType === "git" ? "default" : "outline"}
              onClick={() => setSourceType("git")}
            >
              {t("sourceTypeGit")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={sourceType === "archive" ? "default" : "outline"}
              onClick={() => setSourceType("archive")}
            >
              {t("sourceTypeArchive")}
            </Button>
          </div>
        </div>

        {sourceType === "git" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="repositoryUrl">{t("repositoryUrl")}</Label>
              <Input
                id="repositoryUrl"
                value={repositoryUrl}
                onChange={(e) => setRepositoryUrl(e.target.value)}
                placeholder="https://github.com/org/repo"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="commit">{t("commitHash")}</Label>
              <Input
                id="commit"
                value={commit}
                onChange={(e) => setCommit(e.target.value)}
                placeholder="a1b2c3d"
                required
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="archiveUrl">{t("archiveUrl")}</Label>
            <Input
              id="archiveUrl"
              value={archiveUrl}
              onChange={(e) => setArchiveUrl(e.target.value)}
              placeholder="https://example.com/source.tar.gz"
              required
            />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="rustVersion">{t("toolchainVersion")}</Label>
            <Input
              id="rustVersion"
              value={rustVersion}
              onChange={(e) => setRustVersion(e.target.value)}
              placeholder="1.79.0"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sdkVersion">{t("sdkVersion")}</Label>
            <Input
              id="sdkVersion"
              value={sdkVersion}
              onChange={(e) => setSdkVersion(e.target.value)}
              placeholder="21.0.0"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>{t("buildProfile")}</Label>
            <Select
              value={buildProfile}
              onValueChange={(value) => setBuildProfile(value as VerificationBuildProfile)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="release">{t("profileRelease")}</SelectItem>
                <SelectItem value="release-with-logs">{t("profileReleaseWithLogs")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button type="submit" disabled={!isValid || submit.isPending || isPolling}>
          {submit.isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              {t("submitting")}
            </>
          ) : (
            t("submitButton")
          )}
        </Button>
      </form>

      {submit.isSuccess && !submit.data.available && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>{t("submissionError")}</AlertTitle>
        </Alert>
      )}

      {submit.isError && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>{t("submissionError")}</AlertTitle>
        </Alert>
      )}

      {isPolling && (
        <Alert>
          <Loader2 className="size-4 animate-spin" />
          <AlertTitle>{t("submissionPolling")}</AlertTitle>
        </Alert>
      )}

      {submissionRecord?.status === "verified" && (
        <Alert>
          <CheckCircle2 className="text-success size-4" />
          <AlertTitle>{t("submissionSuccess")}</AlertTitle>
        </Alert>
      )}

      {submissionRecord?.status === "mismatch" && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>{t("submissionMismatch")}</AlertTitle>
          {submissionRecord.failureReason && (
            <AlertDescription>{submissionRecord.failureReason}</AlertDescription>
          )}
        </Alert>
      )}

      {submissionRecord?.status === "build_failed" && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>{t("submissionFailed")}</AlertTitle>
          {submissionRecord.failureReason && (
            <AlertDescription>{submissionRecord.failureReason}</AlertDescription>
          )}
        </Alert>
      )}
    </div>
  );
}
