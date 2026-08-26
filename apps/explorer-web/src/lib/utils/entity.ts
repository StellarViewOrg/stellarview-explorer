import type { EntityType } from "@/types";

/**
 * Soroban Domain name, e.g. `alice.xlm` or `pay.alice.xlm`.
 *
 * Deliberately permissive: the registry has the final say on what is a valid
 * name, so anything ending in `.xlm` is routed to resolution rather than
 * rejected here.
 */
const DOMAIN_NAME_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.xlm$/i;

/**
 * Check whether a query looks like a Soroban Domain name.
 */
export function isDomainName(query: string): boolean {
  return DOMAIN_NAME_PATTERN.test(query.trim());
}

/**
 * Detect the type of entity from a search query
 */
export function detectEntityType(query: string): EntityType {
  const trimmed = query.trim();

  // Transaction hash: 64 hex characters
  if (trimmed.length === 64 && /^[a-f0-9]+$/i.test(trimmed)) {
    return "transaction";
  }

  // Stellar account: starts with G, 56 characters
  if (trimmed.startsWith("G") && trimmed.length === 56) {
    return "account";
  }

  // Soroban contract: starts with C, 56 characters
  if (trimmed.startsWith("C") && trimmed.length === 56) {
    return "contract";
  }

  // Soroban Domain: name.xlm
  if (isDomainName(trimmed)) {
    return "domain";
  }

  // Ledger sequence: pure number
  if (/^\d+$/.test(trimmed)) {
    return "ledger";
  }

  // Asset: CODE-ISSUER format
  if (trimmed.includes("-") && trimmed.split("-").length === 2) {
    const [code, issuer] = trimmed.split("-");
    if (code.length >= 1 && code.length <= 12 && issuer.startsWith("G")) {
      return "asset";
    }
  }

  return "unknown";
}

/**
 * Get the route for an entity
 */
export function getEntityRoute(type: EntityType, id: string): string | null {
  switch (type) {
    case "transaction":
      return `/tx/${id}`;
    case "account":
      return `/account/${id}`;
    case "contract":
      return `/contract/${id}`;
    case "ledger":
      return `/ledger/${id}`;
    case "asset":
      return `/asset/${id}`;
    default:
      return null;
  }
}

/**
 * Validate a Stellar public key (G... address)
 */
export function isValidPublicKey(key: string): boolean {
  if (!key.startsWith("G") || key.length !== 56) {
    return false;
  }
  // Basic check - could add StrKey validation from SDK
  return /^G[A-Z2-7]{55}$/.test(key);
}

/**
 * Validate a Soroban contract ID (C... address)
 */
export function isValidContractId(id: string): boolean {
  if (!id.startsWith("C") || id.length !== 56) {
    return false;
  }
  return /^C[A-Z2-7]{55}$/.test(id);
}

/**
 * Validate a transaction hash
 */
export function isValidTransactionHash(hash: string): boolean {
  return hash.length === 64 && /^[a-f0-9]+$/i.test(hash);
}

/**
 * Validate a ledger sequence number
 */
export function isValidLedgerSequence(sequence: string): boolean {
  const num = parseInt(sequence, 10);
  return !isNaN(num) && num > 0 && /^\d+$/.test(sequence);
}

/**
 * Get display name for entity type
 */
export function getEntityTypeName(type: EntityType): string {
  switch (type) {
    case "transaction":
      return "Transaction";
    case "account":
      return "Account";
    case "contract":
      return "Contract";
    case "ledger":
      return "Ledger";
    case "asset":
      return "Asset";
    case "domain":
      return "Domain";
    default:
      return "Unknown";
  }
}
