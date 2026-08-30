"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingCard } from "@/components/common/loading-card";
import { ErrorState } from "@/components/common/error-state";
import { EmptyState } from "@/components/common/empty-state";
import { FunctionForm } from "./spec-form/function-form";
import { useContractCode } from "@/lib/hooks";
import { useNetwork } from "@/lib/providers";
import { decodeContractSpec } from "@/lib/stellar/spec-decoder";
import * as freighter from "@stellar/freighter-api";
import { useTranslations } from "next-intl";
import { Search, Terminal, Wallet, LogOut, CheckCircle2 } from "lucide-react";

interface ContractConsoleProps {
  contractId: string;
}

export function ContractConsole({ contractId }: ContractConsoleProps) {
  const t = useTranslations("contract.console");
  const { network } = useNetwork();
  const { data: codeData, isLoading, error, refetch } = useContractCode(contractId);

  const [connectedPublicKey, setConnectedPublicKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  // Decode contract spec from WASM bytecode or raw XDR
  const spec = useMemo(() => {
    if (!codeData || codeData.type !== "wasm") return null;
    return decodeContractSpec(codeData.wasmCode);
  }, [codeData]);

  const handleConnectWallet = async () => {
    setIsConnecting(true);
    setWalletError(null);
    try {
      const isConnected = await freighter.isConnected();
      if (!isConnected) {
        setWalletError(t("walletNotInstalled"));
        return;
      }

      const accessObj = await freighter.requestAccess();
      const address =
        typeof accessObj === "string" ? accessObj : (accessObj as { address?: string })?.address;

      if (address) {
        setConnectedPublicKey(address);
      } else {
        const fallbackRes = await freighter.getAddress();
        const fallbackAddr =
          typeof fallbackRes === "string"
            ? fallbackRes
            : (fallbackRes as { address?: string })?.address;
        if (fallbackAddr) {
          setConnectedPublicKey(fallbackAddr);
        } else {
          setWalletError(t("unableToRetrieveKey"));
        }
      }
    } catch {
      setWalletError(t("failedToConnectWallet"));
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectWallet = () => {
    setConnectedPublicKey(null);
  };

  if (isLoading) return <LoadingCard rows={6} />;

  if (error) {
    return <ErrorState title={t("failedToLoadCode")} message={error.message} onRetry={refetch} />;
  }

  if (!codeData || codeData.type === "sac") {
    return (
      <EmptyState title={t("nativeSACTitle")} description={t("nativeSACDescription")} icon="file" />
    );
  }

  if (!spec || spec.functions.length === 0) {
    return (
      <EmptyState
        title={t("noFunctionsTitle")}
        description={t("noFunctionsDescription")}
        icon="file"
      />
    );
  }

  const filteredFunctions = spec.functions.filter((fn) =>
    fn.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Wallet Bar & Spec Summary Card */}
      <Card className="border-border/80 bg-card/60 border backdrop-blur-sm">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 flex size-10 items-center justify-center rounded-lg">
                <Terminal className="text-primary size-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">{t("title")}</h3>
                <p className="text-muted-foreground text-xs">
                  {t("specSummary", {
                    functions: spec.functions.length,
                    structs: spec.structs.size,
                    unions: spec.unions.size,
                    enums: spec.enums.size,
                  })}
                </p>
              </div>
            </div>

            {/* Wallet Connection Controls */}
            <div className="flex items-center gap-2">
              {connectedPublicKey ? (
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="gap-1.5 border-green-500/40 bg-green-500/10 py-1 font-mono text-xs text-green-600 dark:text-green-400"
                  >
                    <CheckCircle2 className="size-3 text-green-500" />
                    {connectedPublicKey.slice(0, 4)}...{connectedPublicKey.slice(-4)}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive size-8"
                    onClick={handleDisconnectWallet}
                    title={t("disconnectWallet")}
                  >
                    <LogOut className="size-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleConnectWallet}
                  disabled={isConnecting}
                  className="gap-1.5 text-xs"
                >
                  <Wallet className="size-3.5" />
                  {isConnecting ? t("connecting") : t("connectWallet")}
                </Button>
              )}
            </div>
          </div>

          {walletError && <p className="text-destructive mt-2 text-xs">{walletError}</p>}
        </CardContent>
      </Card>

      {/* Filter / Search Bar */}
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          type="text"
          placeholder={t("filterFunctions")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 text-xs"
        />
      </div>

      {/* Functions List */}
      {filteredFunctions.length === 0 ? (
        <EmptyState
          title={t("noMatchingFunctions")}
          description={t("noMatchingFunctionsDescription", { query: searchQuery })}
          icon="file"
        />
      ) : (
        <div className="space-y-4">
          {filteredFunctions.map((fn) => (
            <FunctionForm
              key={fn.name}
              contractId={contractId}
              fn={fn}
              udtRegistry={spec.udtRegistry}
              network={network}
              connectedPublicKey={connectedPublicKey}
              onConnectWallet={handleConnectWallet}
            />
          ))}
        </div>
      )}
    </div>
  );
}
