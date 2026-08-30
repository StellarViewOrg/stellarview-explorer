import { xdr, nativeToScVal, scValToNative, Address, Contract } from "@stellar/stellar-sdk";

export type SpecPrimitiveKind =
  | "val"
  | "bool"
  | "void"
  | "error"
  | "u32"
  | "i32"
  | "u64"
  | "i64"
  | "u128"
  | "i128"
  | "u256"
  | "i256"
  | "bytes"
  | "string"
  | "symbol"
  | "address"
  | "timepoint"
  | "duration";

export type SpecTypeDef =
  | { kind: SpecPrimitiveKind }
  | { kind: "option"; valueType: SpecTypeDef }
  | { kind: "result"; okType: SpecTypeDef; errorType: SpecTypeDef }
  | { kind: "vec"; elementType: SpecTypeDef }
  | { kind: "map"; keyType: SpecTypeDef; valueType: SpecTypeDef }
  | { kind: "tuple"; elementTypes: SpecTypeDef[] }
  | { kind: "bytesN"; size: number }
  | { kind: "udt"; name: string };

export interface SpecFunctionInput {
  name: string;
  doc: string;
  type: SpecTypeDef;
}

export interface SpecFunction {
  name: string;
  doc: string;
  inputs: SpecFunctionInput[];
  outputs: SpecTypeDef[];
}

export interface SpecStructField {
  name: string;
  doc: string;
  type: SpecTypeDef;
}

export interface SpecStruct {
  udtKind: "struct";
  name: string;
  lib: string;
  doc: string;
  fields: SpecStructField[];
}

export type SpecUnionCase =
  | { kind: "void"; name: string; doc: string }
  | { kind: "tuple"; name: string; doc: string; types: SpecTypeDef[] };

export interface SpecUnion {
  udtKind: "union";
  name: string;
  lib: string;
  doc: string;
  cases: SpecUnionCase[];
}

export interface SpecEnumCase {
  name: string;
  doc: string;
  value: number;
}

export interface SpecEnum {
  udtKind: "enum";
  name: string;
  lib: string;
  doc: string;
  cases: SpecEnumCase[];
}

export interface SpecErrorEnumCase {
  name: string;
  doc: string;
  value: number;
}

export interface SpecErrorEnum {
  udtKind: "errorEnum";
  name: string;
  lib: string;
  doc: string;
  cases: SpecErrorEnumCase[];
}

export type SpecUdt = SpecStruct | SpecUnion | SpecEnum | SpecErrorEnum;

export interface ParsedSpec {
  functions: SpecFunction[];
  structs: Map<string, SpecStruct>;
  unions: Map<string, SpecUnion>;
  enums: Map<string, SpecEnum>;
  errorEnums: Map<string, SpecErrorEnum>;
  udtRegistry: Map<string, SpecUdt>;
}

/**
 * Read LEB128 unsigned integer from buffer at offset.
 */
function readLeb128Unsigned(buf: Uint8Array, offset: number): { value: number; bytesRead: number } {
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

/**
 * Extract bytes from custom section `contractspecv0` in WASM binary.
 */
export function extractSpecCustomSection(wasmBuf: Uint8Array): Uint8Array {
  if (wasmBuf.length < 8) return new Uint8Array(0);
  if (wasmBuf[0] !== 0x00 || wasmBuf[1] !== 0x61 || wasmBuf[2] !== 0x73 || wasmBuf[3] !== 0x6d) {
    return new Uint8Array(0);
  }

  let offset = 8;
  const specChunks: Uint8Array[] = [];

  while (offset < wasmBuf.length) {
    const sectionId = wasmBuf[offset++];
    const { value: sectionSize, bytesRead: sizeBytes } = readLeb128Unsigned(wasmBuf, offset);
    offset += sizeBytes;

    const sectionEnd = offset + sectionSize;
    if (sectionId === 0) {
      const { value: nameLen, bytesRead: nameLenBytes } = readLeb128Unsigned(wasmBuf, offset);
      const nameStart = offset + nameLenBytes;
      const nameBytes = wasmBuf.subarray(nameStart, nameStart + nameLen);
      const name = new TextDecoder().decode(nameBytes);
      if (name === "contractspecv0") {
        const payloadStart = nameStart + nameLen;
        specChunks.push(wasmBuf.subarray(payloadStart, sectionEnd));
      }
    }
    offset = sectionEnd;
  }

  if (specChunks.length === 0) return new Uint8Array(0);

  let totalLen = 0;
  for (const chunk of specChunks) totalLen += chunk.length;
  const combined = new Uint8Array(totalLen);
  let cur = 0;
  for (const chunk of specChunks) {
    combined.set(chunk, cur);
    cur += chunk.length;
  }
  return combined;
}

interface XdrReaderInstance {
  remainingBytes(): number;
}

type XdrReaderConstructor = new (buffer: Buffer) => XdrReaderInstance;

let cachedXdrReaderClass: XdrReaderConstructor | null = null;

/**
 * Obtain a reusable XDR reader class by monkey-patching xdr.ScSpecEntry.read
 * to capture the internal Reader constructor from the first argument.
 *
 * FRAGILE: This relies on an undocumented stellar-sdk internal (the XDR Reader
 * class passed as the first arg to .read()). A stellar-sdk upgrade could change
 * the reader implementation or call signature, which would silently break this
 * extraction. If decoding fails after an SDK upgrade, this function is the first
 * place to investigate.
 */
function getXdrReaderClass(): XdrReaderConstructor {
  if (cachedXdrReaderClass) return cachedXdrReaderClass;

  const dummyFunc = xdr.ScSpecEntry.scSpecEntryFunctionV0(
    new xdr.ScSpecFunctionV0({ doc: "", name: "dummy", inputs: [], outputs: [] })
  );
  const buf = dummyFunc.toXDR();

  const origRead = xdr.ScSpecEntry.read;
  let captured: XdrReaderConstructor | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (xdr.ScSpecEntry as any).read = function (
    r: { constructor: XdrReaderConstructor },
    ...args: unknown[]
  ) {
    captured = r.constructor;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (origRead as any).apply(this, [r, ...args]);
  };

  try {
    xdr.ScSpecEntry.fromXDR(buf);
  } finally {
    xdr.ScSpecEntry.read = origRead;
  }

  cachedXdrReaderClass = captured!;
  return cachedXdrReaderClass;
}

/**
 * Parse sequential XDR entries from binary buffer.
 */
export function decodeXdrEntries(buffer: Uint8Array): xdr.ScSpecEntry[] {
  if (!buffer || buffer.length === 0) return [];
  const XdrReaderClass = getXdrReaderClass();
  const reader = new XdrReaderClass(Buffer.from(buffer));
  const entries: xdr.ScSpecEntry[] = [];

  while (reader.remainingBytes() > 0) {
    try {
      entries.push(
        xdr.ScSpecEntry.read(reader as unknown as Parameters<typeof xdr.ScSpecEntry.read>[0])
      );
    } catch {
      break;
    }
  }
  return entries;
}

/**
 * Map xdr.ScSpecTypeDef to SpecTypeDef.
 */
export function parseTypeDef(typeDef: xdr.ScSpecTypeDef): SpecTypeDef {
  const switchName = typeDef.switch().name;

  switch (switchName) {
    case "scSpecTypeVal":
      return { kind: "val" };
    case "scSpecTypeBool":
      return { kind: "bool" };
    case "scSpecTypeVoid":
      return { kind: "void" };
    case "scSpecTypeError":
      return { kind: "error" };
    case "scSpecTypeU32":
      return { kind: "u32" };
    case "scSpecTypeI32":
      return { kind: "i32" };
    case "scSpecTypeU64":
      return { kind: "u64" };
    case "scSpecTypeI64":
      return { kind: "i64" };
    case "scSpecTypeTimepoint":
      return { kind: "timepoint" };
    case "scSpecTypeDuration":
      return { kind: "duration" };
    case "scSpecTypeU128":
      return { kind: "u128" };
    case "scSpecTypeI128":
      return { kind: "i128" };
    case "scSpecTypeU256":
      return { kind: "u256" };
    case "scSpecTypeI256":
      return { kind: "i256" };
    case "scSpecTypeBytes":
      return { kind: "bytes" };
    case "scSpecTypeString":
      return { kind: "string" };
    case "scSpecTypeSymbol":
      return { kind: "symbol" };
    case "scSpecTypeAddress":
      return { kind: "address" };
    case "scSpecTypeOption": {
      const opt = typeDef.option();
      return { kind: "option", valueType: parseTypeDef(opt.valueType()) };
    }
    case "scSpecTypeResult": {
      const res = typeDef.result();
      return {
        kind: "result",
        okType: parseTypeDef(res.okType()),
        errorType: parseTypeDef(res.errorType()),
      };
    }
    case "scSpecTypeVec": {
      const vec = typeDef.vec();
      return { kind: "vec", elementType: parseTypeDef(vec.elementType()) };
    }
    case "scSpecTypeMap": {
      const map = typeDef.map();
      return {
        kind: "map",
        keyType: parseTypeDef(map.keyType()),
        valueType: parseTypeDef(map.valueType()),
      };
    }
    case "scSpecTypeTuple": {
      const tuple = typeDef.tuple();
      return {
        kind: "tuple",
        elementTypes: tuple.valueTypes().map(parseTypeDef),
      };
    }
    case "scSpecTypeBytesN": {
      const bytesN = typeDef.bytesN();
      return { kind: "bytesN", size: bytesN.n() };
    }
    case "scSpecTypeUdt": {
      const udt = typeDef.udt();
      return { kind: "udt", name: udt.name().toString() };
    }
    default:
      return { kind: "val" };
  }
}

/**
 * Decode array of xdr.ScSpecEntry into structured ParsedSpec.
 */
export function parseScSpecEntries(entries: xdr.ScSpecEntry[]): ParsedSpec {
  const functions: SpecFunction[] = [];
  const structs = new Map<string, SpecStruct>();
  const unions = new Map<string, SpecUnion>();
  const enums = new Map<string, SpecEnum>();
  const errorEnums = new Map<string, SpecErrorEnum>();
  const udtRegistry = new Map<string, SpecUdt>();

  for (const entry of entries) {
    const kind = entry.switch().name;

    if (kind === "scSpecEntryFunctionV0") {
      const fn = entry.functionV0();
      functions.push({
        name: fn.name().toString(),
        doc: fn.doc().toString(),
        inputs: fn.inputs().map((input) => ({
          name: input.name().toString(),
          doc: input.doc().toString(),
          type: parseTypeDef(input.type()),
        })),
        outputs: fn.outputs().map(parseTypeDef),
      });
    } else if (kind === "scSpecEntryUdtStructV0") {
      const st = entry.udtStructV0();
      const name = st.name().toString();
      const structObj: SpecStruct = {
        udtKind: "struct",
        name,
        lib: st.lib().toString(),
        doc: st.doc().toString(),
        fields: st.fields().map((f) => ({
          name: f.name().toString(),
          doc: f.doc().toString(),
          type: parseTypeDef(f.type()),
        })),
      };
      structs.set(name, structObj);
      udtRegistry.set(name, structObj);
    } else if (kind === "scSpecEntryUdtUnionV0") {
      const un = entry.udtUnionV0();
      const name = un.name().toString();
      const unionObj: SpecUnion = {
        udtKind: "union",
        name,
        lib: un.lib().toString(),
        doc: un.doc().toString(),
        cases: un.cases().map((c): SpecUnionCase => {
          const caseKind = c.switch().name;
          if (caseKind === "scSpecUdtUnionCaseVoidV0") {
            const v = c.voidCase();
            return {
              kind: "void",
              name: v.name().toString(),
              doc: v.doc().toString(),
            };
          } else {
            const t = c.tupleCase();
            return {
              kind: "tuple",
              name: t.name().toString(),
              doc: t.doc().toString(),
              types: t.type().map(parseTypeDef),
            };
          }
        }),
      };
      unions.set(name, unionObj);
      udtRegistry.set(name, unionObj);
    } else if (kind === "scSpecEntryUdtEnumV0") {
      const en = entry.udtEnumV0();
      const name = en.name().toString();
      const enumObj: SpecEnum = {
        udtKind: "enum",
        name,
        lib: en.lib().toString(),
        doc: en.doc().toString(),
        cases: en.cases().map((c) => ({
          name: c.name().toString(),
          doc: c.doc().toString(),
          value: c.value(),
        })),
      };
      enums.set(name, enumObj);
      udtRegistry.set(name, enumObj);
    } else if (kind === "scSpecEntryUdtErrorEnumV0") {
      const errEn = entry.udtErrorEnumV0();
      const name = errEn.name().toString();
      const errorEnumObj: SpecErrorEnum = {
        udtKind: "errorEnum",
        name,
        lib: errEn.lib().toString(),
        doc: errEn.doc().toString(),
        cases: errEn.cases().map((c) => ({
          name: c.name().toString(),
          doc: c.doc().toString(),
          value: c.value(),
        })),
      };
      errorEnums.set(name, errorEnumObj);
      udtRegistry.set(name, errorEnumObj);
    }
  }

  return {
    functions,
    structs,
    unions,
    enums,
    errorEnums,
    udtRegistry,
  };
}

/**
 * Decode spec from WASM bytecode (Uint8Array), raw XDR base64/hex, or ScSpecEntry array.
 */
export function decodeContractSpec(
  input: Uint8Array | string | string[] | xdr.ScSpecEntry[]
): ParsedSpec {
  if (Array.isArray(input) && input.length > 0 && input[0] instanceof xdr.ScSpecEntry) {
    return parseScSpecEntries(input as xdr.ScSpecEntry[]);
  }

  if (Array.isArray(input)) {
    const entries: xdr.ScSpecEntry[] = [];
    for (const xdrStr of input as string[]) {
      try {
        const buf = Buffer.from(xdrStr, xdrStr.match(/^[0-9a-fA-F]+$/) ? "hex" : "base64");
        entries.push(...decodeXdrEntries(buf));
      } catch {
        // ignore invalid entries
      }
    }
    return parseScSpecEntries(entries);
  }

  if (typeof input === "string") {
    const buf = Buffer.from(input, input.match(/^[0-9a-fA-F]+$/) ? "hex" : "base64");
    const extracted = extractSpecCustomSection(buf);
    const targetBuf = extracted.length > 0 ? extracted : buf;
    return parseScSpecEntries(decodeXdrEntries(targetBuf));
  }

  if (input instanceof Uint8Array) {
    const extracted = extractSpecCustomSection(input);
    const targetBuf = extracted.length > 0 ? extracted : input;
    return parseScSpecEntries(decodeXdrEntries(targetBuf));
  }

  return {
    functions: [],
    structs: new Map(),
    unions: new Map(),
    enums: new Map(),
    errorEnums: new Map(),
    udtRegistry: new Map(),
  };
}

/**
 * Build xdr.ScVal from JavaScript typed input value and SpecTypeDef.
 */
export function encodeInputToScVal(
  val: unknown,
  typeDef: SpecTypeDef,
  udtRegistry: Map<string, SpecUdt>
): xdr.ScVal {
  if (val === undefined || val === null) {
    if (typeDef.kind === "option") {
      return xdr.ScVal.scvVoid();
    }
    if (typeDef.kind === "void") {
      return xdr.ScVal.scvVoid();
    }
  }

  switch (typeDef.kind) {
    case "bool":
      return xdr.ScVal.scvBool(Boolean(val));

    case "void":
      return xdr.ScVal.scvVoid();

    case "u32":
      return nativeToScVal(Number(val), { type: "u32" });

    case "i32":
      return nativeToScVal(Number(val), { type: "i32" });

    case "u64":
      return nativeToScVal(BigInt((val as bigint | number | string) || 0), { type: "u64" });

    case "i64":
      return nativeToScVal(BigInt((val as bigint | number | string) || 0), { type: "i64" });

    case "u128":
      return nativeToScVal(BigInt((val as bigint | number | string) || 0), { type: "u128" });

    case "i128":
      return nativeToScVal(BigInt((val as bigint | number | string) || 0), { type: "i128" });

    case "u256":
      return nativeToScVal(BigInt((val as bigint | number | string) || 0), { type: "u256" });

    case "i256":
      return nativeToScVal(BigInt((val as bigint | number | string) || 0), { type: "i256" });

    case "timepoint":
      return nativeToScVal(BigInt((val as bigint | number | string) || 0), { type: "u64" });

    case "duration":
      return nativeToScVal(BigInt((val as bigint | number | string) || 0), { type: "u64" });

    case "symbol":
      return xdr.ScVal.scvSymbol(String(val || ""));

    case "string":
      return xdr.ScVal.scvString(String(val || ""));

    case "bytes":
    case "bytesN": {
      if (val instanceof Uint8Array) {
        return xdr.ScVal.scvBytes(Buffer.from(val));
      }
      const hex = String(val || "").replace(/^0x/, "");
      const bytes = Buffer.from(hex, "hex");
      return xdr.ScVal.scvBytes(bytes);
    }

    case "address": {
      const addrStr = String(val || "").trim();
      if (addrStr.startsWith("C")) {
        return new Contract(addrStr).address().toScVal();
      }
      return new Address(addrStr).toScVal();
    }

    case "option": {
      if (val === null || val === undefined || val === "") {
        return xdr.ScVal.scvVoid();
      }
      return encodeInputToScVal(val, typeDef.valueType, udtRegistry);
    }

    case "vec": {
      const arr = Array.isArray(val) ? val : [];
      const scVals = arr.map((item) => encodeInputToScVal(item, typeDef.elementType, udtRegistry));
      return xdr.ScVal.scvVec(scVals);
    }

    case "map": {
      const entries: xdr.ScMapEntry[] = [];
      if (Array.isArray(val)) {
        for (const item of val) {
          if (item && item.key !== undefined) {
            entries.push(
              new xdr.ScMapEntry({
                key: encodeInputToScVal(item.key, typeDef.keyType, udtRegistry),
                val: encodeInputToScVal(item.value, typeDef.valueType, udtRegistry),
              })
            );
          }
        }
      } else if (val && typeof val === "object") {
        for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
          entries.push(
            new xdr.ScMapEntry({
              key: encodeInputToScVal(k, typeDef.keyType, udtRegistry),
              val: encodeInputToScVal(v, typeDef.valueType, udtRegistry),
            })
          );
        }
      }
      return xdr.ScVal.scvMap(entries);
    }

    case "tuple": {
      const arr = Array.isArray(val) ? val : [];
      const scVals = typeDef.elementTypes.map((elemType, idx) =>
        encodeInputToScVal(arr[idx], elemType, udtRegistry)
      );
      return xdr.ScVal.scvVec(scVals);
    }

    case "udt": {
      const udtName = typeDef.name;
      const udt = udtRegistry.get(udtName);

      if (!udt) {
        if (typeof val === "object" && val !== null) {
          const mapEntries: xdr.ScMapEntry[] = Object.entries(val as Record<string, unknown>).map(
            ([k, v]) =>
              new xdr.ScMapEntry({
                key: xdr.ScVal.scvSymbol(k),
                val: nativeToScVal(v),
              })
          );
          return xdr.ScVal.scvMap(mapEntries);
        }
        return nativeToScVal(val);
      }

      if (udt.udtKind === "struct") {
        const obj = typeof val === "object" && val !== null ? (val as Record<string, unknown>) : {};
        const mapEntries: xdr.ScMapEntry[] = udt.fields.map(
          (field) =>
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol(field.name),
              val: encodeInputToScVal(obj[field.name], field.type, udtRegistry),
            })
        );
        return xdr.ScVal.scvMap(mapEntries);
      }

      if (udt.udtKind === "enum" || udt.udtKind === "errorEnum") {
        const numVal = typeof val === "number" ? val : parseInt(String(val), 10) || 0;
        return xdr.ScVal.scvU32(numVal);
      }

      if (udt.udtKind === "union") {
        const variantObj =
          typeof val === "object" && val !== null
            ? (val as { variant?: string; values?: unknown[] })
            : { variant: String(val) };
        const variantName = String(variantObj.variant || udt.cases[0]?.name || "");
        const matchedCase = udt.cases.find((c) => c.name === variantName) || udt.cases[0];

        if (!matchedCase || matchedCase.kind === "void") {
          return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(variantName)]);
        } else {
          const tupleValues = Array.isArray(variantObj.values) ? variantObj.values : [];
          const payloadVals = matchedCase.types.map((t, idx) =>
            encodeInputToScVal(tupleValues[idx], t, udtRegistry)
          );
          return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(variantName), ...payloadVals]);
        }
      }
    }
  }

  return nativeToScVal(val);
}

/**
 * Format xdr.ScVal result into JSON-serializable JavaScript value.
 */
export function decodeResultNative(scVal: xdr.ScVal): unknown {
  if (!scVal) return null;
  try {
    const native = scValToNative(scVal);
    return JSON.parse(
      JSON.stringify(native, (_k, v) => (typeof v === "bigint" ? v.toString() : v))
    );
  } catch {
    return scVal.toString();
  }
}
