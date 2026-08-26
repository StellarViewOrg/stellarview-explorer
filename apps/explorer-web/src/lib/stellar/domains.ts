import { StrKey } from "@stellar/stellar-sdk";
import type { Networks } from "@stellar/stellar-sdk";
import { SorobanDomainsSDK } from "@creit-tech/sorobandomains-sdk";
import { NETWORKS, DOMAINS_REGISTRY_CONTRACT_ID } from "@/lib/constants";
import { reportError } from "@/lib/observability";
import type { NetworkKey } from "@/types";

/** What a `*.xlm` name resolved to, or why it didn't resolve. */
export type DomainResolution =
  | {
      status: "resolved";
      name: string;
      address: string;
      targetType: "account" | "contract";
    }
  /** The registry has no record under this name. */
  | { status: "not_found"; name: string }
  /** The name was registered but its registration lapsed. */
  | { status: "expired"; name: string }
  /** No Soroban Domains registry is deployed on the selected network. */
  | { status: "unsupported"; name: string }
  /** RPC or contract failure. The real cause went to `reportError`. */
  | { status: "error"; name: string };

/**
 * Registry error messages (from the SDK's RegistryV2Errors table) that mean
 * "there is nothing to show", as opposed to something actually going wrong.
 */
const NOT_FOUND_ERRORS = new Set([
  "RecordDoesntExist",
  "InvalidDomain",
  "InvalidSubDomain",
  "UnsupportedTLD",
]);

const EXPIRED_ERROR = "RecordIsExpired";

/** The registry only accepts lowercase names. */
export function normalizeDomainName(name: string): string {
  return name.trim().toLowerCase();
}

/** Subset of the SDK's Domain/SubDomain records that we actually read. */
interface RegistryRecord {
  address: string;
  /** Unix seconds. Absent on subdomain records, which inherit the parent's. */
  exp_date?: number;
}

function targetTypeOf(address: string): "account" | "contract" | null {
  if (StrKey.isValidEd25519PublicKey(address)) return "account";
  if (StrKey.isValidContract(address)) return "contract";
  return null;
}

/**
 * Resolve a Soroban Domain (`alice.xlm`, `pay.alice.xlm`) to the address it
 * points at.
 *
 * Always uses the explorer's own configured Soroban RPC: the SDK otherwise
 * falls back to a third-party endpoint (rpc.lightsail.network). Contract and
 * simulation failures never reach the caller as raw text; the real cause is
 * sent to `reportError` and the caller gets `status: "error"`.
 */
export async function resolveDomain(
  network: NetworkKey,
  rawName: string
): Promise<DomainResolution> {
  const name = normalizeDomainName(rawName);
  const registryContractId = DOMAINS_REGISTRY_CONTRACT_ID[network];

  if (!registryContractId) {
    return { status: "unsupported", name };
  }

  try {
    const sdk = new SorobanDomainsSDK({
      rpcUrl: NETWORKS[network].rpcUrl,
      network: NETWORKS[network].passphrase as Networks,
      registryContractId,
    });

    const record = await sdk.searchDomain<RegistryRecord>(name);

    // The registry rejects expired names itself, but a record read straight
    // after expiry can still come back, so check the date too.
    if (record.exp_date && record.exp_date * 1000 < Date.now()) {
      return { status: "expired", name };
    }

    const targetType = targetTypeOf(record.address);
    if (!targetType) {
      throw new Error("Soroban Domains registry returned an invalid address");
    }

    return { status: "resolved", name, address: record.address, targetType };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (NOT_FOUND_ERRORS.has(message)) return { status: "not_found", name };
    if (message === EXPIRED_ERROR) return { status: "expired", name };

    reportError(error, { scope: "resolveDomain", network, name });
    return { status: "error", name };
  }
}

/**
 * i18n key (under the `search` namespace) explaining each non-resolved status.
 * Shared by the command palette and the search results page.
 */
export const DOMAIN_STATUS_MESSAGE_KEY = {
  not_found: "domainNotFound",
  expired: "domainExpired",
  unsupported: "domainUnsupported",
  error: "domainError",
} as const;
