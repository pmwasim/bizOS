import { describe, expect, it } from "vitest";
import { evaluateGuard } from "./guard-interpreter.js";
import type { WorkflowGuardCondition } from "@bizo/contracts/workflows";

describe("EMPIRICAL STRESS TEST: AST Guard Interpreter", () => {
  it("Stress AST-1: Coercion protection where null/false/empty-string do NOT masquerade as 0 in numeric comparisons", () => {
    const conditionGt15: WorkflowGuardCondition = {
      field: "discountPercent",
      operator: "gt",
      value: 15,
    };

    expect(evaluateGuard([conditionGt15], { discountPercent: 20 }).allowed).toBe(true);

    const conditionLte15: WorkflowGuardCondition = {
      field: "discountPercent",
      operator: "lte",
      value: 15,
    };

    // When discountPercent is null in context:
    const evalNullLte = evaluateGuard([conditionLte15], { discountPercent: null });
    expect(evalNullLte.allowed).toBe(false);

    // When discountPercent is false:
    const evalFalseLte = evaluateGuard([conditionLte15], { discountPercent: false });
    expect(evalFalseLte.allowed).toBe(false);

    // When discountPercent is empty string "":
    const evalEmptyStrLte = evaluateGuard([conditionLte15], { discountPercent: "" });
    expect(evalEmptyStrLte.allowed).toBe(false);
  });

  it("Stress AST-2: Equality coercion protection with empty strings and zeroes", () => {
    const conditionEqZero: WorkflowGuardCondition = {
      field: "status",
      operator: "eq",
      value: 0,
    };

    const resEmptyStr = evaluateGuard([conditionEqZero], { status: "" });
    expect(resEmptyStr.allowed).toBe(false);

    const resWhitespace = evaluateGuard([conditionEqZero], { status: "   " });
    expect(resWhitespace.allowed).toBe(false);
  });

  it("Stress AST-3: Protection against Prototype Pollution via field path resolution", () => {
    const conditionProto: WorkflowGuardCondition = {
      field: "__proto__.polluted",
      operator: "exists",
      value: true,
    };

    const result = evaluateGuard([conditionProto], { normal: "data" });
    expect(result.allowed).toBe(false);
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("Stress AST-4: Rejects unknown operators with loud TypeError exception", () => {
    const invalidCondition = {
      field: "amount",
      operator: "INVALID_OP" as never,
      value: 100,
    };

    expect(() => evaluateGuard([invalidCondition], { amount: 50 })).toThrow(TypeError);
    expect(() => evaluateGuard([invalidCondition], { amount: 50 })).toThrow(
      "Unknown guard operator",
    );
  });
});
