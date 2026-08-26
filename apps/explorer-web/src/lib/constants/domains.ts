import type { NetworkKey } from "@/types";

/**
 * Soroban Domains registry contract, per network.
 *
 * Pinned here instead of relying on the SDK's built-in default so a future SDK
 * release can't silently change which contract we resolve against without this
 * file being reviewed. Mainnet value matches the registry v2 contract published
 * by @creit-tech/sorobandomains-sdk (src/types.ts, REGISTRY_CONTRACT) and the
 * default the StellarViewOrg indexer watches.
 *
 * ponytail: only mainnet has a published deployment. Testnet can be pointed at
 * one through the env var; futurenet has none, so the feature stays off there.
 */
export const DOMAINS_REGISTRY_CONTRACT_ID: Record<NetworkKey, string | null> = {
  mainnet: "CC75Z72OCE667WVPQOROIWDAGBOXFNJ4VQONQEURL74EYIDLWA4F7FEN",
  testnet: process.env.NEXT_PUBLIC_DOMAINS_REGISTRY_CONTRACT_ID_TESTNET || null,
  futurenet: null,
};

/** Top-level domain served by the Soroban Domains registry. */
export const DOMAIN_TLD = "xlm";
