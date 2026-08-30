"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SpecTypeDef, SpecUdt } from "@/lib/stellar/spec-decoder";
import { Plus, Trash2, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslations } from "next-intl";

interface TypedInputProps {
  specType: SpecTypeDef;
  udtRegistry: Map<string, SpecUdt>;
  value: unknown;
  onChange: (val: unknown) => void;
  disabled?: boolean;
  label?: string;
  doc?: string;
  depth?: number;
}

export function TypedInput({
  specType,
  udtRegistry,
  value,
  onChange,
  disabled = false,
  label,
  doc,
  depth = 0,
}: TypedInputProps) {
  const t = useTranslations("contract.typedInput");

  if (depth > 6) {
    return <div className="text-muted-foreground text-xs italic">{t("maxRecursionDepth")}</div>;
  }

  const kind = specType.kind;

  // 1. Primitives (String, Symbol, Address, Bytes, Integers, Booleans)
  if (
    kind === "string" ||
    kind === "symbol" ||
    kind === "val" ||
    kind === "timepoint" ||
    kind === "duration"
  ) {
    const strValue =
      typeof value === "string"
        ? value
        : value !== undefined && value !== null
          ? String(value)
          : "";
    return (
      <div className="space-y-1.5">
        {label && (
          <div className="flex items-center gap-1.5">
            <label className="text-foreground text-xs font-medium">{label}</label>
            <Badge variant="outline" className="px-1 py-0 font-mono text-[10px]">
              {kind}
            </Badge>
            {doc && <DocTooltip doc={doc} />}
          </div>
        )}
        <Input
          type="text"
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={t("enterType", { kind })}
          className="font-mono text-xs"
        />
      </div>
    );
  }

  if (kind === "address") {
    const strValue = typeof value === "string" ? value : "";
    const isValid =
      !strValue ||
      ((strValue.startsWith("G") || strValue.startsWith("C")) && strValue.length === 56);

    return (
      <div className="space-y-1.5">
        {label && (
          <div className="flex items-center gap-1.5">
            <label className="text-foreground text-xs font-medium">{label}</label>
            <Badge variant="outline" className="px-1 py-0 font-mono text-[10px]">
              {t("badgeAddress")}
            </Badge>
            {doc && <DocTooltip doc={doc} />}
          </div>
        )}
        <Input
          type="text"
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={t("addressPlaceholder")}
          className={`font-mono text-xs ${!isValid ? "border-destructive focus-visible:ring-destructive" : ""}`}
        />
        {!isValid && <p className="text-destructive text-[11px]">{t("addressValidation")}</p>}
      </div>
    );
  }

  if (kind === "bytes" || kind === "bytesN") {
    const size =
      kind === "bytesN" ? (specType as { kind: "bytesN"; size: number }).size : undefined;
    const strValue = typeof value === "string" ? value : "";
    return (
      <div className="space-y-1.5">
        {label && (
          <div className="flex items-center gap-1.5">
            <label className="text-foreground text-xs font-medium">{label}</label>
            <Badge variant="outline" className="px-1 py-0 font-mono text-[10px]">
              {kind === "bytesN" ? `bytes[${size}]` : "bytes"}
            </Badge>
            {doc && <DocTooltip doc={doc} />}
          </div>
        )}
        <Input
          type="text"
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={t("hexPlaceholder")}
          className="font-mono text-xs"
        />
      </div>
    );
  }

  if (
    kind === "u32" ||
    kind === "i32" ||
    kind === "u64" ||
    kind === "i64" ||
    kind === "u128" ||
    kind === "i128" ||
    kind === "u256" ||
    kind === "i256"
  ) {
    const strValue = value !== undefined && value !== null ? String(value) : "";
    return (
      <div className="space-y-1.5">
        {label && (
          <div className="flex items-center gap-1.5">
            <label className="text-foreground text-xs font-medium">{label}</label>
            <Badge variant="outline" className="px-1 py-0 font-mono text-[10px]">
              {kind}
            </Badge>
            {doc && <DocTooltip doc={doc} />}
          </div>
        )}
        <Input
          type="text"
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={t("enterInteger", { kind })}
          className="font-mono text-xs"
        />
      </div>
    );
  }

  if (kind === "bool") {
    const boolValue = value === true || value === "true" ? "true" : "false";

    return (
      <div className="space-y-1.5">
        {label && (
          <div className="flex items-center gap-1.5">
            <label className="text-foreground text-xs font-medium">{label}</label>
            <Badge variant="outline" className="px-1 py-0 font-mono text-[10px]">
              {t("badgeBool")}
            </Badge>
            {doc && <DocTooltip doc={doc} />}
          </div>
        )}
        <Select value={boolValue} onValueChange={(v) => onChange(v === "true")} disabled={disabled}>
          <SelectTrigger className="font-mono text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">true</SelectItem>
            <SelectItem value="false">false</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }

  // 2. Option<T>
  if (kind === "option") {
    const optDef = specType as { kind: "option"; valueType: SpecTypeDef };
    const isEnabled = value !== null && value !== undefined;

    return (
      <div className="border-border bg-muted/20 space-y-2 rounded-md border p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="text-foreground text-xs font-medium">
              {label || t("badgeOption")}
            </label>
            <Badge variant="outline" className="font-mono text-[10px]">
              {t("badgeOption")}
            </Badge>
          </div>
          <Button
            type="button"
            variant={isEnabled ? "secondary" : "outline"}
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={() =>
              onChange(isEnabled ? null : getDefaultValue(optDef.valueType, udtRegistry))
            }
            disabled={disabled}
          >
            {isEnabled ? t("setToNone") : t("setValue")}
          </Button>
        </div>
        {isEnabled ? (
          <TypedInput
            specType={optDef.valueType}
            udtRegistry={udtRegistry}
            value={value}
            onChange={onChange}
            disabled={disabled}
            depth={depth + 1}
          />
        ) : (
          <p className="text-muted-foreground text-[11px] italic">{t("noneVoid")}</p>
        )}
      </div>
    );
  }

  // 3. Vec<T>
  if (kind === "vec") {
    const vecDef = specType as { kind: "vec"; elementType: SpecTypeDef };
    const items: unknown[] = Array.isArray(value) ? value : [];

    const handleAddItem = () => {
      onChange([...items, getDefaultValue(vecDef.elementType, udtRegistry)]);
    };

    const handleRemoveItem = (index: number) => {
      const copy = [...items];
      copy.splice(index, 1);
      onChange(copy);
    };

    const handleItemChange = (index: number, val: unknown) => {
      const copy = [...items];
      copy[index] = val;
      onChange(copy);
    };

    return (
      <div className="border-border bg-muted/20 space-y-3 rounded-md border p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="text-foreground text-xs font-medium">
              {label || t("labelVector")}
            </label>
            <Badge variant="outline" className="font-mono text-[10px]">
              {t("badgeVec")}
            </Badge>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 gap-1 px-2 text-[11px]"
            onClick={handleAddItem}
            disabled={disabled}
          >
            <Plus className="size-3" /> {t("addItem")}
          </Button>
        </div>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-[11px] italic">{t("emptyArray")}</p>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="border-border/40 flex items-start gap-2 border-b pb-2 last:border-b-0"
              >
                <div className="flex-1">
                  <TypedInput
                    specType={vecDef.elementType}
                    udtRegistry={udtRegistry}
                    value={item}
                    onChange={(v) => handleItemChange(idx, v)}
                    disabled={disabled}
                    label={`Item [${idx}]`}
                    depth={depth + 1}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:bg-destructive/10 mt-5 size-7"
                  onClick={() => handleRemoveItem(idx)}
                  disabled={disabled}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 4. Map<K, V>
  if (kind === "map") {
    const mapDef = specType as { kind: "map"; keyType: SpecTypeDef; valueType: SpecTypeDef };
    const pairs: { key: unknown; value: unknown }[] = Array.isArray(value)
      ? value
      : Object.entries((value as Record<string, unknown>) || {}).map(([k, v]) => ({
          key: k,
          value: v,
        }));

    const handleAddPair = () => {
      onChange([
        ...pairs,
        {
          key: getDefaultValue(mapDef.keyType, udtRegistry),
          value: getDefaultValue(mapDef.valueType, udtRegistry),
        },
      ]);
    };

    const handleRemovePair = (index: number) => {
      const copy = [...pairs];
      copy.splice(index, 1);
      onChange(copy);
    };

    const handlePairChange = (index: number, field: "key" | "value", val: unknown) => {
      const copy = [...pairs];
      copy[index] = { ...copy[index], [field]: val };
      onChange(copy);
    };

    return (
      <div className="border-border bg-muted/20 space-y-3 rounded-md border p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="text-foreground text-xs font-medium">{label || t("labelMap")}</label>
            <Badge variant="outline" className="font-mono text-[10px]">
              {t("badgeMap")}
            </Badge>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 gap-1 px-2 text-[11px]"
            onClick={handleAddPair}
            disabled={disabled}
          >
            <Plus className="size-3" /> {t("addPair")}
          </Button>
        </div>
        {pairs.length === 0 ? (
          <p className="text-muted-foreground text-[11px] italic">{t("emptyMap")}</p>
        ) : (
          <div className="space-y-3">
            {pairs.map((pair, idx) => (
              <div
                key={idx}
                className="border-border/60 bg-background flex items-start gap-2 rounded border p-2"
              >
                <div className="grid flex-1 gap-2 sm:grid-cols-2">
                  <TypedInput
                    specType={mapDef.keyType}
                    udtRegistry={udtRegistry}
                    value={pair.key}
                    onChange={(v) => handlePairChange(idx, "key", v)}
                    disabled={disabled}
                    label={`Key [${idx}]`}
                    depth={depth + 1}
                  />
                  <TypedInput
                    specType={mapDef.valueType}
                    udtRegistry={udtRegistry}
                    value={pair.value}
                    onChange={(v) => handlePairChange(idx, "value", v)}
                    disabled={disabled}
                    label={`Value [${idx}]`}
                    depth={depth + 1}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:bg-destructive/10 mt-5 size-7"
                  onClick={() => handleRemovePair(idx)}
                  disabled={disabled}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 5. UDT (Struct, Union, Enum, ErrorEnum)
  if (kind === "udt") {
    const udtName = (specType as { kind: "udt"; name: string }).name;
    const udt = udtRegistry.get(udtName);

    if (!udt) {
      return (
        <div className="space-y-1.5">
          {label && <label className="text-foreground text-xs font-medium">{label}</label>}
          <Input
            type="text"
            value={
              typeof value === "object"
                ? JSON.stringify(value)
                : value !== undefined && value !== null
                  ? String(value)
                  : ""
            }
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder={t("udtFallback", { name: udtName })}
            className="font-mono text-xs"
          />
        </div>
      );
    }

    if (udt.udtKind === "struct") {
      const obj =
        typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

      const handleFieldChange = (fieldName: string, val: unknown) => {
        onChange({ ...obj, [fieldName]: val });
      };

      return (
        <div className="border-border bg-muted/20 space-y-3 rounded-md border p-3">
          <div className="flex items-center gap-2">
            <label className="text-foreground text-xs font-medium">{label || udt.name}</label>
            <Badge variant="secondary" className="font-mono text-[10px]">
              {t("badgeStruct")} {udt.name}
            </Badge>
            {udt.doc && <DocTooltip doc={udt.doc} />}
          </div>
          <div className="space-y-3 pl-1">
            {udt.fields.map((field) => (
              <TypedInput
                key={field.name}
                specType={field.type}
                udtRegistry={udtRegistry}
                value={obj[field.name]}
                onChange={(v) => handleFieldChange(field.name, v)}
                disabled={disabled}
                label={field.name}
                doc={field.doc}
                depth={depth + 1}
              />
            ))}
          </div>
        </div>
      );
    }

    if (udt.udtKind === "enum" || udt.udtKind === "errorEnum") {
      const currentVal =
        value !== undefined && value !== null ? String(value) : String(udt.cases[0]?.value ?? 0);

      return (
        <div className="space-y-1.5">
          {label && (
            <div className="flex items-center gap-1.5">
              <label className="text-foreground text-xs font-medium">{label}</label>
              <Badge variant="secondary" className="font-mono text-[10px]">
                {udt.udtKind} {udt.name}
              </Badge>
              {udt.doc && <DocTooltip doc={udt.doc} />}
            </div>
          )}
          <Select
            value={currentVal}
            onValueChange={(v) => onChange(parseInt(v, 10))}
            disabled={disabled}
          >
            <SelectTrigger className="font-mono text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {udt.cases.map((c) => (
                <SelectItem key={c.name} value={String(c.value)}>
                  {c.name} ({c.value}) {c.doc ? `- ${c.doc}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (udt.udtKind === "union") {
      const obj =
        typeof value === "object" && value !== null
          ? (value as { variant?: string; values?: unknown[] })
          : {};
      const selectedVariant = obj.variant || udt.cases[0]?.name || "";
      const matchedCase = udt.cases.find((c) => c.name === selectedVariant) || udt.cases[0];

      const handleVariantSelect = (variantName: string) => {
        const c = udt.cases.find((item) => item.name === variantName);
        if (!c || c.kind === "void") {
          onChange({ variant: variantName });
        } else {
          const defaultTupleVals = c.types.map((t) => getDefaultValue(t, udtRegistry));
          onChange({ variant: variantName, values: defaultTupleVals });
        }
      };

      const handleTupleValueChange = (idx: number, val: unknown) => {
        const currentTuple = Array.isArray(obj.values) ? [...obj.values] : [];
        currentTuple[idx] = val;
        onChange({ ...obj, values: currentTuple });
      };

      return (
        <div className="border-border bg-muted/20 space-y-3 rounded-md border p-3">
          <div className="flex items-center gap-2">
            <label className="text-foreground text-xs font-medium">{label || udt.name}</label>
            <Badge variant="secondary" className="font-mono text-[10px]">
              {t("badgeUnion")} {udt.name}
            </Badge>
            {udt.doc && <DocTooltip doc={udt.doc} />}
          </div>

          <div className="space-y-2">
            <Select value={selectedVariant} onValueChange={handleVariantSelect} disabled={disabled}>
              <SelectTrigger className="font-mono text-xs">
                <SelectValue placeholder={t("selectVariant")} />
              </SelectTrigger>
              <SelectContent>
                {udt.cases.map((c) => (
                  <SelectItem key={c.name} value={c.name}>
                    {c.name} ({c.kind}) {c.doc ? `- ${c.doc}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {matchedCase && matchedCase.kind === "tuple" && (
              <div className="border-primary/30 space-y-2 border-l-2 pt-2 pl-3">
                <p className="text-muted-foreground text-[11px] font-medium">
                  {t("tuplePayloadArgs")}
                </p>
                {matchedCase.types.map((payloadType, idx) => (
                  <TypedInput
                    key={idx}
                    specType={payloadType}
                    udtRegistry={udtRegistry}
                    value={Array.isArray(obj.values) ? obj.values[idx] : undefined}
                    onChange={(v) => handleTupleValueChange(idx, v)}
                    disabled={disabled}
                    label={`Arg [${idx}]`}
                    depth={depth + 1}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }
  }

  // Fallback default input
  const defaultStrValue = value !== undefined && value !== null ? String(value) : "";
  return (
    <Input
      type="text"
      value={defaultStrValue}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={t("valuePlaceholder")}
      className="font-mono text-xs"
    />
  );
}

function DocTooltip({ doc }: { doc: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="text-muted-foreground hover:text-foreground size-3.5 cursor-help" />
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs text-xs">{doc}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Return appropriate default initial value for a given SpecTypeDef.
 */
export function getDefaultValue(typeDef: SpecTypeDef, udtRegistry: Map<string, SpecUdt>): unknown {
  switch (typeDef.kind) {
    case "bool":
      return false;
    case "void":
      return null;
    case "u32":
    case "i32":
    case "u64":
    case "i64":
    case "u128":
    case "i128":
    case "u256":
    case "i256":
    case "timepoint":
    case "duration":
      return "0";
    case "symbol":
    case "string":
    case "bytes":
    case "bytesN":
    case "val":
      return "";
    case "address":
      return "";
    case "option":
      return null;
    case "vec":
    case "tuple":
      return [];
    case "map":
      return [];
    case "udt": {
      const udt = udtRegistry.get(typeDef.name);
      if (!udt) return "";
      if (udt.udtKind === "struct") {
        const obj: Record<string, unknown> = {};
        for (const f of udt.fields) {
          obj[f.name] = getDefaultValue(f.type, udtRegistry);
        }
        return obj;
      }
      if (udt.udtKind === "enum" || udt.udtKind === "errorEnum") {
        return udt.cases[0]?.value ?? 0;
      }
      if (udt.udtKind === "union") {
        const firstCase = udt.cases[0];
        if (!firstCase || firstCase.kind === "void") {
          return { variant: firstCase?.name || "" };
        }
        return {
          variant: firstCase.name,
          values: firstCase.types.map((t) => getDefaultValue(t, udtRegistry)),
        };
      }
      return "";
    }
    default:
      return "";
  }
}
