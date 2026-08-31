"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, CheckCircle2, AlertTriangle, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useSubmitVerification, usePollVerificationStatus } from "@/lib/hooks";
import { useNetwork } from "@/lib/providers/network-provider";

interface SubmissionFormProps {
  contractId: string;
  wasmHash: string;
}

interface SourceFileEntry {
  id: number;
  path: string;
  content: string;
}

let nextFileEntryId = 0;

export function SubmissionForm({ contractId, wasmHash }: SubmissionFormProps) {
  const t = useTranslations("contract.verification");
  const { network } = useNetwork();
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [gitRef, setGitRef] = useState("");
  const [gitCommit, setGitCommit] = useState("");
  const [rustVersion, setRustVersion] = useState("");
  const [sdkVersion, setSdkVersion] = useState("");
  const [files, setFiles] = useState<SourceFileEntry[]>([
    { id: nextFileEntryId++, path: "", content: "" },
  ]);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const submit = useSubmitVerification(wasmHash);
  const polled = usePollVerificationStatus(wasmHash, hasSubmitted);

  const validFiles = files.filter((f) => f.path.trim() && f.content.trim());
  const isValid = validFiles.length > 0;

  function updateFile(id: number, patch: Partial<SourceFileEntry>) {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function addFile() {
    setFiles((prev) => [...prev, { id: nextFileEntryId++, path: "", content: "" }]);
  }

  function removeFile(id: number) {
    setFiles((prev) => (prev.length > 1 ? prev.filter((f) => f.id !== id) : prev));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isValid) return;

    const fileMap: Record<string, string> = {};
    for (const f of validFiles) fileMap[f.path.trim()] = f.content;

    submit.mutate(
      {
        contractId,
        network,
        repositoryUrl: repositoryUrl || undefined,
        gitRef: gitRef || undefined,
        gitCommit: gitCommit || undefined,
        rustVersion: rustVersion || undefined,
        sorobanSdkVersion: sdkVersion || undefined,
        files: fileMap,
      },
      {
        onSuccess: (result) => {
          if (result.available) setHasSubmitted(true);
        },
      }
    );
  }

  const record = polled.data?.available ? polled.data.data : null;
  const isPolling = hasSubmitted && (!record || record.status === "pending");

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{t("submitDescription")}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="repositoryUrl">{t("repositoryUrl")}</Label>
            <Input
              id="repositoryUrl"
              value={repositoryUrl}
              onChange={(e) => setRepositoryUrl(e.target.value)}
              placeholder="https://github.com/org/repo"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gitRef">{t("gitRef")}</Label>
            <Input
              id="gitRef"
              value={gitRef}
              onChange={(e) => setGitRef(e.target.value)}
              placeholder="main"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gitCommit">{t("gitCommit")}</Label>
            <Input
              id="gitCommit"
              value={gitCommit}
              onChange={(e) => setGitCommit(e.target.value)}
              placeholder="a1b2c3d"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="rustVersion">{t("toolchainVersion")}</Label>
            <Input
              id="rustVersion"
              value={rustVersion}
              onChange={(e) => setRustVersion(e.target.value)}
              placeholder="1.79.0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sdkVersion">{t("sdkVersion")}</Label>
            <Input
              id="sdkVersion"
              value={sdkVersion}
              onChange={(e) => setSdkVersion(e.target.value)}
              placeholder="21.0.0"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t("sourceFiles")}</Label>
            <Button type="button" size="sm" variant="outline" onClick={addFile}>
              <Plus className="mr-1 size-3.5" />
              {t("addFile")}
            </Button>
          </div>
          <div className="space-y-3">
            {files.map((f) => (
              <div key={f.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={f.path}
                    onChange={(e) => updateFile(f.id, { path: e.target.value })}
                    placeholder={t("filePathPlaceholder")}
                    className="font-mono text-xs"
                  />
                  {files.length > 1 && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeFile(f.id)}
                      aria-label={t("removeFile")}
                    >
                      <X className="size-3.5" />
                    </Button>
                  )}
                </div>
                <Textarea
                  value={f.content}
                  onChange={(e) => updateFile(f.id, { content: e.target.value })}
                  placeholder={t("fileContentPlaceholder")}
                  className="min-h-32 font-mono text-xs"
                />
              </div>
            ))}
          </div>
          {!isValid && <p className="text-muted-foreground text-xs">{t("filesRequiredHint")}</p>}
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

      {record?.status === "verified" && (
        <Alert>
          <CheckCircle2 className="text-success size-4" />
          <AlertTitle>{t("submissionSuccess")}</AlertTitle>
        </Alert>
      )}

      {record?.status === "mismatch" && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>{t("submissionMismatch")}</AlertTitle>
          {record.failureReason && <AlertDescription>{record.failureReason}</AlertDescription>}
        </Alert>
      )}

      {record?.status === "failed" && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>{t("submissionFailed")}</AlertTitle>
          {record.failureReason && <AlertDescription>{record.failureReason}</AlertDescription>}
        </Alert>
      )}
    </div>
  );
}
