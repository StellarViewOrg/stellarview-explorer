import type { NetworkKey } from "@/types";
import type { Horizon, xdr } from "@stellar/stellar-sdk";
import { getHorizonClient, getRpcClient, fetchStellarExpert } from "./client";
import type { StellarExpertResult } from "./client";
import { DEFAULT_PAGE_SIZE, STALE_TIME, POPULAR_ASSETS, NETWORKS } from "@/lib/constants";
import { parseSacAssetName } from "@/lib/utils";
import { resolveDomain } from "./domains";
import type { DomainResolution } from "./domains";
import {
  fetchTimeSeries,
  fetchTopN,
  fetchPairs,
  fetchCandles,
  fetchPoolDepth,
  fetchDomainsByAddress,
  fetchDomainsList,
  fetchDomainDetail,
  DOMAINS_DEFAULT_PAGE_SIZE,
  fetchVerificationStatus,
  fetchVerificationSourceTree,
  fetchVerificationSourceFile,
} from "@/lib/indexer";
import type {
  TimeSeriesMetric,
  TopNMetric,
  Resolution,
  TimeWindow,
  IndexerResult,
  TimeSeriesResponse,
  TopNResponse,
  CandleResolution,
  PairsResponse,
  CandlesResponse,
  PoolDepthResponse,
  DomainReverseLookup,
  DomainsPage,
  DomainDetail,
  DomainStatus,
  VerificationRecord,
  SourceFileMeta,
  SourceFileContent,
} from "@/lib/indexer";

// Stellar Expert API response shapes
export interface StellarExpertAssetAnalytics {
  asset: string;
  created: number;
  supply: number;
  payments: number;
  payments_amount: number;
  trades: number;
  trades_amount: number;
  rating?: { average: number; criteria?: Record<string, number> };
  volume7d?: number;
  volume30d?: number;
  price?: number;
  price7d?: number;
  price30d?: number;
}

export interface StellarExpertAccountProfile {
  id: string;
  created: number;
  payments: number;
  trades: number;
  home_domain?: string;
  assets_created?: number;
  merge_history?: number[];
}

export interface StellarExpertNetworkActivity {
  history: Array<{
    date: number;
    transactions_count: number;
    operations_count: number;
    payments_amount: number;
    trades_count: number;
    active_accounts: number;
    new_accounts: number;
    network_fees: number;
    average_fee: number;
    ledgers_count: number;
  }>;
}

export interface StellarExpertNetworkStats {
  ledgers_count: number;
  transactions_count: number;
  operations_count: number;
  payments_count: number;
  payments_amount: number;
  trades_count: number;
  total_accounts: number;
  active_accounts: number;
  total_assets: number;
  horizon_version: string;
  core_version: string;
  protocol_version: number;
  base_reserve: number;
  base_fee: number;
}

// Query key factory for consistent cache keys
export const stellarKeys = {
  all: ["stellar"] as const,
  network: (network: NetworkKey) => [...stellarKeys.all, network] as const,

  // Ledgers
  ledgers: (network: NetworkKey) => [...stellarKeys.network(network), "ledgers"] as const,
  ledger: (network: NetworkKey, sequence: number) =>
    [...stellarKeys.ledgers(network), sequence] as const,
  latestLedger: (network: NetworkKey) => [...stellarKeys.ledgers(network), "latest"] as const,

  // Transactions
  transactions: (network: NetworkKey) => [...stellarKeys.network(network), "transactions"] as const,
  transaction: (network: NetworkKey, hash: string) =>
    [...stellarKeys.transactions(network), hash] as const,
  transactionOperations: (network: NetworkKey, hash: string) =>
    [...stellarKeys.transaction(network, hash), "operations"] as const,
  transactionEffects: (network: NetworkKey, hash: string) =>
    [...stellarKeys.transaction(network, hash), "effects"] as const,
  recentTransactions: (network: NetworkKey, limit?: number) =>
    [...stellarKeys.transactions(network), "recent", limit] as const,

  // Accounts
  accounts: (network: NetworkKey) => [...stellarKeys.network(network), "accounts"] as const,
  account: (network: NetworkKey, id: string) => [...stellarKeys.accounts(network), id] as const,
  accountTransactions: (network: NetworkKey, id: string, cursor?: string) =>
    [...stellarKeys.account(network, id), "transactions", cursor] as const,
  accountOperations: (network: NetworkKey, id: string, cursor?: string) =>
    [...stellarKeys.account(network, id), "operations", cursor] as const,
  accountEffects: (network: NetworkKey, id: string, cursor?: string) =>
    [...stellarKeys.account(network, id), "effects", cursor] as const,

  // Assets
  assets: (network: NetworkKey) => [...stellarKeys.network(network), "assets"] as const,
  asset: (network: NetworkKey, code: string, issuer: string) =>
    [...stellarKeys.assets(network), code, issuer] as const,
  assetsList: (network: NetworkKey, cursor?: string) =>
    [...stellarKeys.assets(network), "list", cursor] as const,
  assetTrades: (network: NetworkKey, code: string, issuer: string) =>
    [...stellarKeys.asset(network, code, issuer), "trades"] as const,
  assetOrderbook: (
    network: NetworkKey,
    code: string,
    issuer: string,
    counterCode = "XLM",
    counterIssuer = "native"
  ) =>
    [...stellarKeys.asset(network, code, issuer), "orderbook", counterCode, counterIssuer] as const,
  topAssets: (network: NetworkKey) => [...stellarKeys.assets(network), "top"] as const,

  // Contracts (Soroban)
  contracts: (network: NetworkKey) => [...stellarKeys.network(network), "contracts"] as const,
  contract: (network: NetworkKey, id: string) => [...stellarKeys.contracts(network), id] as const,
  contractEvents: (network: NetworkKey, id: string) =>
    [...stellarKeys.contract(network, id), "events"] as const,
  contractCode: (network: NetworkKey, id: string) =>
    [...stellarKeys.contract(network, id), "code"] as const,
  contractStorage: (network: NetworkKey, id: string) =>
    [...stellarKeys.contract(network, id), "storage"] as const,
  contractInvocations: (network: NetworkKey, id: string) =>
    [...stellarKeys.contract(network, id), "invocations"] as const,
  contractBalance: (network: NetworkKey, id: string) =>
    [...stellarKeys.contract(network, id), "balance"] as const,
  contractSacAsset: (network: NetworkKey, id: string) =>
    [...stellarKeys.contract(network, id), "sac-asset"] as const,

  // Indexer: reproducible source verification (indexer#48)
  contractVerification: (network: NetworkKey, wasmHash: string) =>
    [...stellarKeys.network(network), "indexer", "verification", wasmHash] as const,
  verificationSourceTree: (network: NetworkKey, wasmHash: string) =>
    [...stellarKeys.network(network), "indexer", "verification", wasmHash, "source"] as const,
  verificationSourceFile: (network: NetworkKey, wasmHash: string, path: string) =>
    [...stellarKeys.network(network), "indexer", "verification", wasmHash, "source", path] as const,

  // Fee stats
  feeStats: (network: NetworkKey) => [...stellarKeys.network(network), "feeStats"] as const,

  // Account extensions
  accountOffers: (network: NetworkKey, id: string, cursor?: string) =>
    [...stellarKeys.account(network, id), "offers", cursor] as const,
  accountDataEntries: (network: NetworkKey, id: string) =>
    [...stellarKeys.account(network, id), "data"] as const,

  // Liquidity pools
  liquidityPools: (network: NetworkKey) =>
    [...stellarKeys.network(network), "liquidity_pools"] as const,
  liquidityPool: (network: NetworkKey, id: string) =>
    [...stellarKeys.network(network), "liquidity_pools", id] as const,
  liquidityPoolsList: (network: NetworkKey, cursor?: string) =>
    [...stellarKeys.network(network), "liquidity_pools", "list", cursor] as const,
  assetLiquidityPools: (network: NetworkKey, code: string, issuer: string) =>
    [...stellarKeys.asset(network, code, issuer), "liquidity_pools"] as const,
  liquidityPoolTransactions: (network: NetworkKey, id: string) =>
    [...stellarKeys.network(network), "liquidity_pools", id, "transactions"] as const,
  liquidityPoolActivity: (network: NetworkKey, id: string) =>
    [...stellarKeys.network(network), "liquidity_pools", id, "activity"] as const,

  // Indexer: liquidity pool depth history (indexer#31, provisional contract)
  poolDepth: (
    network: NetworkKey,
    poolId: string,
    resolution: CandleResolution,
    from: string,
    to: string
  ) =>
    [
      ...stellarKeys.network(network),
      "indexer",
      "dex",
      "pool-depth",
      poolId,
      resolution,
      from,
      to,
    ] as const,

  // Claimable balances
  claimableBalancesList: (
    network: NetworkKey,
    assetCode?: string,
    assetIssuer?: string,
    cursor?: string
  ) =>
    [
      ...stellarKeys.network(network),
      "claimable_balances",
      "list",
      assetCode,
      assetIssuer,
      cursor,
    ] as const,
  assetClaimableBalances: (network: NetworkKey, code: string, issuer: string) =>
    [...stellarKeys.asset(network, code, issuer), "claimable_balances"] as const,

  // RPC network info
  rpcNetworkInfo: (network: NetworkKey) =>
    [...stellarKeys.network(network), "rpc_network_info"] as const,

  // Stellar Expert
  assetAnalytics: (network: NetworkKey, code: string, issuer: string) =>
    [...stellarKeys.network(network), "stellar_expert", "asset", code, issuer] as const,
  accountProfile: (network: NetworkKey, id: string) =>
    [...stellarKeys.network(network), "stellar_expert", "account", id] as const,
  networkActivity: (network: NetworkKey) =>
    [...stellarKeys.network(network), "stellar_expert", "network_activity"] as const,
  networkStats: (network: NetworkKey) =>
    [...stellarKeys.network(network), "stellar_expert", "stats"] as const,

  // Soroban Domains forward resolution
  domainResolution: (network: NetworkKey, name: string) =>
    [...stellarKeys.network(network), "domain", name] as const,

  // Indexer: Soroban Domains reverse lookup and browsing
  domainsByAddress: (network: NetworkKey, address: string) =>
    [...stellarKeys.network(network), "indexer", "domains", "address", address] as const,

  domainsList: (network: NetworkKey, status: DomainStatus | "all", cursor: string) =>
    [...stellarKeys.network(network), "indexer", "domains", "list", status, cursor] as const,
  domainDetail: (network: NetworkKey, name: string) =>
    [...stellarKeys.network(network), "indexer", "domains", "detail", name] as const,

  // Indexer analytics
  indexerTimeSeries: (
    network: NetworkKey,
    metric: TimeSeriesMetric,
    resolution: Resolution,
    from: string,
    to: string
  ) =>
    [
      ...stellarKeys.network(network),
      "indexer",
      "timeseries",
      metric,
      resolution,
      from,
      to,
    ] as const,
  indexerTopN: (network: NetworkKey, metric: TopNMetric, window: TimeWindow, limit: number) =>
    [...stellarKeys.network(network), "indexer", "top", metric, window, limit] as const,

  // Indexer: DEX pairs & candles (indexer#31, provisional contract)
  dexPairsList: (network: NetworkKey, limit: number) =>
    [...stellarKeys.network(network), "indexer", "dex", "pairs", limit] as const,
  pairCandles: (
    network: NetworkKey,
    pairId: string,
    resolution: CandleResolution,
    from: string,
    to: string
  ) =>
    [
      ...stellarKeys.network(network),
      "indexer",
      "dex",
      "candles",
      pairId,
      resolution,
      from,
      to,
    ] as const,

  // Trades and orderbook for an arbitrary pair (generalizes assetTrades/assetOrderbook,
  // which are hardcoded against XLM as counter, to any base/counter combination)
  pairTrades: (
    network: NetworkKey,
    baseCode: string,
    baseIssuer: string,
    counterCode: string,
    counterIssuer: string
  ) =>
    [
      ...stellarKeys.network(network),
      "pair_trades",
      baseCode,
      baseIssuer,
      counterCode,
      counterIssuer,
    ] as const,
};

// Query option factories for TanStack Query
export const stellarQueries = {
  // Ledgers
  latestLedger: (network: NetworkKey) => ({
    queryKey: stellarKeys.latestLedger(network),
    queryFn: async () => {
      const horizon = getHorizonClient(network);
      const response = await horizon.ledgers().order("desc").limit(1).call();
      return response.records[0];
    },
    staleTime: 0,
  }),

  ledger: (network: NetworkKey, sequence: number) => ({
    queryKey: stellarKeys.ledger(network, sequence),
    queryFn: async () => {
      const horizon = getHorizonClient(network);
      // SDK types .ledger(seq).call() as CollectionPage but it returns a single record
      const response = await horizon.ledgers().ledger(sequence).call();
      return response as unknown as Horizon.ServerApi.LedgerRecord;
    },
    staleTime: Infinity, // Ledgers are immutable
  }),

  ledgerTransactions: (network: NetworkKey, sequence: number, limit = DEFAULT_PAGE_SIZE) => ({
    queryKey: [...stellarKeys.ledger(network, sequence), "transactions"],
    queryFn: async () => {
      const horizon = getHorizonClient(network);
      return horizon.transactions().forLedger(sequence).limit(limit).order("desc").call();
    },
    staleTime: Infinity,
  }),

  // Transactions
  recentTransactions: (network: NetworkKey, limit = 10) => ({
    queryKey: stellarKeys.recentTransactions(network, limit),
    queryFn: async () => {
      const horizon = getHorizonClient(network);
      return horizon.transactions().order("desc").limit(limit).call();
    },
    staleTime: STALE_TIME,
  }),

  transaction: (network: NetworkKey, hash: string) => ({
    queryKey: stellarKeys.transaction(network, hash),
    queryFn: async () => {
      const horizon = getHorizonClient(network);
      return horizon.transactions().transaction(hash).call();
    },
    staleTime: Infinity, // Transactions are immutable
  }),

  transactionOperations: (network: NetworkKey, hash: string) => ({
    queryKey: stellarKeys.transactionOperations(network, hash),
    queryFn: async () => {
      const horizon = getHorizonClient(network);
      return horizon.operations().forTransaction(hash).limit(200).call();
    },
    staleTime: Infinity,
  }),

  transactionEffects: (network: NetworkKey, hash: string) => ({
    queryKey: stellarKeys.transactionEffects(network, hash),
    queryFn: async () => {
      const horizon = getHorizonClient(network);
      return horizon.effects().forTransaction(hash).limit(200).call();
    },
    staleTime: Infinity,
  }),

  // Accounts
  account: (network: NetworkKey, id: string) => ({
    queryKey: stellarKeys.account(network, id),
    queryFn: async () => {
      const horizon = getHorizonClient(network);
      return horizon.accounts().accountId(id).call();
    },
    staleTime: STALE_TIME,
  }),

  accountTransactions: (
    network: NetworkKey,
    id: string,
    cursor?: string,
    limit = DEFAULT_PAGE_SIZE
  ) => ({
    queryKey: stellarKeys.accountTransactions(network, id, cursor),
    queryFn: async () => {
      const horizon = getHorizonClient(network);
      let builder = horizon.transactions().forAccount(id).order("desc").limit(limit);
      if (cursor) {
        builder = builder.cursor(cursor);
      }
      return builder.call();
    },
    staleTime: STALE_TIME,
  }),

  accountOperations: (
    network: NetworkKey,
    id: string,
    cursor?: string,
    limit = DEFAULT_PAGE_SIZE
  ) => ({
    queryKey: stellarKeys.accountOperations(network, id, cursor),
    queryFn: async () => {
      const horizon = getHorizonClient(network);
      let builder = horizon.operations().forAccount(id).order("desc").limit(limit);
      if (cursor) {
        builder = builder.cursor(cursor);
      }
      return builder.call();
    },
    staleTime: STALE_TIME,
  }),

  // Assets
  asset: (network: NetworkKey, code: string, issuer: string) => ({
    queryKey: stellarKeys.asset(network, code, issuer),
    queryFn: async () => {
      const horizon = getHorizonClient(network);
      const response = await horizon.assets().forCode(code).forIssuer(issuer).call();
      return response.records[0];
    },
    staleTime: STALE_TIME,
  }),

  assetAccounts: (
    network: NetworkKey,
    code: string,
    issuer: string,
    limit = DEFAULT_PAGE_SIZE
  ) => ({
    queryKey: [...stellarKeys.asset(network, code, issuer), "accounts"],
    queryFn: async () => {
      const horizon = getHorizonClient(network);
      const { Asset } = await import("@stellar/stellar-sdk");
      // Get accounts that hold this asset
      const asset = code === "XLM" ? Asset.native() : new Asset(code, issuer);
      return horizon.accounts().forAsset(asset).limit(limit).call();
    },
    staleTime: STALE_TIME,
  }),

  // Assets list with pagination
  assetsList: (network: NetworkKey, cursor?: string, limit = 20) => ({
    queryKey: stellarKeys.assetsList(network, cursor),
    queryFn: async () => {
      const horizon = getHorizonClient(network);
      let builder = horizon.assets().order("desc").limit(limit);
      if (cursor) {
        builder = builder.cursor(cursor);
      }
      return builder.call();
    },
    staleTime: STALE_TIME,
  }),

  // Trade aggregations for an asset (24h volume)
  assetTradeAggregations: (
    network: NetworkKey,
    baseCode: string,
    baseIssuer: string,
    counterCode = "XLM",
    counterIssuer?: string
  ) => ({
    queryKey: stellarKeys.assetTrades(network, baseCode, baseIssuer),
    queryFn: async () => {
      const horizon = getHorizonClient(network);
      const { Asset } = await import("@stellar/stellar-sdk");

      const baseAsset = baseCode === "XLM" ? Asset.native() : new Asset(baseCode, baseIssuer);
      if (counterCode !== "XLM" && !counterIssuer) {
        throw new Error("counterIssuer is required for non-XLM counter assets");
      }
      const counterAsset =
        counterCode === "XLM" ? Asset.native() : new Asset(counterCode, counterIssuer as string);

      // Get 24h trade aggregations (1 hour resolution)
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;

      const response = await horizon
        .tradeAggregation(baseAsset, counterAsset, oneDayAgo, now, 3600000, 0)
        .limit(24)
        .call();

      // Calculate 24h stats
      let volume24h = 0;
      let high24h = 0;
      let low24h = Infinity;
      let open24h = 0;
      let close24h = 0;

      if (response.records.length > 0) {
        open24h = parseFloat(response.records[0].open);
        close24h = parseFloat(response.records[response.records.length - 1].close);

        for (const record of response.records) {
          volume24h += parseFloat(record.base_volume);
          const recordHigh = parseFloat(record.high);
          const recordLow = parseFloat(record.low);
          if (recordHigh > high24h) high24h = recordHigh;
          if (recordLow < low24h) low24h = recordLow;
        }
      }

      const priceChange24h = open24h > 0 ? ((close24h - open24h) / open24h) * 100 : 0;

      return {
        records: response.records,
        volume24h,
        high24h: high24h === 0 ? null : high24h,
        low24h: low24h === Infinity ? null : low24h,
        open24h: open24h || null,
        close24h: close24h || null,
        priceChange24h,
        tradeCount: response.records.reduce(
          (acc, r) =>
            acc + (typeof r.trade_count === "string" ? parseInt(r.trade_count, 10) : r.trade_count),
          0
        ),
      };
    },
    staleTime: 30_000, // 30s — matches orderbook freshness so asset page shows consistent data age
  }),

  // Orderbook for an asset pair
  assetOrderbook: (
    network: NetworkKey,
    sellingCode: string,
    sellingIssuer: string,
    buyingCode = "XLM",
    buyingIssuer?: string
  ) => ({
    queryKey: stellarKeys.assetOrderbook(
      network,
      sellingCode,
      sellingIssuer,
      buyingCode,
      buyingCode === "XLM" ? "native" : buyingIssuer
    ),
    queryFn: async () => {
      const horizon = getHorizonClient(network);
      const { Asset } = await import("@stellar/stellar-sdk");

      const sellingAsset =
        sellingCode === "XLM" ? Asset.native() : new Asset(sellingCode, sellingIssuer);
      if (buyingCode !== "XLM" && !buyingIssuer) {
        throw new Error("buyingIssuer is required for non-XLM buying assets");
      }
      const buyingAsset =
        buyingCode === "XLM" ? Asset.native() : new Asset(buyingCode, buyingIssuer as string);

      const response = await horizon.orderbook(sellingAsset, buyingAsset).limit(10).call();

      // Calculate spread and mid price
      const bestBid = response.bids[0] ? parseFloat(response.bids[0].price) : null;
      const bestAsk = response.asks[0] ? parseFloat(response.asks[0].price) : null;
      const midPrice = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : null;
      const spread = bestBid && bestAsk ? ((bestAsk - bestBid) / bestAsk) * 100 : null;

      return {
        bids: response.bids,
        asks: response.asks,
        bestBid,
        bestAsk,
        midPrice,
        spread,
      };
    },
    staleTime: 30_000, // 30s — matches trades freshness so asset page shows consistent data age
  }),

  // Top assets - fetch popular assets and enrich with data
  topAssets: (network: NetworkKey) => ({
    queryKey: stellarKeys.topAssets(network),
    queryFn: async () => {
      const horizon = getHorizonClient(network);
      const { Asset } = await import("@stellar/stellar-sdk");

      const popularAssets = POPULAR_ASSETS;

      // Fetch asset info for each
      const assetsData = await Promise.all(
        popularAssets.map(async ({ code, issuer }) => {
          try {
            const assetResponse = await horizon.assets().forCode(code).forIssuer(issuer).call();
            const assetRecord = assetResponse.records[0];

            if (!assetRecord) return null;

            // Get 24h trade data against XLM
            const baseAsset = new Asset(code, issuer);
            const counterAsset = Asset.native();
            const now = Date.now();
            const oneDayAgo = now - 24 * 60 * 60 * 1000;

            let volume24h = 0;
            let priceChange24h = 0;
            let currentPrice = 0;

            try {
              const trades = await horizon
                .tradeAggregation(baseAsset, counterAsset, oneDayAgo, now, 86400000, 0)
                .limit(1)
                .call();

              if (trades.records.length > 0) {
                const record = trades.records[0];
                volume24h = parseFloat(record.base_volume);
                const open = parseFloat(record.open);
                const close = parseFloat(record.close);
                currentPrice = close;
                priceChange24h = open > 0 ? ((close - open) / open) * 100 : 0;
              }
            } catch (err) {
              console.warn(`[topAssets] trade data unavailable for ${code}-${issuer}:`, err);
            }

            // Calculate total accounts (authorized + authorized_to_maintain_liabilities)
            const numAccounts =
              assetRecord.accounts.authorized +
              assetRecord.accounts.authorized_to_maintain_liabilities;

            return {
              code: assetRecord.asset_code,
              issuer: assetRecord.asset_issuer,
              assetType: assetRecord.asset_type,
              numAccounts,
              amount: parseFloat(assetRecord.balances.authorized),
              volume24h,
              priceChange24h,
              currentPrice,
              flags: assetRecord.flags,
            };
          } catch (err) {
            console.warn(`[topAssets] failed to load asset ${code}-${issuer}:`, err);
            return null;
          }
        })
      );

      // Filter out null values and sort by num_accounts
      return assetsData.filter(Boolean).sort((a, b) => b!.numAccounts - a!.numAccounts);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  }),

  // Fee stats
  feeStats: (network: NetworkKey) => ({
    queryKey: stellarKeys.feeStats(network),
    queryFn: async () => {
      const horizon = getHorizonClient(network);
      return horizon.feeStats();
    },
    staleTime: STALE_TIME,
  }),

  // Soroban contract data
  contractInfo: (network: NetworkKey, contractId: string) => ({
    queryKey: stellarKeys.contract(network, contractId),
    queryFn: async () => {
      const { Contract } = await import("@stellar/stellar-sdk");
      const contract = new Contract(contractId);
      const ledgerKey = contract.getFootprint();

      const rpcClient = getRpcClient(network);
      const response = await rpcClient.getLedgerEntries(ledgerKey);
      return response.entries;
    },
    staleTime: STALE_TIME,
  }),

  contractEvents: (network: NetworkKey, contractId: string, startLedger?: number) => ({
    queryKey: stellarKeys.contractEvents(network, contractId),
    queryFn: async () => {
      const { scValToNative } = await import("@stellar/stellar-sdk");

      // SDK already parses topic and value as xdr.ScVal objects
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const decodeScValSafe = (scVal: any): { type: string; value: unknown } => {
        if (!scVal || typeof scVal.switch !== "function") {
          return { type: "unknown", value: String(scVal) };
        }
        const type = scVal.switch().name;
        try {
          const native = scValToNative(scVal);
          if (typeof native === "bigint") {
            return { type, value: native.toString() };
          }
          return { type, value: native };
        } catch {
          return { type, value: scVal.toXDR("base64") };
        }
      };

      const rpc = getRpcClient(network);

      // Determine start ledger from the RPC retention window (~7 days)
      let ledger = startLedger;
      if (!ledger) {
        const probe = await rpc.getEvents({
          startLedger: (await rpc.getLatestLedger()).sequence - 10,
          filters: [{ type: "contract", contractIds: [contractId] }],
          limit: 1,
        });
        if (probe.oldestLedger && probe.latestLedger) {
          ledger = probe.oldestLedger;
        } else {
          const latest = await rpc.getLatestLedger();
          ledger = latest.sequence - 17_280; // ~24h fallback
        }
      }

      // Fetch events with cursor-based pagination (up to 1000 events, keep latest 100)
      const response = await rpc.getEvents({
        startLedger: ledger,
        filters: [{ type: "contract", contractIds: [contractId] }],
        limit: 100,
      });

      let allEvents = response.events ?? [];
      if (allEvents.length === 100) {
        let cursor = response.cursor;
        let lastBatch = allEvents;
        for (let i = 0; i < 9 && lastBatch.length === 100 && cursor; i++) {
          const nextPage = await rpc.getEvents({
            cursor,
            filters: [{ type: "contract", contractIds: [contractId] }],
            limit: 100,
          });
          lastBatch = nextPage.events ?? [];
          allEvents = allEvents.concat(lastBatch);
          cursor = nextPage.cursor;
        }
        if (allEvents.length > 100) {
          allEvents = allEvents.slice(-100);
        }
      }

      return {
        events: allEvents.map((event) => {
          try {
            return {
              id: event.id,
              type: event.type,
              ledger: event.ledger,
              ledgerClosedAt: event.ledgerClosedAt,
              txHash: event.txHash,
              decodedTopics: event.topic?.map((t) => decodeScValSafe(t)) ?? [],
              decodedValue: event.value ? decodeScValSafe(event.value) : null,
            };
          } catch {
            return {
              id: event.id,
              type: event.type,
              ledger: event.ledger,
              ledgerClosedAt: event.ledgerClosedAt,
              txHash: event.txHash,
              decodedTopics: [],
              decodedValue: null,
            };
          }
        }),
      };
    },
    staleTime: STALE_TIME,
  }),

  contractCode: (network: NetworkKey, contractId: string) => ({
    queryKey: stellarKeys.contractCode(network, contractId),
    queryFn: async () => {
      const { Contract, xdr } = await import("@stellar/stellar-sdk");

      const contract = new Contract(contractId);
      const contractInstanceKey = xdr.LedgerKey.contractData(
        new xdr.LedgerKeyContractData({
          contract: contract.address().toScAddress(),
          key: xdr.ScVal.scvLedgerKeyContractInstance(),
          durability: xdr.ContractDataDurability.persistent(),
        })
      );

      const rpc = getRpcClient(network);
      const instanceResponse = await rpc.getLedgerEntries(contractInstanceKey);

      if (!instanceResponse.entries || instanceResponse.entries.length === 0) {
        throw new Error("Contract instance not found");
      }

      const instanceEntry = instanceResponse.entries[0];
      const contractData = instanceEntry.val.contractData();
      const contractInstance = contractData.val().instance();
      const executable = contractInstance.executable();

      if (executable.switch().name !== "contractExecutableWasm") {
        return {
          type: "sac" as const,
          wasmHash: null,
          wasmCode: null,
          wasmCodeHex: null,
          codeSize: 0,
        };
      }

      const wasmHash = executable.wasmHash();
      const wasmHashHex = wasmHash.toString("hex");

      const wasmCodeKey = xdr.LedgerKey.contractCode(
        new xdr.LedgerKeyContractCode({ hash: wasmHash })
      );

      const codeResponse = await rpc.getLedgerEntries(wasmCodeKey);

      if (!codeResponse.entries || codeResponse.entries.length === 0) {
        throw new Error("Contract WASM code not found");
      }

      const codeEntry = codeResponse.entries[0];
      const contractCode = codeEntry.val.contractCode();
      const wasmCode = contractCode.code();
      const wasmCodeHex = wasmCode.toString("hex");

      return {
        type: "wasm" as const,
        wasmHash: wasmHashHex,
        wasmCode: wasmCode,
        wasmCodeHex: wasmCodeHex,
        codeSize: wasmCode.length,
      };
    },
    staleTime: Infinity, // Contract code is immutable
  }),

  // Resolve a Stellar Asset Contract (SAC) to the classic asset it wraps, by
  // invoking its `name()` function via a read-only RPC simulation (no
  // signing/submission — the source account only needs a valid address).
  // Callers should gate this on `contractCode(...).type === "sac"`.
  contractSacAsset: (network: NetworkKey, contractId: string) => ({
    queryKey: stellarKeys.contractSacAsset(network, contractId),
    queryFn: async (): Promise<{ code: string; issuer: string } | null> => {
      const { Contract, TransactionBuilder, Account, Keypair, BASE_FEE, scValToNative, rpc } =
        await import("@stellar/stellar-sdk");

      const contract = new Contract(contractId);
      const sourceAccount = new Account(Keypair.random().publicKey(), "0");
      const tx = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: NETWORKS[network].passphrase,
      })
        .addOperation(contract.call("name"))
        .setTimeout(30)
        .build();

      const rpcClient = getRpcClient(network);
      const sim = await rpcClient.simulateTransaction(tx);

      if (!rpc.Api.isSimulationSuccess(sim) || !sim.result?.retval) {
        return null;
      }

      const name = scValToNative(sim.result.retval);
      return typeof name === "string" ? parseSacAssetName(name) : null;
    },
    staleTime: Infinity, // the classic asset a SAC wraps never changes
    retry: false, // a non-token WASM contract will legitimately fail simulation; don't retry
  }),

  // Indexer: reproducible source verification lookup, keyed by wasm_hash
  // (indexer#48). `data: null` means "available but not verified" — a
  // legitimate answer, not an error.
  contractVerification: (network: NetworkKey, wasmHash: string) => ({
    queryKey: stellarKeys.contractVerification(network, wasmHash),
    queryFn: (): Promise<IndexerResult<VerificationRecord | null>> =>
      fetchVerificationStatus(wasmHash),
    staleTime: 60_000,
    retry: 1,
  }),

  // Indexer: the file tree (path + size) of a verified contract's source.
  verificationSourceTree: (network: NetworkKey, wasmHash: string) => ({
    queryKey: stellarKeys.verificationSourceTree(network, wasmHash),
    queryFn: (): Promise<IndexerResult<SourceFileMeta[]>> => fetchVerificationSourceTree(wasmHash),
    staleTime: Infinity, // verified source for a given wasm_hash never changes
    retry: 1,
  }),

  // Indexer: one source file's content from a verified contract's source tree.
  verificationSourceFile: (network: NetworkKey, wasmHash: string, path: string) => ({
    queryKey: stellarKeys.verificationSourceFile(network, wasmHash, path),
    queryFn: (): Promise<IndexerResult<SourceFileContent>> =>
      fetchVerificationSourceFile(wasmHash, path),
    staleTime: Infinity, // verified source for a given wasm_hash never changes
    retry: 1,
  }),

  // Contract invocation history via Horizon (InvokeHostFunction operations)
  contractInvocations: (network: NetworkKey, contractId: string, limit = DEFAULT_PAGE_SIZE) => ({
    queryKey: stellarKeys.contractInvocations(network, contractId),
    queryFn: async () => {
      const horizon = getHorizonClient(network);
      const response = await horizon
        .operations()
        .forAccount(contractId)
        .order("desc")
        .limit(limit)
        .call();
      const invocations = response.records.filter(
        (op) => (op as Horizon.ServerApi.BaseOperationRecord).type === "invoke_host_function"
      );
      return { records: invocations, total: response.records.length };
    },
    staleTime: STALE_TIME,
  }),

  // Contract XLM balance (contracts with active accounts)
  contractBalance: (network: NetworkKey, contractId: string) => ({
    queryKey: stellarKeys.contractBalance(network, contractId),
    queryFn: async () => {
      try {
        const horizon = getHorizonClient(network);
        const account = await horizon.accounts().accountId(contractId).call();
        const xlmBalance = account.balances.find(
          (b: Horizon.HorizonApi.BalanceLine) => b.asset_type === "native"
        );
        return { balance: xlmBalance ? xlmBalance.balance : "0", exists: true };
      } catch {
        return { balance: "0", exists: false };
      }
    },
    staleTime: STALE_TIME,
  }),

  // Account offers (open DEX orders)
  accountOffers: (network: NetworkKey, id: string, cursor?: string, limit = DEFAULT_PAGE_SIZE) => ({
    queryKey: stellarKeys.accountOffers(network, id, cursor),
    queryFn: async () => {
      const horizon = getHorizonClient(network);
      let builder = horizon.offers().forAccount(id).order("desc").limit(limit);
      if (cursor) builder = builder.cursor(cursor);
      return builder.call();
    },
    staleTime: STALE_TIME,
  }),

  // Last operations for a potentially-merged account (works even when account no longer exists)
  accountLastOperations: (network: NetworkKey, id: string) => ({
    queryKey: [...stellarKeys.account(network, id), "last_ops"],
    queryFn: async () => {
      const horizon = getHorizonClient(network);
      return horizon.operations().forAccount(id).order("desc").limit(5).call();
    },
    staleTime: Infinity,
    retry: 0,
  }),

  // Account data entries (decoded from base64)
  accountDataEntries: (network: NetworkKey, id: string) => ({
    queryKey: stellarKeys.accountDataEntries(network, id),
    queryFn: async () => {
      const horizon = getHorizonClient(network);
      const account = await horizon.accounts().accountId(id).call();
      return Object.entries(account.data ?? {}).map(([key, value]) => ({
        key,
        value: Buffer.from(value, "base64").toString("utf-8"),
        raw: value,
      }));
    },
    staleTime: STALE_TIME,
  }),

  // Liquidity pool by ID
  liquidityPool: (network: NetworkKey, id: string) => ({
    queryKey: stellarKeys.liquidityPool(network, id),
    queryFn: async () => {
      const horizon = getHorizonClient(network);
      return horizon.liquidityPools().liquidityPoolId(id).call();
    },
    staleTime: STALE_TIME,
  }),

  // List of liquidity pools with optional cursor
  liquidityPoolsList: (network: NetworkKey, cursor?: string, limit = DEFAULT_PAGE_SIZE) => ({
    queryKey: stellarKeys.liquidityPoolsList(network, cursor),
    queryFn: async () => {
      const horizon = getHorizonClient(network);
      let builder = horizon.liquidityPools().order("desc").limit(limit);
      if (cursor) builder = builder.cursor(cursor);
      return builder.call();
    },
    staleTime: STALE_TIME,
  }),

  // Liquidity pools for a specific asset
  assetLiquidityPools: (
    network: NetworkKey,
    code: string,
    issuer: string,
    limit = DEFAULT_PAGE_SIZE
  ) => ({
    queryKey: stellarKeys.assetLiquidityPools(network, code, issuer),
    queryFn: async () => {
      const { Asset } = await import("@stellar/stellar-sdk");
      const horizon = getHorizonClient(network);
      const asset = code === "XLM" ? Asset.native() : new Asset(code, issuer);
      return horizon.liquidityPools().forAssets(asset).limit(limit).call();
    },
    staleTime: STALE_TIME,
  }),

  // Transactions for a liquidity pool
  liquidityPoolTransactions: (network: NetworkKey, id: string, limit = DEFAULT_PAGE_SIZE) => ({
    queryKey: stellarKeys.liquidityPoolTransactions(network, id),
    queryFn: async () => {
      const horizon = getHorizonClient(network);
      return horizon.transactions().forLiquidityPool(id).order("desc").limit(limit).call();
    },
    staleTime: STALE_TIME,
  }),

  // Deposit/withdraw/trade activity for a liquidity pool, via Horizon effects
  liquidityPoolActivity: (network: NetworkKey, id: string, limit = DEFAULT_PAGE_SIZE) => ({
    queryKey: stellarKeys.liquidityPoolActivity(network, id),
    queryFn: async () => {
      const horizon = getHorizonClient(network);
      return horizon.effects().forLiquidityPool(id).order("desc").limit(limit).call();
    },
    staleTime: STALE_TIME,
  }),

  // Indexer: historical depth (reserves/TVL) for a liquidity pool (indexer#31, provisional contract)
  poolDepth: (
    network: NetworkKey,
    poolId: string,
    resolution: CandleResolution,
    from: string,
    to: string
  ) => ({
    queryKey: stellarKeys.poolDepth(network, poolId, resolution, from, to),
    queryFn: (): Promise<IndexerResult<PoolDepthResponse>> =>
      fetchPoolDepth(poolId, resolution, from, to),
    staleTime: STALE_TIME,
  }),

  // Claimable balances list (optionally filtered by asset)
  claimableBalancesList: (
    network: NetworkKey,
    assetCode?: string,
    assetIssuer?: string,
    cursor?: string,
    limit = DEFAULT_PAGE_SIZE
  ) => ({
    queryKey: stellarKeys.claimableBalancesList(network, assetCode, assetIssuer, cursor),
    queryFn: async () => {
      const horizon = getHorizonClient(network);
      let builder = horizon.claimableBalances().limit(limit);
      if (assetCode && assetIssuer) {
        const { Asset } = await import("@stellar/stellar-sdk");
        const asset = assetCode === "XLM" ? Asset.native() : new Asset(assetCode, assetIssuer);
        builder = builder.asset(asset);
      }
      if (cursor) builder = builder.cursor(cursor);
      return builder.call();
    },
    staleTime: STALE_TIME,
  }),

  // Claimable balances for a specific asset
  assetClaimableBalances: (
    network: NetworkKey,
    code: string,
    issuer: string,
    limit = DEFAULT_PAGE_SIZE
  ) => ({
    queryKey: stellarKeys.assetClaimableBalances(network, code, issuer),
    queryFn: async () => {
      const { Asset } = await import("@stellar/stellar-sdk");
      const horizon = getHorizonClient(network);
      const asset = code === "XLM" ? Asset.native() : new Asset(code, issuer);
      return horizon.claimableBalances().asset(asset).limit(limit).call();
    },
    staleTime: STALE_TIME,
  }),

  // Soroban RPC network info (network passphrase, protocol version from RPC)
  rpcNetworkInfo: (network: NetworkKey) => ({
    queryKey: stellarKeys.rpcNetworkInfo(network),
    queryFn: async () => {
      const rpcClient = getRpcClient(network);
      return rpcClient.getNetwork();
    },
    staleTime: Infinity,
  }),

  // Stellar Expert: full asset analytics (public network only)
  assetAnalytics: (network: NetworkKey, code: string, issuer: string) => ({
    queryKey: stellarKeys.assetAnalytics(network, code, issuer),
    queryFn: (): Promise<StellarExpertResult<StellarExpertAssetAnalytics>> =>
      fetchStellarExpert<StellarExpertAssetAnalytics>(network, `asset/${code}-${issuer}`),
    staleTime: 5 * 60_000,
    retry: 1,
  }),

  // Stellar Expert: account profile with creation date and totals (public network only)
  accountProfile: (network: NetworkKey, id: string) => ({
    queryKey: stellarKeys.accountProfile(network, id),
    queryFn: (): Promise<StellarExpertResult<StellarExpertAccountProfile>> =>
      fetchStellarExpert<StellarExpertAccountProfile>(network, `account/${id}`),
    staleTime: 5 * 60_000,
    retry: 1,
  }),

  // Stellar Expert: network activity history (public network only)
  networkActivity: (network: NetworkKey) => ({
    queryKey: stellarKeys.networkActivity(network),
    queryFn: (): Promise<StellarExpertResult<StellarExpertNetworkActivity>> =>
      fetchStellarExpert<StellarExpertNetworkActivity>(network, "network-activity"),
    staleTime: 30 * 60_000,
    retry: 1,
  }),

  // Stellar Expert: global network stats (public network only)
  networkStats: (network: NetworkKey) => ({
    queryKey: stellarKeys.networkStats(network),
    queryFn: (): Promise<StellarExpertResult<StellarExpertNetworkStats>> =>
      fetchStellarExpert<StellarExpertNetworkStats>(network, "stats"),
    staleTime: 30 * 60_000,
    retry: 1,
  }),

  contractStorage: (network: NetworkKey, contractId: string) => ({
    queryKey: stellarKeys.contractStorage(network, contractId),
    queryFn: async () => {
      const { Contract, xdr, scValToNative } = await import("@stellar/stellar-sdk");

      const contract = new Contract(contractId);
      const contractInstanceKey = xdr.LedgerKey.contractData(
        new xdr.LedgerKeyContractData({
          contract: contract.address().toScAddress(),
          key: xdr.ScVal.scvLedgerKeyContractInstance(),
          durability: xdr.ContractDataDurability.persistent(),
        })
      );

      const decodeScVal = (val: xdr.ScVal): { type: string; value: unknown; raw: string } => {
        const type = val.switch().name;
        let value: unknown;
        const raw = val.toXDR("base64");
        try {
          value = scValToNative(val);
        } catch {
          value = raw;
        }
        return { type, value, raw };
      };

      const rpc = getRpcClient(network);
      const instanceResponse = await rpc.getLedgerEntries(contractInstanceKey);

      if (!instanceResponse.entries || instanceResponse.entries.length === 0) {
        throw new Error("Contract instance not found");
      }

      const instanceEntry = instanceResponse.entries[0];
      const contractData = instanceEntry.val.contractData();
      const contractInstance = contractData.val().instance();

      const instanceStorage: Array<{
        key: { type: string; value: unknown; raw: string };
        value: { type: string; value: unknown; raw: string };
        durability: "instance";
      }> = [];

      const storage = contractInstance.storage();
      if (storage && storage.length > 0) {
        for (const entry of storage) {
          instanceStorage.push({
            key: decodeScVal(entry.key()),
            value: decodeScVal(entry.val()),
            durability: "instance",
          });
        }
      }

      const liveUntilLedger = instanceEntry.liveUntilLedgerSeq;
      const latestLedger = await rpc.getLatestLedger();

      return {
        instanceStorage,
        totalEntries: instanceStorage.length,
        liveUntilLedger,
        currentLedger: latestLedger.sequence,
        ttlLedgers: liveUntilLedger ? liveUntilLedger - latestLedger.sequence : null,
      };
    },
    staleTime: STALE_TIME,
  }),

  // Soroban Domains: forward resolution (name.xlm -> address)
  domainResolution: (network: NetworkKey, name: string) => ({
    queryKey: stellarKeys.domainResolution(network, name),
    queryFn: (): Promise<DomainResolution> => resolveDomain(network, name),
    // Registrations expire, so this must not be cached indefinitely.
    staleTime: 60_000,
    retry: 1,
  }),

  // Indexer: Soroban Domains reverse lookup (address -> owned domains)
  domainsByAddress: (network: NetworkKey, address: string) => ({
    queryKey: stellarKeys.domainsByAddress(network, address),
    queryFn: (): Promise<IndexerResult<DomainReverseLookup>> => fetchDomainsByAddress(address),
    // Registrations change rarely, but they do expire and transfer.
    staleTime: 5 * 60_000,
    retry: 1,
  }),

  // Indexer: Soroban Domains list, one cursor page at a time
  domainsList: (
    network: NetworkKey,
    status: DomainStatus | "all" = "active",
    cursor = "",
    limit = DOMAINS_DEFAULT_PAGE_SIZE
  ) => ({
    queryKey: stellarKeys.domainsList(network, status, cursor),
    queryFn: (): Promise<IndexerResult<DomainsPage>> =>
      fetchDomainsList(status === "all" ? undefined : status, limit, cursor),
    staleTime: 5 * 60_000,
    retry: 1,
  }),

  // Indexer: a single Soroban Domain plus its event history
  domainDetail: (network: NetworkKey, name: string) => ({
    queryKey: stellarKeys.domainDetail(network, name),
    queryFn: (): Promise<IndexerResult<DomainDetail>> => fetchDomainDetail(name),
    staleTime: 5 * 60_000,
    retry: 1,
  }),

  // Indexer: time-series analytics
  indexerTimeSeries: (
    network: NetworkKey,
    metric: TimeSeriesMetric,
    resolution: Resolution,
    from: string,
    to: string
  ) => ({
    queryKey: stellarKeys.indexerTimeSeries(network, metric, resolution, from, to),
    queryFn: (): Promise<IndexerResult<TimeSeriesResponse>> =>
      fetchTimeSeries(metric, resolution, from, to),
    staleTime: 5 * 60_000,
    retry: 1,
  }),

  // Indexer: Top-N rankings
  indexerTopN: (network: NetworkKey, metric: TopNMetric, window: TimeWindow, limit = 10) => ({
    queryKey: stellarKeys.indexerTopN(network, metric, window, limit),
    queryFn: (): Promise<IndexerResult<TopNResponse>> => fetchTopN(metric, window, limit),
    staleTime: 5 * 60_000,
    retry: 1,
  }),

  // Indexer: DEX pairs list (indexer#31, provisional contract — see lib/indexer/dex-types.ts)
  dexPairsList: (network: NetworkKey, limit = 50) => ({
    queryKey: stellarKeys.dexPairsList(network, limit),
    queryFn: (): Promise<IndexerResult<PairsResponse>> => fetchPairs(limit),
    staleTime: 5 * 60_000,
    retry: 1,
  }),

  // Indexer: OHLC candles for a trading pair (indexer#31, provisional contract)
  pairCandles: (
    network: NetworkKey,
    pairId: string,
    resolution: CandleResolution,
    from: string,
    to: string
  ) => ({
    queryKey: stellarKeys.pairCandles(network, pairId, resolution, from, to),
    queryFn: (): Promise<IndexerResult<CandlesResponse>> =>
      fetchCandles(pairId, resolution, from, to),
    staleTime: 5 * 60_000,
    retry: 1,
  }),

  // Recent individual trades for an arbitrary pair (distinct from assetTradeAggregations,
  // which returns bucketed 24h stats against XLM only — this returns the raw trade list
  // for any base/counter combination, for a "recent trades" table).
  pairTrades: (
    network: NetworkKey,
    baseCode: string,
    baseIssuer: string,
    counterCode: string,
    counterIssuer: string,
    limit = DEFAULT_PAGE_SIZE
  ) => ({
    queryKey: stellarKeys.pairTrades(network, baseCode, baseIssuer, counterCode, counterIssuer),
    queryFn: async () => {
      const horizon = getHorizonClient(network);
      const { Asset } = await import("@stellar/stellar-sdk");

      const baseAsset = baseCode === "XLM" ? Asset.native() : new Asset(baseCode, baseIssuer);
      const counterAsset =
        counterCode === "XLM" ? Asset.native() : new Asset(counterCode, counterIssuer);

      return horizon
        .trades()
        .forAssetPair(baseAsset, counterAsset)
        .order("desc")
        .limit(limit)
        .call();
    },
    staleTime: 30_000, // matches orderbook freshness so pair page shows consistent data age
  }),
};
