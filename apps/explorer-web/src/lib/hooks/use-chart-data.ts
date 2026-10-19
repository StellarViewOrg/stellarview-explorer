"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useNetwork } from "@/lib/providers";
import { useLatestLedger } from "./use-stellar-query";
import {
  getTPSData,
  setTPSData,
  getTxHourlyData,
  setTxHourlyData,
  getHourTimestamp,
  getOpsPerLedgerData,
  setOpsPerLedgerData,
  type TPSDataPoint,
  type TxHourlyDataPoint,
} from "@/lib/utils/chart-storage";

export interface TPSChartData {
  data: TPSDataPoint[];
  currentTPS: number;
  isLoading: boolean;
}

export interface TxChartData {
  data: TxHourlyDataPoint[];
  isLoading: boolean;
  isCollecting: boolean;
}

export interface OpsPerLedgerChartData {
  data: { ledger: number; ops: number; txs: number }[];
  avgOps: number;
  isLoading: boolean;
}

// Hook for TPS chart data
export function useTPSChartData(): TPSChartData {
  const { network } = useNetwork();
  const { data: ledger, isLoading } = useLatestLedger();
  const [tpsData, setTpsDataState] = useState<TPSDataPoint[]>(() => getTPSData(network));
  const [loadedNetwork, setLoadedNetwork] = useState(network);
  const [currentTPS, setCurrentTPS] = useState(0);
  const prevLedgerRef = useRef<{ sequence: number; closedAt: string } | null>(null);

  // Reload stored data when the network changes (adjusting state during render)
  if (loadedNetwork !== network) {
    setLoadedNetwork(network);
    setTpsDataState(getTPSData(network));
  }

  useEffect(() => {
    if (!ledger) return;

    const currentLedger = {
      sequence: ledger.sequence,
      closedAt: ledger.closed_at,
    };

    // Calculate TPS if we have previous ledger
    if (prevLedgerRef.current && prevLedgerRef.current.sequence !== currentLedger.sequence) {
      const prevTime = new Date(prevLedgerRef.current.closedAt).getTime();
      const currTime = new Date(currentLedger.closedAt).getTime();
      const timeDelta = (currTime - prevTime) / 1000; // seconds

      if (timeDelta > 0) {
        const tps = ledger.successful_transaction_count / timeDelta;
        const newPoint: TPSDataPoint = {
          timestamp: currTime,
          tps: Math.round(tps * 100) / 100, // Round to 2 decimal places
        };

        setTpsDataState((prev) => {
          const updated = [...prev, newPoint].slice(-30);
          setTPSData(network, updated);
          return updated;
        });

        setCurrentTPS(newPoint.tps);
      }
    }

    prevLedgerRef.current = currentLedger;
  }, [ledger, network]);

  return {
    data: tpsData,
    currentTPS,
    isLoading,
  };
}

// Hook for accumulated transaction chart data
export function useTxChartData(): TxChartData {
  const { network } = useNetwork();
  const { data: ledger, isLoading } = useLatestLedger();
  const [txData, setTxDataState] = useState<TxHourlyDataPoint[]>(() => getTxHourlyData(network));
  const [loadedNetwork, setLoadedNetwork] = useState(network);
  const prevLedgerSeqRef = useRef<number | null>(null);

  // Reload stored data when the network changes (adjusting state during render)
  if (loadedNetwork !== network) {
    setLoadedNetwork(network);
    setTxDataState(getTxHourlyData(network));
  }

  useEffect(() => {
    if (!ledger || prevLedgerSeqRef.current === ledger.sequence) return;
    prevLedgerSeqRef.current = ledger.sequence;

    const hourTimestamp = getHourTimestamp(new Date(ledger.closed_at));
    const txCount = ledger.successful_transaction_count;

    setTxDataState((prev) => {
      // Find or create hourly bucket
      const existingIndex = prev.findIndex((d) => d.timestamp === hourTimestamp);
      let updated: TxHourlyDataPoint[];

      if (existingIndex >= 0) {
        // Add to existing bucket
        updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          count: updated[existingIndex].count + txCount,
        };
      } else {
        // Create new bucket
        updated = [...prev, { timestamp: hourTimestamp, count: txCount }];
      }

      // Sort by timestamp and prune old data
      updated.sort((a, b) => a.timestamp - b.timestamp);
      setTxHourlyData(network, updated);
      return updated;
    });
  }, [ledger, network]);

  return {
    data: txData,
    isLoading,
    isCollecting: txData.length < 2,
  };
}

// Hook for ops-per-ledger chart data
export function useOpsPerLedgerChartData(): OpsPerLedgerChartData {
  const { network } = useNetwork();
  const { data: ledger, isLoading } = useLatestLedger();
  const [ledgerData, setLedgerData] = useState<{ ledger: number; ops: number; txs: number }[]>(() =>
    getOpsPerLedgerData(network)
  );
  const [loadedNetwork, setLoadedNetwork] = useState(network);
  const [lastLedgerSeq, setLastLedgerSeq] = useState<number | null>(null);

  // Reload stored data on network change and append each new ledger
  // (adjusting state during render instead of in an effect)
  const networkChanged = loadedNetwork !== network;
  const ledgerChanged = !!ledger && ledger.sequence !== lastLedgerSeq;
  if (networkChanged || ledgerChanged) {
    let next = networkChanged ? getOpsPerLedgerData(network) : ledgerData;
    if (networkChanged) setLoadedNetwork(network);
    if (ledger && ledgerChanged) {
      setLastLedgerSeq(ledger.sequence);
      if (!next.some((d) => d.ledger === ledger.sequence)) {
        const newPoint = {
          ledger: ledger.sequence,
          ops: ledger.operation_count,
          txs: ledger.successful_transaction_count + ledger.failed_transaction_count,
        };
        next = [...next, newPoint].slice(-20);
      }
    }
    if (next !== ledgerData) setLedgerData(next);
  }

  // Persist to storage (syncing an external system)
  useEffect(() => {
    setOpsPerLedgerData(network, ledgerData);
  }, [network, ledgerData]);

  const avgOps = useMemo(() => {
    if (ledgerData.length === 0) return 0;
    return Math.round(ledgerData.reduce((sum, d) => sum + d.ops, 0) / ledgerData.length);
  }, [ledgerData]);

  return { data: ledgerData, avgOps, isLoading };
}
