"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TypedInput, getDefaultValue } from "./typed-input";
import { SpecFunction, SpecUdt, encodeInputToScVal } from "@/lib/stellar/spec-decoder";
import {
  simulateContractRead,
  simulateContractWrite,
  executeContractWrite,
  ReadCallResult,
  WriteSimulationResult,
  WriteExecutionResult,
} from "@/lib/stellar/contract-client";
import type { NetworkKey } from "@/types";
import { Play, Send, Check, Copy, AlertTriangle, Loader2, Wallet, Info } from "lucide-react";
import { useTranslations } from "next-intl";

interface FunctionFormProps {
  contractId: string;
  fn: SpecFunction;
  udtRegistry: Map<string, SpecUdt>;
  network: NetworkKey;
  connectedPublicKey: string | null;
  onConnectWallet: () => void;
}

export function FunctionForm({
  contractId,
  fn,
  udtRegistry,
  network,
  connectedPublicKey,
  onConnectWallet,
}: FunctionFormProps) {
  const t = useTranslations("contract.console");

  const [paramValues, setParamValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const input of fn.inputs) {
      initial[input.name] = getDefaultValue(input.type, udtRegistry);
    }
    return initial;
  });

  const [isLoadingRead, setIsLoadingRead] = useState(false);
  const [isLoadingWrite, setIsLoadingLoadingWrite] = useState(false);
  const [isSimulatingWrite, setIsSimulatingWrite] = useState(false);

  const [readResult, setReadResult] = useState<ReadCallResult | null>(null);
  const [writeSimResult, setWriteSimResult] = useState<WriteSimulationResult | null>(null);
  const [writeExecResult, setWriteExecResult] = useState<WriteExecutionResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleParamChange = (name: string, val: unknown) => {
    setParamValues((prev) => ({ ...prev, [name]: val }));
  };

  const getScValArgs = () => {
    return fn.inputs.map((input) =>
      encodeInputToScVal(paramValues[input.name], input.type, udtRegistry)
    );
  };

  const handleRead = async () => {
    setIsLoadingRead(true);
    setReadResult(null);
    try {
      const args = getScValArgs();
      const res = await simulateContractRead(network, contractId, fn.name, args);
      setReadResult(res);
    } catch (err: unknown) {
      console.error("[Contract Console Catch]", err);
      setReadResult({
        success: false,
        error: "simulationError",
      });
    } finally {
      setIsLoadingRead(false);
    }
  };

  const handleSimulateWrite = async () => {
    setIsSimulatingWrite(true);
    setWriteSimResult(null);
    try {
      const args = getScValArgs();
      const res = await simulateContractWrite(
        network,
        contractId,
        fn.name,
        args,
        connectedPublicKey || undefined
      );
      setWriteSimResult(res);
    } catch (err: unknown) {
      console.error("[Contract Console Catch]", err);
      setWriteSimResult({
        success: false,
        error: "resourceEstimationError",
      });
    } finally {
      setIsSimulatingWrite(false);
    }
  };

  const handleExecuteWrite = async () => {
    if (!connectedPublicKey) {
      onConnectWallet();
      return;
    }

    setIsLoadingLoadingWrite(true);
    setWriteExecResult(null);
    try {
      const args = getScValArgs();
      const res = await executeContractWrite(
        network,
        contractId,
        fn.name,
        args,
        connectedPublicKey
      );
      setWriteExecResult(res);
    } catch (err: unknown) {
      console.error("[Contract Console Catch]", err);
      setWriteExecResult({
        success: false,
        error: "submissionFailure",
      });
    } finally {
      setIsLoadingLoadingWrite(false);
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-border/80 border shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="font-mono text-base font-semibold">{fn.name}</CardTitle>
            <Badge variant="outline" className="font-mono text-[10px]">
              {fn.inputs.length} {fn.inputs.length === 1 ? "param" : "params"}
            </Badge>
          </div>
        </div>
        {fn.doc && <CardDescription className="text-xs">{fn.doc}</CardDescription>}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Function Parameter Inputs */}
        {fn.inputs.length > 0 ? (
          <div className="border-border/60 bg-muted/10 space-y-4 rounded-lg border p-4">
            <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              {t("inputParameters")}
            </p>
            <div className="space-y-4">
              {fn.inputs.map((input) => (
                <TypedInput
                  key={input.name}
                  specType={input.type}
                  udtRegistry={udtRegistry}
                  value={paramValues[input.name]}
                  onChange={(val) => handleParamChange(input.name, val)}
                  label={input.name}
                  doc={input.doc}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="border-border text-muted-foreground rounded-lg border border-dashed p-3 text-center text-xs">
            {t("noParametersRequired")}
          </div>
        )}

        {/* Action Controls */}
        <div className="border-border/60 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRead}
              disabled={isLoadingRead}
              className="gap-1.5 text-xs"
            >
              {isLoadingRead ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Play className="text-chart-1 size-3.5" />
              )}
              {t("simulateRead")}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleSimulateWrite}
              disabled={isSimulatingWrite}
              className="gap-1.5 text-xs"
            >
              {isSimulatingWrite ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Info className="text-chart-2 size-3.5" />
              )}
              {t("simulateResources")}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {connectedPublicKey ? (
              <Button
                variant="default"
                size="sm"
                onClick={handleExecuteWrite}
                disabled={isLoadingWrite}
                className="bg-primary text-primary-foreground gap-1.5 text-xs"
              >
                {isLoadingWrite ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                {t("submitWrite")}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={onConnectWallet}
                className="gap-1.5 border-amber-500/40 text-xs text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
              >
                <Wallet className="size-3.5" />
                {t("connectWalletToWrite")}
              </Button>
            )}
          </div>
        </div>

        {/* Write Simulation Resources Badge */}
        {writeSimResult && writeSimResult.success && (
          <div className="bg-muted/40 flex flex-wrap items-center gap-2 rounded-md p-2.5 text-xs">
            {" "}
            <Badge variant="outline" className="font-mono text-[10px]">
              {t("estimatedMinFee", { fee: writeSimResult.minFee || "100" })}
            </Badge>
            {writeSimResult.cpuInstructions && (
              <Badge variant="secondary" className="font-mono text-[10px]">
                {t("cpuInstructions", { cpu: writeSimResult.cpuInstructions })}
              </Badge>
            )}
            {writeSimResult.memoryBytes && (
              <Badge variant="secondary" className="font-mono text-[10px]">
                {t("readBytes", { bytes: writeSimResult.memoryBytes })}
              </Badge>
            )}
          </div>
        )}

        {/* Read Simulation Error */}
        {readResult && !readResult.success && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>{t("simulationError")}</AlertTitle>
            <AlertDescription className="font-mono text-xs">
              {t(readResult.error ?? "genericFailure")}
            </AlertDescription>
          </Alert>
        )}

        {/* Write Simulation Error */}
        {writeSimResult && !writeSimResult.success && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>{t("resourceEstimationError")}</AlertTitle>
            <AlertDescription className="font-mono text-xs">
              {t(writeSimResult.error ?? "genericFailure")}
            </AlertDescription>
          </Alert>
        )}

        {/* Write Execution Error */}
        {writeExecResult && !writeExecResult.success && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>{t("submissionFailure")}</AlertTitle>
            <AlertDescription className="font-mono text-xs">
              {t(writeExecResult.error ?? "genericFailure")}
            </AlertDescription>
          </Alert>
        )}

        {/* Read Call Result Display */}
        {readResult && readResult.success && (
          <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 dark:border-emerald-500/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {t("returnedResult")}
              </span>
              {readResult.resultXdr && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 text-[11px]"
                  onClick={() => handleCopyText(readResult.resultXdr || "")}
                >
                  {copied ? (
                    <>
                      <Check className="size-3 text-green-500" /> {t("copiedXDR")}
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" /> {t("copyXDR")}
                    </>
                  )}
                </Button>
              )}
            </div>

            <div className="bg-background border-border overflow-x-auto rounded border p-3 font-mono text-xs">
              <pre>
                {readResult.result !== null && readResult.result !== undefined
                  ? JSON.stringify(readResult.result, null, 2)
                  : t("voidNull")}
              </pre>
            </div>
          </div>
        )}

        {/* Write Execution Result Display */}
        {writeExecResult && writeExecResult.success && (
          <div className="space-y-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 dark:border-blue-500/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                {t("transactionExecuted")}
              </span>
              {writeExecResult.txHash && (
                <span className="text-muted-foreground font-mono text-xs">
                  Tx: {writeExecResult.txHash.slice(0, 10)}...{writeExecResult.txHash.slice(-10)}
                </span>
              )}
            </div>

            {writeExecResult.result !== undefined && (
              <div className="bg-background border-border overflow-x-auto rounded border p-3 font-mono text-xs">
                <pre>{JSON.stringify(writeExecResult.result, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
