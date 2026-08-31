"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  useContractVerification,
  useVerificationSourceTree,
  useVerificationSourceFile,
} from "@/lib/hooks";
import type { SourceFileMeta } from "@/lib/indexer";
import { DiffView } from "./diff-view";

interface DiffTabProps {
  currentWasmHash: string;
  currentTree: SourceFileMeta[];
}

export function DiffTab({ currentWasmHash, currentTree }: DiffTabProps) {
  const t = useTranslations("contract.verification");
  const [compareInput, setCompareInput] = useState("");
  const [compareHash, setCompareHash] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const { data: compareResult, isLoading: compareLoading } = useContractVerification(compareHash);
  const compareRecord = compareResult?.available ? compareResult.data : null;
  const { data: compareTreeResult } = useVerificationSourceTree(compareRecord ? compareHash : "");

  const sharedFiles = useMemo(() => {
    if (!compareRecord) return [];
    const currentFiles = new Set(currentTree.map((f) => f.path));
    const tree = compareTreeResult?.available ? compareTreeResult.data : [];
    return tree.map((f) => f.path).filter((path) => currentFiles.has(path));
  }, [compareRecord, compareTreeResult, currentTree]);

  const currentFile = useVerificationSourceFile(currentWasmHash, selectedPath ?? "");
  const compareFile = useVerificationSourceFile(compareHash, selectedPath ?? "");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 space-y-2">
          <Label htmlFor="compareHash">{t("diffSelectVersions")}</Label>
          <Input
            id="compareHash"
            value={compareInput}
            onChange={(e) => setCompareInput(e.target.value)}
            placeholder="wasm_hash"
          />
        </div>
        <Button
          type="button"
          onClick={() => {
            setCompareHash(compareInput.trim());
            setSelectedPath(null);
          }}
          disabled={!compareInput.trim()}
        >
          {t("diffTo")}
        </Button>
      </div>

      {compareLoading && (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" />
          {t("checkingVerification")}
        </div>
      )}

      {compareHash && !compareLoading && !compareRecord && (
        <p className="text-muted-foreground text-sm">{t("notAvailableTitle")}</p>
      )}

      {compareRecord && sharedFiles.length === 0 && (
        <p className="text-muted-foreground text-sm">{t("diffNoChanges")}</p>
      )}

      {sharedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sharedFiles.map((path) => (
            <Button
              key={path}
              type="button"
              size="sm"
              variant={selectedPath === path ? "default" : "outline"}
              onClick={() => setSelectedPath(path)}
              className="font-mono text-xs"
            >
              {path}
            </Button>
          ))}
        </div>
      )}

      {selectedPath && currentFile.data?.available && compareFile.data?.available && (
        <DiffView
          path={selectedPath}
          before={compareFile.data.data.content}
          after={currentFile.data.data.content}
        />
      )}
    </div>
  );
}
