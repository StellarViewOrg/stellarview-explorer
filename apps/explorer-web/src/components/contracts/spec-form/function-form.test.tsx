import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { FunctionForm } from "./function-form";
import { SpecFunction, SpecUdt } from "@/lib/stellar/spec-decoder";
import en from "../../../../messages/en.json";

const CONTRACT_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      {ui}
    </NextIntlClientProvider>
  );
}

function buildUdtRegistry(...udts: SpecUdt[]): Map<string, SpecUdt> {
  const map = new Map<string, SpecUdt>();
  for (const u of udts) {
    map.set(u.name, u);
  }
  return map;
}

describe("FunctionForm", () => {
  it("renders function name, doc, and input parameters correctly", () => {
    const fn: SpecFunction = {
      name: "balance",
      doc: "Get balance of account",
      inputs: [
        {
          name: "id",
          doc: "Target account",
          type: { kind: "address" },
        },
      ],
      outputs: [{ kind: "i128" }],
    };

    renderWithIntl(
      <FunctionForm
        contractId={CONTRACT_ID}
        fn={fn}
        udtRegistry={new Map()}
        network="testnet"
        connectedPublicKey={null}
        onConnectWallet={vi.fn()}
      />
    );

    expect(screen.getByText("balance")).toBeTruthy();
    expect(screen.getByText("Get balance of account")).toBeTruthy();
    expect(screen.getByText("id")).toBeTruthy();
  });

  it("renders struct UDT parameter with nested fields", () => {
    const profileStruct: SpecUdt = {
      udtKind: "struct",
      name: "UserProfile",
      lib: "",
      doc: "User profile data",
      fields: [
        { name: "name", doc: "User name", type: { kind: "string" } },
        { name: "age", doc: "User age", type: { kind: "u32" } },
        { name: "email", doc: "Email address", type: { kind: "string" } },
      ],
    };

    const fn: SpecFunction = {
      name: "create_user",
      doc: "Create a new user profile",
      inputs: [
        {
          name: "profile",
          doc: "User profile data",
          type: { kind: "udt", name: "UserProfile" },
        },
      ],
      outputs: [{ kind: "bool" }],
    };

    const registry = buildUdtRegistry(profileStruct);

    renderWithIntl(
      <FunctionForm
        contractId={CONTRACT_ID}
        fn={fn}
        udtRegistry={registry}
        network="testnet"
        connectedPublicKey={null}
        onConnectWallet={vi.fn()}
      />
    );

    // Should show the function name and struct label
    expect(screen.getByText("create_user")).toBeTruthy();
    expect(screen.getByText("Create a new user profile")).toBeTruthy();
    expect(screen.getByText("profile")).toBeTruthy();
    // The struct fields should be rendered as nested inputs
    expect(screen.getByText("name")).toBeTruthy();
    expect(screen.getByText("age")).toBeTruthy();
    expect(screen.getByText("email")).toBeTruthy();
  });

  it("renders enum UDT parameter as a select dropdown", () => {
    const roleEnum: SpecUdt = {
      udtKind: "enum",
      name: "Role",
      lib: "",
      doc: "User role",
      cases: [
        { name: "Admin", doc: "Administrator", value: 0 },
        { name: "User", doc: "Regular user", value: 1 },
        { name: "Guest", doc: "Guest access", value: 2 },
      ],
    };

    const fn: SpecFunction = {
      name: "set_role",
      doc: "Set user role",
      inputs: [
        {
          name: "role",
          doc: "The role to assign",
          type: { kind: "udt", name: "Role" },
        },
      ],
      outputs: [],
    };

    const registry = buildUdtRegistry(roleEnum);

    renderWithIntl(
      <FunctionForm
        contractId={CONTRACT_ID}
        fn={fn}
        udtRegistry={registry}
        network="testnet"
        connectedPublicKey={null}
        onConnectWallet={vi.fn()}
      />
    );

    expect(screen.getByText("set_role")).toBeTruthy();
    expect(screen.getByText("role")).toBeTruthy();
    // The enum badge should show the type
    expect(screen.getByText(/enum Role/)).toBeTruthy();
  });

  it("renders union UDT parameter with variant selector", () => {
    const resultUnion: SpecUdt = {
      udtKind: "union",
      name: "ActionResult",
      lib: "",
      doc: "Result of an action",
      cases: [
        { kind: "void", name: "Success", doc: "Operation succeeded" },
        {
          kind: "tuple",
          name: "Error",
          doc: "Operation failed",
          types: [{ kind: "string" }],
        },
      ],
    };

    const fn: SpecFunction = {
      name: "execute",
      doc: "Execute an action",
      inputs: [
        {
          name: "result",
          doc: "Action result",
          type: { kind: "udt", name: "ActionResult" },
        },
      ],
      outputs: [],
    };

    const registry = buildUdtRegistry(resultUnion);

    renderWithIntl(
      <FunctionForm
        contractId={CONTRACT_ID}
        fn={fn}
        udtRegistry={registry}
        network="testnet"
        connectedPublicKey={null}
        onConnectWallet={vi.fn()}
      />
    );

    expect(screen.getByText("execute")).toBeTruthy();
    expect(screen.getByText("result")).toBeTruthy();
    // Union badge should show the type
    expect(screen.getByText(/union ActionResult/)).toBeTruthy();
  });

  it("renders Vec parameter with add/remove item controls", () => {
    const fn: SpecFunction = {
      name: "add_tags",
      doc: "Add tags to an entity",
      inputs: [
        {
          name: "tags",
          doc: "List of tags",
          type: { kind: "vec", elementType: { kind: "string" } },
        },
      ],
      outputs: [],
    };

    renderWithIntl(
      <FunctionForm
        contractId={CONTRACT_ID}
        fn={fn}
        udtRegistry={new Map()}
        network="testnet"
        connectedPublicKey={null}
        onConnectWallet={vi.fn()}
      />
    );

    expect(screen.getByText("add_tags")).toBeTruthy();
    expect(screen.getByText("tags")).toBeTruthy();
    // Vec should have an "Add item" button
    expect(screen.getByText(/Add item/)).toBeTruthy();
  });

  it("renders Map parameter with add/remove pair controls", () => {
    const fn: SpecFunction = {
      name: "set_config",
      doc: "Set configuration key-value pairs",
      inputs: [
        {
          name: "config",
          doc: "Configuration map",
          type: {
            kind: "map",
            keyType: { kind: "string" },
            valueType: { kind: "string" },
          },
        },
      ],
      outputs: [],
    };

    renderWithIntl(
      <FunctionForm
        contractId={CONTRACT_ID}
        fn={fn}
        udtRegistry={new Map()}
        network="testnet"
        connectedPublicKey={null}
        onConnectWallet={vi.fn()}
      />
    );

    expect(screen.getByText("set_config")).toBeTruthy();
    expect(screen.getByText("config")).toBeTruthy();
    // Map should have an "Add pair" button
    expect(screen.getByText(/Add pair/)).toBeTruthy();
  });

  it("renders Option parameter with toggle control", () => {
    const fn: SpecFunction = {
      name: "update_email",
      doc: "Update optional email",
      inputs: [
        {
          name: "email",
          doc: "Optional email address",
          type: { kind: "option", valueType: { kind: "string" } },
        },
      ],
      outputs: [],
    };

    renderWithIntl(
      <FunctionForm
        contractId={CONTRACT_ID}
        fn={fn}
        udtRegistry={new Map()}
        network="testnet"
        connectedPublicKey={null}
        onConnectWallet={vi.fn()}
      />
    );

    expect(screen.getByText("update_email")).toBeTruthy();
    // Option should have the label and Option badge
    const emailLabels = screen.getAllByText("email");
    expect(emailLabels.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Option")).toBeTruthy();
  });

  it("renders multiple parameter types in a single function", () => {
    const profileStruct: SpecUdt = {
      udtKind: "struct",
      name: "Profile",
      lib: "",
      doc: "",
      fields: [{ name: "bio", doc: "", type: { kind: "string" } }],
    };

    const fn: SpecFunction = {
      name: "complex_op",
      doc: "A complex operation",
      inputs: [
        { name: "addr", doc: "", type: { kind: "address" } },
        { name: "amount", doc: "", type: { kind: "i128" } },
        { name: "tags", doc: "", type: { kind: "vec", elementType: { kind: "string" } } },
        {
          name: "metadata",
          doc: "",
          type: { kind: "map", keyType: { kind: "string" }, valueType: { kind: "u32" } },
        },
        {
          name: "profile",
          doc: "",
          type: { kind: "udt", name: "Profile" },
        },
        {
          name: "memo",
          doc: "",
          type: { kind: "option", valueType: { kind: "string" } },
        },
      ],
      outputs: [{ kind: "bool" }],
    };

    const registry = buildUdtRegistry(profileStruct);

    renderWithIntl(
      <FunctionForm
        contractId={CONTRACT_ID}
        fn={fn}
        udtRegistry={registry}
        network="testnet"
        connectedPublicKey={null}
        onConnectWallet={vi.fn()}
      />
    );

    expect(screen.getByText("complex_op")).toBeTruthy();
    expect(screen.getByText("A complex operation")).toBeTruthy();
    // All parameter names should be visible (some may appear multiple times)
    expect(screen.getAllByText("addr").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("amount").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("tags").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("metadata").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("profile").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("memo").length).toBeGreaterThanOrEqual(1);
    // Should show badges for each type
    expect(screen.getAllByText(/address/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/i128/)).toBeTruthy();
    expect(screen.getAllByText(/Vec/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Map/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Option/).length).toBeGreaterThanOrEqual(1);
  });
});
