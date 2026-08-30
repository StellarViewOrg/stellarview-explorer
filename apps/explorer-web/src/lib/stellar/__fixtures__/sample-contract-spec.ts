/**
 * Fixture: A minimal WASM binary with a `contractspecv0` custom section
 * containing a realistic set of contract spec entries.
 *
 * This simulates what a real Soroban contract's spec section looks like:
 * - Functions with various parameter types (address, i128, option, vec, map, struct UDTs)
 * - Struct definitions
 * - Union definitions
 * - Enum definitions
 * - Error enum definitions
 */
import { xdr } from "@stellar/stellar-sdk";

function readLeb128Unsigned(
  buf: Uint8Array,
  offset: number
): {
  value: number;
  bytesRead: number;
} {
  let result = 0;
  let shift = 0;
  let bytesRead = 0;
  while (offset + bytesRead < buf.length) {
    const byte = buf[offset + bytesRead];
    result |= (byte & 0x7f) << shift;
    bytesRead++;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  return { value: result, bytesRead };
}

function writeLeb128(value: number): number[] {
  const bytes: number[] = [];
  do {
    let byte = value & 0x7f;
    value >>>= 7;
    if (value !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (value !== 0);
  return bytes;
}

/**
 * Build a minimal WASM binary containing a `contractspecv0` custom section
 * with the given XDR-encoded spec entries.
 */
export function buildWasmWithSpec(entries: xdr.ScSpecEntry[]): Uint8Array {
  // Serialize all entries into one buffer
  const entryBufs = entries.map((e) => e.toXDR());
  const totalLen = entryBufs.reduce((s, b) => s + b.length, 0);
  const specPayload = new Uint8Array(totalLen);
  let off = 0;
  for (const buf of entryBufs) {
    specPayload.set(buf, off);
    off += buf.length;
  }

  // Build custom section: [name_len] [name_bytes] [payload]
  const nameBytes = new TextEncoder().encode("contractspecv0");
  const customPayload = new Uint8Array(1 + nameBytes.length + specPayload.length);
  customPayload[0] = nameBytes.length;
  customPayload.set(nameBytes, 1);
  customPayload.set(specPayload, 1 + nameBytes.length);

  // WASM custom section: [section_id=0] [section_size] [name_len] [name] [payload]
  const sectionSizeBytes = writeLeb128(customPayload.length);
  const section = new Uint8Array(1 + sectionSizeBytes.length + customPayload.length);
  section[0] = 0x00; // custom section ID
  section.set(new Uint8Array(sectionSizeBytes), 1);
  section.set(customPayload, 1 + sectionSizeBytes.length);

  // WASM header: magic + version
  const header = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
  const wasm = new Uint8Array(header.length + section.length);
  wasm.set(header);
  wasm.set(section, header.length);
  return wasm;
}

/**
 * Build a realistic set of spec entries that mirror a typical Soroban token contract.
 */
export function buildSampleSpecEntries(): xdr.ScSpecEntry[] {
  const entries: xdr.ScSpecEntry[] = [];

  // --- Struct: TokenMetadata ---
  entries.push(
    xdr.ScSpecEntry.scSpecEntryUdtStructV0(
      new xdr.ScSpecUdtStructV0({
        doc: "Metadata for a token contract",
        lib: "",
        name: "TokenMetadata",
        fields: [
          new xdr.ScSpecUdtStructFieldV0({
            doc: "The token name",
            name: "name",
            type: xdr.ScSpecTypeDef.scSpecTypeString(),
          }),
          new xdr.ScSpecUdtStructFieldV0({
            doc: "The token symbol",
            name: "symbol",
            type: xdr.ScSpecTypeDef.scSpecTypeString(),
          }),
          new xdr.ScSpecUdtStructFieldV0({
            doc: "Number of decimal places",
            name: "decimals",
            type: xdr.ScSpecTypeDef.scSpecTypeU32(),
          }),
        ],
      })
    )
  );

  // --- Enum: ContractState ---
  entries.push(
    xdr.ScSpecEntry.scSpecEntryUdtEnumV0(
      new xdr.ScSpecUdtEnumV0({
        doc: "State of the contract lifecycle",
        lib: "",
        name: "ContractState",
        cases: [
          new xdr.ScSpecUdtEnumCaseV0({
            doc: "Not yet initialized",
            name: "Uninitialized",
            value: 0,
          }),
          new xdr.ScSpecUdtEnumCaseV0({ doc: "Contract is active", name: "Active", value: 1 }),
          new xdr.ScSpecUdtEnumCaseV0({ doc: "Contract is frozen", name: "Frozen", value: 2 }),
          new xdr.ScSpecUdtEnumCaseV0({ doc: "Contract is stopped", name: "Stopped", value: 3 }),
        ],
      })
    )
  );

  // --- Union: TransferResult ---
  entries.push(
    xdr.ScSpecEntry.scSpecEntryUdtUnionV0(
      new xdr.ScSpecUdtUnionV0({
        doc: "Result of a transfer operation",
        lib: "",
        name: "TransferResult",
        cases: [
          xdr.ScSpecUdtUnionCaseV0.scSpecUdtUnionCaseVoidV0(
            new xdr.ScSpecUdtUnionCaseVoidV0({ doc: "Transfer succeeded", name: "Success" })
          ),
          xdr.ScSpecUdtUnionCaseV0.scSpecUdtUnionCaseTupleV0(
            new xdr.ScSpecUdtUnionCaseTupleV0({
              doc: "Insufficient balance",
              name: "InsufficientBalance",
              type: [xdr.ScSpecTypeDef.scSpecTypeI128()],
            })
          ),
          xdr.ScSpecUdtUnionCaseV0.scSpecUdtUnionCaseTupleV0(
            new xdr.ScSpecUdtUnionCaseTupleV0({
              doc: "Unauthorized transfer attempt",
              name: "Unauthorized",
              type: [],
            })
          ),
        ],
      })
    )
  );

  // --- Error Enum: TokenError ---
  entries.push(
    xdr.ScSpecEntry.scSpecEntryUdtErrorEnumV0(
      new xdr.ScSpecUdtErrorEnumV0({
        doc: "Token contract error codes",
        lib: "",
        name: "TokenError",
        cases: [
          new xdr.ScSpecUdtErrorEnumCaseV0({ doc: "Unauthorized", name: "Unauthorized", value: 1 }),
          new xdr.ScSpecUdtErrorEnumCaseV0({
            doc: "Insufficient balance",
            name: "InsufficientBalance",
            value: 2,
          }),
          new xdr.ScSpecUdtErrorEnumCaseV0({
            doc: "Invalid amount",
            name: "InvalidAmount",
            value: 3,
          }),
          new xdr.ScSpecUdtErrorEnumCaseV0({
            doc: "Contract frozen",
            name: "ContractFrozen",
            value: 4,
          }),
        ],
      })
    )
  );

  // --- Function: initialize ---
  entries.push(
    xdr.ScSpecEntry.scSpecEntryFunctionV0(
      new xdr.ScSpecFunctionV0({
        doc: "Initialize the token contract with metadata",
        name: "initialize",
        inputs: [
          new xdr.ScSpecFunctionInputV0({
            doc: "Admin address",
            name: "admin",
            type: xdr.ScSpecTypeDef.scSpecTypeAddress(),
          }),
          new xdr.ScSpecFunctionInputV0({
            doc: "Token metadata",
            name: "metadata",
            type: xdr.ScSpecTypeDef.scSpecTypeUdt(new xdr.ScSpecTypeUdt({ name: "TokenMetadata" })),
          }),
        ],
        outputs: [],
      })
    )
  );

  // --- Function: transfer ---
  entries.push(
    xdr.ScSpecEntry.scSpecEntryFunctionV0(
      new xdr.ScSpecFunctionV0({
        doc: "Transfer tokens from one account to another",
        name: "transfer",
        inputs: [
          new xdr.ScSpecFunctionInputV0({
            doc: "Sender address",
            name: "from",
            type: xdr.ScSpecTypeDef.scSpecTypeAddress(),
          }),
          new xdr.ScSpecFunctionInputV0({
            doc: "Recipient address",
            name: "to",
            type: xdr.ScSpecTypeDef.scSpecTypeAddress(),
          }),
          new xdr.ScSpecFunctionInputV0({
            doc: "Amount to transfer",
            name: "amount",
            type: xdr.ScSpecTypeDef.scSpecTypeI128(),
          }),
        ],
        outputs: [
          xdr.ScSpecTypeDef.scSpecTypeUdt(new xdr.ScSpecTypeUdt({ name: "TransferResult" })),
        ],
      })
    )
  );

  // --- Function: balance ---
  entries.push(
    xdr.ScSpecEntry.scSpecEntryFunctionV0(
      new xdr.ScSpecFunctionV0({
        doc: "Get the token balance of an account",
        name: "balance",
        inputs: [
          new xdr.ScSpecFunctionInputV0({
            doc: "Account address",
            name: "account",
            type: xdr.ScSpecTypeDef.scSpecTypeAddress(),
          }),
        ],
        outputs: [xdr.ScSpecTypeDef.scSpecTypeI128()],
      })
    )
  );

  // --- Function: batch_transfer ---
  entries.push(
    xdr.ScSpecEntry.scSpecEntryFunctionV0(
      new xdr.ScSpecFunctionV0({
        doc: "Transfer tokens to multiple recipients",
        name: "batch_transfer",
        inputs: [
          new xdr.ScSpecFunctionInputV0({
            doc: "Sender address",
            name: "from",
            type: xdr.ScSpecTypeDef.scSpecTypeAddress(),
          }),
          new xdr.ScSpecFunctionInputV0({
            doc: "List of (recipient, amount) pairs",
            name: "transfers",
            type: xdr.ScSpecTypeDef.scSpecTypeVec(
              new xdr.ScSpecTypeVec({
                elementType: xdr.ScSpecTypeDef.scSpecTypeTuple(
                  new xdr.ScSpecTypeTuple({
                    valueTypes: [
                      xdr.ScSpecTypeDef.scSpecTypeAddress(),
                      xdr.ScSpecTypeDef.scSpecTypeI128(),
                    ],
                  })
                ),
              })
            ),
          }),
        ],
        outputs: [xdr.ScSpecTypeDef.scSpecTypeU32()],
      })
    )
  );

  // --- Function: get_metadata ---
  entries.push(
    xdr.ScSpecEntry.scSpecEntryFunctionV0(
      new xdr.ScSpecFunctionV0({
        doc: "Retrieve token metadata",
        name: "get_metadata",
        inputs: [],
        outputs: [
          xdr.ScSpecTypeDef.scSpecTypeUdt(new xdr.ScSpecTypeUdt({ name: "TokenMetadata" })),
        ],
      })
    )
  );

  return entries;
}

/**
 * Build a minimal WASM buffer containing the sample spec entries.
 * Use this as a realistic fixture for decodeContractSpec tests.
 */
export function buildSampleWasm(): Uint8Array {
  return buildWasmWithSpec(buildSampleSpecEntries());
}
