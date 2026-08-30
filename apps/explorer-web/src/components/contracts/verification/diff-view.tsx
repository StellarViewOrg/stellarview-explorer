"use client";

import { useTranslations } from "next-intl";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, diffLines } from "@/lib/utils";

interface DiffViewProps {
  path: string;
  before: string;
  after: string;
}

const lineStyles = {
  unchanged: "",
  added: "bg-success/10 text-success",
  removed: "bg-destructive/10 text-destructive",
} as const;

const linePrefix = {
  unchanged: " ",
  added: "+",
  removed: "-",
} as const;

export function DiffView({ path, before, after }: DiffViewProps) {
  const t = useTranslations("contract.verification");
  const lines = diffLines(before, after);
  const hasChanges = lines.some((line) => line.type !== "unchanged");

  return (
    <div className="rounded-lg border">
      <div className="text-muted-foreground bg-muted/30 border-b px-3 py-2 font-mono text-xs">
        {path}
      </div>
      {!hasChanges ? (
        <p className="text-muted-foreground p-4 text-sm">{t("diffNoChanges")}</p>
      ) : (
        <ScrollArea className="h-[400px]">
          <pre className="p-2 font-mono text-xs leading-relaxed">
            {lines.map((line, index) => (
              <div key={index} className={cn("px-2", lineStyles[line.type])}>
                <span className="text-muted-foreground select-none">{linePrefix[line.type]}</span>{" "}
                {line.text}
              </div>
            ))}
          </pre>
        </ScrollArea>
      )}
    </div>
  );
}
