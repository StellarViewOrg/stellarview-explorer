import { describe, it, expect } from "vitest";
import { xdr, nativeToScVal } from "@stellar/stellar-sdk";
import {
  decodeContractSpec,
  extractSpecCustomSection,
  parseScSpecEntries,
  encodeInputToScVal,
  decodeResultNative,
} from "./spec-decoder";
import { buildSampleWasm, buildSampleSpecEntries } from "./__fixtures__/sample-contract-spec";

describe("spec-decoder", () => {
  it("decodes functions, structs, unions, enums, and error enums", () => {
    const fnEntry = xdr.ScSpecEntry.scSpecEntryFunctionV0(
      new xdr.ScSpecFunctionV0({
        doc: "Transfer tokens",
        name: "transfer",
        inputs: [
          new xdr.ScSpecFunctionInputV0({
            doc: "Recipient",
            name: "to",
            type: xdr.ScSpecTypeDef.scSpecTypeAddress(),
          }),
          new xdr.ScSpecFunctionInputV0({
            doc: "Amount",
            name: "amount",
            type: xdr.ScSpecTypeDef.scSpecTypeI128(),
          }),
        ],
        outputs: [xdr.ScSpecTypeDef.scSpecTypeBool()],
      })
    );

    const structEntry = xdr.ScSpecEntry.scSpecEntryUdtStructV0(
      new xdr.ScSpecUdtStructV0({
        doc: "User profile",
        lib: "",
        name: "UserProfile",
        fields: [
          new xdr.ScSpecUdtStructFieldV0({
            doc: "User name",
            name: "name",
            type: xdr.ScSpecTypeDef.scSpecTypeString(),
          }),
          new xdr.ScSpecUdtStructFieldV0({
            doc: "Age",
            name: "age",
            type: xdr.ScSpecTypeDef.scSpecTypeU32(),
          }),
        ],
      })
    );

    const unionEntry = xdr.ScSpecEntry.scSpecEntryUdtUnionV0(
      new xdr.ScSpecUdtUnionV0({
        doc: "Action status",
        lib: "",
        name: "ActionStatus",
        cases: [
          xdr.ScSpecUdtUnionCaseV0.scSpecUdtUnionCaseVoidV0(
            new xdr.ScSpecUdtUnionCaseVoidV0({
              doc: "Pending",
              name: "Pending",
            })
          ),
          xdr.ScSpecUdtUnionCaseV0.scSpecUdtUnionCaseTupleV0(
            new xdr.ScSpecUdtUnionCaseTupleV0({
              doc: "Completed",
              name: "Completed",
              type: [xdr.ScSpecTypeDef.scSpecTypeU64()],
            })
          ),
        ],
      })
    );

    const enumEntry = xdr.ScSpecEntry.scSpecEntryUdtEnumV0(
      new xdr.ScSpecUdtEnumV0({
        doc: "Role enum",
        lib: "",
        name: "Role",
        cases: [
          new xdr.ScSpecUdtEnumCaseV0({ doc: "Admin", name: "Admin", value: 0 }),
          new xdr.ScSpecUdtEnumCaseV0({ doc: "User", name: "User", value: 1 }),
        ],
      })
    );

    const errorEnumEntry = xdr.ScSpecEntry.scSpecEntryUdtErrorEnumV0(
      new xdr.ScSpecUdtErrorEnumV0({
        doc: "Contract errors",
        lib: "",
        name: "CustomError",
        cases: [
          new xdr.ScSpecUdtErrorEnumCaseV0({
            doc: "Not authorized",
            name: "Unauthorized",
            value: 1,
          }),
          new xdr.ScSpecUdtErrorEnumCaseV0({
            doc: "Insufficient balance",
            name: "Overflow",
            value: 2,
          }),
        ],
      })
    );

    const parsed = parseScSpecEntries([
      fnEntry,
      structEntry,
      unionEntry,
      enumEntry,
      errorEnumEntry,
    ]);

    expect(parsed.functions).toHaveLength(1);
    expect(parsed.functions[0].name).toBe("transfer");
    expect(parsed.functions[0].inputs).toHaveLength(2);
    expect(parsed.functions[0].inputs[0].type).toEqual({ kind: "address" });

    expect(parsed.structs.has("UserProfile")).toBe(true);
    expect(parsed.structs.get("UserProfile")?.fields).toHaveLength(2);

    expect(parsed.unions.has("ActionStatus")).toBe(true);
    expect(parsed.unions.get("ActionStatus")?.cases).toHaveLength(2);

    expect(parsed.enums.has("Role")).toBe(true);
    expect(parsed.enums.get("Role")?.cases).toHaveLength(2);

    expect(parsed.errorEnums.has("CustomError")).toBe(true);
    expect(parsed.errorEnums.get("CustomError")?.cases).toHaveLength(2);
  });

  it("extracts contractspecv0 from fake WASM buffer", () => {
    const fnEntry = xdr.ScSpecEntry.scSpecEntryFunctionV0(
      new xdr.ScSpecFunctionV0({ doc: "", name: "ping", inputs: [], outputs: [] })
    );
    const specData = fnEntry.toXDR();

    const magic = Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
    const sectionName = Buffer.from("contractspecv0");
    const payload = Buffer.concat([Buffer.from([sectionName.length]), sectionName, specData]);
    const section = Buffer.concat([Buffer.from([0x00, payload.length]), payload]);
    const wasm = Buffer.concat([magic, section]);

    const extracted = extractSpecCustomSection(wasm);
    expect(extracted.length).toBeGreaterThan(0);

    const parsed = decodeContractSpec(wasm);
    expect(parsed.functions).toHaveLength(1);
    expect(parsed.functions[0].name).toBe("ping");
  });

  it("encodes inputs to xdr.ScVal for primitives and UDTs", () => {
    const udtRegistry = new Map();
    udtRegistry.set("UserProfile", {
      udtKind: "struct",
      name: "UserProfile",
      lib: "",
      doc: "",
      fields: [
        { name: "name", doc: "", type: { kind: "string" } },
        { name: "age", doc: "", type: { kind: "u32" } },
      ],
    });

    const addr = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
    const addrScVal = encodeInputToScVal(addr, { kind: "address" }, udtRegistry);
    expect(addrScVal.switch().name).toBe("scvAddress");

    const structScVal = encodeInputToScVal(
      { name: "Alice", age: 30 },
      { kind: "udt", name: "UserProfile" },
      udtRegistry
    );
    expect(structScVal.switch().name).toBe("scvMap");

    const vecScVal = encodeInputToScVal(
      [1, 2, 3],
      { kind: "vec", elementType: { kind: "u32" } },
      udtRegistry
    );
    expect(vecScVal.switch().name).toBe("scvVec");
  });

  it("decodes xdr.ScVal to native JS object", () => {
    const scVal = nativeToScVal(42, { type: "u32" });
    const native = decodeResultNative(scVal);
    expect(native).toBe(42);
  });

  describe("real WASM fixture", () => {
    it("parses a realistic contractspecv0 WASM into a full ParsedSpec", () => {
      const wasm = buildSampleWasm();
      const spec = decodeContractSpec(wasm);

      // Should have 5 functions: initialize, transfer, balance, batch_transfer, get_metadata
      expect(spec.functions).toHaveLength(5);

      const fnNames = spec.functions.map((f) => f.name);
      expect(fnNames).toContain("initialize");
      expect(fnNames).toContain("transfer");
      expect(fnNames).toContain("balance");
      expect(fnNames).toContain("batch_transfer");
      expect(fnNames).toContain("get_metadata");

      // Struct: TokenMetadata with 3 fields
      expect(spec.structs.has("TokenMetadata")).toBe(true);
      const tokenMeta = spec.structs.get("TokenMetadata")!;
      expect(tokenMeta.fields).toHaveLength(3);
      expect(tokenMeta.fields.map((f) => f.name)).toEqual(["name", "symbol", "decimals"]);

      // Enum: ContractState with 4 cases
      expect(spec.enums.has("ContractState")).toBe(true);
      const stateEnum = spec.enums.get("ContractState")!;
      expect(stateEnum.cases).toHaveLength(4);
      expect(stateEnum.cases.map((c) => c.name)).toEqual([
        "Uninitialized",
        "Active",
        "Frozen",
        "Stopped",
      ]);

      // Union: TransferResult with 3 cases
      expect(spec.unions.has("TransferResult")).toBe(true);
      const transferUnion = spec.unions.get("TransferResult")!;
      expect(transferUnion.cases).toHaveLength(3);
      expect(transferUnion.cases[0]).toEqual({
        kind: "void",
        name: "Success",
        doc: "Transfer succeeded",
      });

      // Error Enum: TokenError with 4 cases
      expect(spec.errorEnums.has("TokenError")).toBe(true);
      const tokenError = spec.errorEnums.get("TokenError")!;
      expect(tokenError.cases).toHaveLength(4);

      // UDT registry should have all 4 types
      expect(spec.udtRegistry.size).toBe(4);
    });

    it("correctly decodes function with struct UDT parameter", () => {
      const entries = buildSampleSpecEntries();
      const parsed = parseScSpecEntries(entries);

      const initFn = parsed.functions.find((f) => f.name === "initialize")!;
      expect(initFn).toBeDefined();
      expect(initFn.inputs).toHaveLength(2);
      expect(initFn.inputs[0].type).toEqual({ kind: "address" });
      expect(initFn.inputs[1].type).toEqual({ kind: "udt", name: "TokenMetadata" });
    });

    it("correctly decodes function with Vec<Tuple> parameter", () => {
      const entries = buildSampleSpecEntries();
      const parsed = parseScSpecEntries(entries);

      const batchFn = parsed.functions.find((f) => f.name === "batch_transfer")!;
      expect(batchFn).toBeDefined();
      expect(batchFn.inputs).toHaveLength(2);

      const transfersParam = batchFn.inputs[1];
      expect(transfersParam.type).toEqual({
        kind: "vec",
        elementType: {
          kind: "tuple",
          elementTypes: [{ kind: "address" }, { kind: "i128" }],
        },
      });
    });

    it("correctly decodes function returning a union UDT", () => {
      const entries = buildSampleSpecEntries();
      const parsed = parseScSpecEntries(entries);

      const transferFn = parsed.functions.find((f) => f.name === "transfer")!;
      expect(transferFn).toBeDefined();
      expect(transferFn.outputs).toHaveLength(1);
      expect(transferFn.outputs[0]).toEqual({ kind: "udt", name: "TransferResult" });
    });
  });

  describe("encodeInputToScVal edge cases", () => {
    it("encodes option type as void when null", () => {
      const udtRegistry = new Map();
      const scVal = encodeInputToScVal(
        null,
        { kind: "option", valueType: { kind: "string" } },
        udtRegistry
      );
      expect(scVal.switch().name).toBe("scvVoid");
    });

    it("encodes option type with inner value", () => {
      const udtRegistry = new Map();
      const scVal = encodeInputToScVal(
        "hello",
        { kind: "option", valueType: { kind: "string" } },
        udtRegistry
      );
      expect(scVal.switch().name).toBe("scvString");
    });

    it("encodes map type with key-value pairs", () => {
      const udtRegistry = new Map();
      const scVal = encodeInputToScVal(
        { foo: 42, bar: 100 },
        { kind: "map", keyType: { kind: "string" }, valueType: { kind: "u32" } },
        udtRegistry
      );
      expect(scVal.switch().name).toBe("scvMap");
    });

    it("encodes enum UDT as u32", () => {
      const udtRegistry = new Map();
      udtRegistry.set("Role", {
        udtKind: "enum",
        name: "Role",
        lib: "",
        doc: "",
        cases: [
          { name: "Admin", doc: "", value: 0 },
          { name: "User", doc: "", value: 1 },
        ],
      });
      const scVal = encodeInputToScVal(1, { kind: "udt", name: "Role" }, udtRegistry);
      expect(scVal.switch().name).toBe("scvU32");
    });

    it("encodes union UDT with void variant", () => {
      const udtRegistry = new Map();
      udtRegistry.set("Status", {
        udtKind: "union",
        name: "Status",
        lib: "",
        doc: "",
        cases: [
          { kind: "void", name: "Active", doc: "" },
          { kind: "tuple", name: "Error", doc: "", types: [{ kind: "string" }] },
        ],
      });
      const scVal = encodeInputToScVal(
        { variant: "Active" },
        { kind: "udt", name: "Status" },
        udtRegistry
      );
      expect(scVal.switch().name).toBe("scvVec");
    });
  });
});
