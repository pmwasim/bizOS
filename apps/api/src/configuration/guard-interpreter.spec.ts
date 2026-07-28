import { describe, expect, it } from "vitest";

import type { WorkflowGuardCondition } from "@bizo/contracts/workflows";

import { evaluateGuard } from "./guard-interpreter.js";

describe("guard interpreter", () => {
  it("allows when there are no conditions", () => {
    expect(evaluateGuard([], { document: { status: "DRAFT" } })).toEqual({
      allowed: true,
    });
  });

  it("supports eq with a string value", () => {
    const condition: WorkflowGuardCondition = {
      field: "document.status",
      operator: "eq",
      value: "READY_TO_SEND",
    };
    expect(evaluateGuard([condition], { document: { status: "READY_TO_SEND" } })).toEqual({
      allowed: true,
    });
    expect(evaluateGuard([condition], { document: { status: "DRAFT" } })).toEqual({
      allowed: false,
      failedCondition: condition,
    });
  });

  it("supports eq with numeric coercion across JSON boundaries", () => {
    const condition: WorkflowGuardCondition = {
      field: "amount",
      operator: "eq",
      value: 100,
    };
    expect(evaluateGuard([condition], { amount: "100" })).toEqual({ allowed: true });
    expect(evaluateGuard([condition], { amount: 100 })).toEqual({ allowed: true });
    expect(evaluateGuard([condition], { amount: 200 })).toEqual({
      allowed: false,
      failedCondition: condition,
    });
  });

  it("supports neq", () => {
    const condition: WorkflowGuardCondition = {
      field: "document.status",
      operator: "neq",
      value: "ARCHIVED",
    };
    expect(evaluateGuard([condition], { document: { status: "DRAFT" } })).toEqual({
      allowed: true,
    });
    expect(evaluateGuard([condition], { document: { status: "ARCHIVED" } })).toEqual({
      allowed: false,
      failedCondition: condition,
    });
  });

  it("supports lt, lte, gt, gte with numeric values", () => {
    const lt: WorkflowGuardCondition = { field: "total", operator: "lt", value: 100 };
    const lte: WorkflowGuardCondition = { field: "total", operator: "lte", value: 100 };
    const gt: WorkflowGuardCondition = { field: "total", operator: "gt", value: 100 };
    const gte: WorkflowGuardCondition = { field: "total", operator: "gte", value: 100 };

    expect(evaluateGuard([lt], { total: 50 }).allowed).toBe(true);
    expect(evaluateGuard([lt], { total: 100 }).allowed).toBe(false);
    expect(evaluateGuard([lt], { total: 150 }).allowed).toBe(false);

    expect(evaluateGuard([lte], { total: 100 }).allowed).toBe(true);
    expect(evaluateGuard([lte], { total: 101 }).allowed).toBe(false);

    expect(evaluateGuard([gt], { total: 150 }).allowed).toBe(true);
    expect(evaluateGuard([gt], { total: 100 }).allowed).toBe(false);

    expect(evaluateGuard([gte], { total: 100 }).allowed).toBe(true);
    expect(evaluateGuard([gte], { total: 50 }).allowed).toBe(false);
  });

  it("coerces numeric strings for ordering operators", () => {
    const gte: WorkflowGuardCondition = { field: "total", operator: "gte", value: 100 };
    expect(evaluateGuard([gte], { total: "150" }).allowed).toBe(true);
    expect(evaluateGuard([gte], { total: "50" }).allowed).toBe(false);
  });

  it("treats non-numeric values as failing ordering guards", () => {
    const gte: WorkflowGuardCondition = { field: "total", operator: "gte", value: 100 };
    expect(evaluateGuard([gte], { total: "not-a-number" }).allowed).toBe(false);
    expect(evaluateGuard([gte], { total: null }).allowed).toBe(false);
  });

  it("supports in with an array of strings", () => {
    const condition: WorkflowGuardCondition = {
      field: "document.type",
      operator: "in",
      value: ["QUOTATION", "INVOICE"],
    };
    expect(evaluateGuard([condition], { document: { type: "QUOTATION" } })).toEqual({
      allowed: true,
    });
    expect(evaluateGuard([condition], { document: { type: "PO" } })).toEqual({
      allowed: false,
      failedCondition: condition,
    });
  });

  it("supports notIn with an array of strings", () => {
    const condition: WorkflowGuardCondition = {
      field: "document.type",
      operator: "notIn",
      value: ["QUOTATION", "INVOICE"],
    };
    expect(evaluateGuard([condition], { document: { type: "PO" } })).toEqual({
      allowed: true,
    });
    expect(evaluateGuard([condition], { document: { type: "QUOTATION" } })).toEqual({
      allowed: false,
      failedCondition: condition,
    });
  });

  it("supports exists for present and absent fields", () => {
    const condition: WorkflowGuardCondition = {
      field: "purchaseOrder",
      operator: "exists",
    };
    expect(evaluateGuard([condition], { purchaseOrder: { id: "po-1" } })).toEqual({
      allowed: true,
    });
    expect(evaluateGuard([condition], { purchaseOrder: null })).toEqual({
      allowed: false,
      failedCondition: condition,
    });
    expect(evaluateGuard([condition], {})).toEqual({
      allowed: false,
      failedCondition: condition,
    });
  });

  it("supports notExists for absent fields", () => {
    const condition: WorkflowGuardCondition = {
      field: "approvalEvidence",
      operator: "notExists",
    };
    expect(evaluateGuard([condition], {})).toEqual({ allowed: true });
    expect(evaluateGuard([condition], { approvalEvidence: null })).toEqual({
      allowed: true,
    });
    expect(evaluateGuard([condition], { approvalEvidence: { id: "ev-1" } })).toEqual({
      allowed: false,
      failedCondition: condition,
    });
  });

  it("ANDs multiple conditions together and reports the first failure", () => {
    const statusCondition: WorkflowGuardCondition = {
      field: "document.status",
      operator: "eq",
      value: "READY_TO_SEND",
    };
    const poCondition: WorkflowGuardCondition = {
      field: "purchaseOrder",
      operator: "exists",
    };
    const approvalCondition: WorkflowGuardCondition = {
      field: "purchaseOrder.approvalStatus",
      operator: "eq",
      value: "APPROVED",
    };

    expect(
      evaluateGuard([statusCondition, poCondition, approvalCondition], {
        document: { status: "READY_TO_SEND" },
        purchaseOrder: { approvalStatus: "APPROVED" },
      }),
    ).toEqual({ allowed: true });

    expect(
      evaluateGuard([statusCondition, poCondition, approvalCondition], {
        document: { status: "DRAFT" },
        purchaseOrder: { approvalStatus: "APPROVED" },
      }),
    ).toEqual({ allowed: false, failedCondition: statusCondition });

    expect(
      evaluateGuard([statusCondition, poCondition, approvalCondition], {
        document: { status: "READY_TO_SEND" },
        purchaseOrder: null,
      }),
    ).toEqual({ allowed: false, failedCondition: poCondition });

    expect(
      evaluateGuard([statusCondition, poCondition, approvalCondition], {
        document: { status: "READY_TO_SEND" },
        purchaseOrder: { approvalStatus: "PENDING" },
      }),
    ).toEqual({ allowed: false, failedCondition: approvalCondition });
  });

  it("resolves nested fields and returns undefined for missing paths", () => {
    const condition: WorkflowGuardCondition = {
      field: "purchaseOrder.approvalStatus",
      operator: "eq",
      value: "APPROVED",
    };
    expect(
      evaluateGuard([condition], { purchaseOrder: { approvalStatus: "APPROVED" } }).allowed,
    ).toBe(true);
    expect(evaluateGuard([condition], { purchaseOrder: null }).allowed).toBe(false);
    expect(evaluateGuard([condition], {}).allowed).toBe(false);
  });

  it("throws on an unknown operator (defensive)", () => {
    const condition = {
      field: "x",
      operator: "eval",
      value: "anything",
    } as unknown as WorkflowGuardCondition;
    expect(() => evaluateGuard([condition], { x: 1 })).toThrow(TypeError);
  });
});
