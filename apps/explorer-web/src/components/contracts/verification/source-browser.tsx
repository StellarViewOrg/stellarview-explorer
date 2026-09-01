"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { File, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useVerificationSourceFile } from "@/lib/hooks";
import type { SourceFileMeta } from "@/lib/indexer";

interface SourceBrowserProps {
  wasmHash: string;
  tree: SourceFileMeta[];
}

export function SourceBrowser({ wasmHash, tree }: SourceBrowserProps) {
  const t = useTranslations("contract.verification");
  const [selectedPath, setSelectedPath] = useState<string | null>(tree[0]?.path ?? null);
  const { data, isLoading } = useVerificationSourceFile(wasmHash, selectedPath ?? "");

  if (tree.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">{t("emptySourceTree")}</p>;
  }

  const content = data?.available ? data.data.content : null;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[240px_1fr]">
      <ScrollArea className="bg-muted/20 h-[480px] rounded-lg border">
        <div className="p-1">
          {tree.map((file) => (
            <button
              key={file.path}
              type="button"
              onClick={() => setSelectedPath(file.path)}
              className={cn(
                "flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-sm",
                selectedPath === file.path ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
              )}
            >
              <File className="text-muted-foreground size-3.5 shrink-0" />
              <span className="truncate font-mono text-xs">{file.path}</span>
            </button>
          ))}
        </div>
      </ScrollArea>

      <ScrollArea className="bg-muted/20 h-[480px] rounded-lg border">
        <div className="p-4">
          {!selectedPath && (
            <p className="text-muted-foreground text-sm">{t("selectFilePrompt")}</p>
          )}
          {selectedPath && isLoading && (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
              {t("selectFilePrompt")}
            </div>
          )}
          {selectedPath && !isLoading && content !== null && (
            <pre className="overflow-x-auto font-mono text-xs leading-relaxed whitespace-pre">
              {content}
            </pre>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
