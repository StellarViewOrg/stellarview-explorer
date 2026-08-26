export * from "./networks";
export * from "./domains";

// Stellar-specific constants
export const STROOPS_PER_XLM = 10_000_000;

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 20;

// Polling intervals (ms)
export const LIVE_LEDGER_POLL_INTERVAL = 5000;

// Cache times (ms)
export const STALE_TIME = 10_000;
export const GC_TIME = 5 * 60_000;

// UI constants
export const HASH_TRUNCATE_LENGTH = 8;

// Popular assets with their issuers (single source of truth)
export const POPULAR_ASSETS = [
  { code: "USDC", issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" },
  { code: "yXLM", issuer: "GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55" },
  { code: "AQUA", issuer: "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA" },
  { code: "EURC", issuer: "GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2" },
  { code: "BTC", issuer: "GDPJALI4AZKUU2W426U5WKMAT6CN3AJRPIIRYR2YM54TL2GDWO5O2MZM" },
] as const;

// Operation type labels
export const OPERATION_LABELS: Record<string, string> = {
  create_account: "Create Account",
  payment: "Payment",
  path_payment_strict_receive: "Path Payment (Receive)",
  path_payment_strict_send: "Path Payment (Send)",
  manage_sell_offer: "Sell Offer",
  manage_buy_offer: "Buy Offer",
  create_passive_sell_offer: "Passive Sell Offer",
  set_options: "Set Options",
  change_trust: "Change Trust",
  allow_trust: "Allow Trust",
  account_merge: "Account Merge",
  inflation: "Inflation",
  manage_data: "Manage Data",
  bump_sequence: "Bump Sequence",
  create_claimable_balance: "Create Claimable Balance",
  claim_claimable_balance: "Claim Claimable Balance",
  begin_sponsoring_future_reserves: "Begin Sponsoring",
  end_sponsoring_future_reserves: "End Sponsoring",
  revoke_sponsorship: "Revoke Sponsorship",
  clawback: "Clawback",
  clawback_claimable_balance: "Clawback Claimable Balance",
  set_trust_line_flags: "Set Trust Line Flags",
  liquidity_pool_deposit: "LP Deposit",
  liquidity_pool_withdraw: "LP Withdraw",
  invoke_host_function: "Contract Invoke",
  extend_footprint_ttl: "Extend TTL",
  restore_footprint: "Restore Footprint",
};
