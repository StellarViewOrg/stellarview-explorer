"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { File, Folder, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useVerificationSourceFile } from "@/lib/hooks";
import type { SourceTreeNode } from "@/lib/indexer";

interface SourceBrowserProps {
  wasmHash: string;
  tree: SourceTreeNode[];
}

function findFirstFile(nodes: SourceTreeNode[]): string | null {
  for (const node of nodes) {
    if (node.type === "file") return node.path;
    if (node.children) {
      const found = findFirstFile(node.children);
      if (found) return found;
    }
  }
  return null;
}

function TreeNode({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: SourceTreeNode;
  depth: number;
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const name = node.path.split("/").pop() ?? node.path;

  if (node.type === "dir") {
    return (
      <div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="hover:bg-muted/50 flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-sm"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <Folder className="text-muted-foreground size-3.5 shrink-0" />
          <span className="truncate">{name}</span>
        </button>
        {expanded &&
          node.children?.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(node.path)}
      className={cn(
        "flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-sm",
        selected === node.path ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
      )}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <File className="text-muted-foreground size-3.5 shrink-0" />
      <span className="truncate font-mono text-xs">{name}</span>
    </button>
  );
}

export function SourceBrowser({ wasmHash, tree }: SourceBrowserProps) {
  const t = useTranslations("contract.verification");
  const [selectedPath, setSelectedPath] = useState<string | null>(() => findFirstFile(tree));
  const { data, isLoading } = useVerificationSourceFile(wasmHash, selectedPath ?? "");

  if (tree.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">{t("emptySourceTree")}</p>;
  }

  const content = data?.available ? data.data.content : null;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[240px_1fr]">
      <ScrollArea className="bg-muted/20 h-[480px] rounded-lg border">
        <div className="p-1">
          {tree.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              depth={0}
              selected={selectedPath}
              onSelect={setSelectedPath}
            />
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
