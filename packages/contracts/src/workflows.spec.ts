import { describe, expect, it } from "vitest";

import {
  workflowDefinitionSchema,
  workflowGuardConditionSchema,
  workflowStepSchema,
  workflowTemplateSchema,
  workflowTemplateVersionSchema,
  workflowTransitionSchema,
} from "./workflows.js";

describe("workflow contracts", () => {
  it("accepts a minimal workflow step", () => {
    expect(
      workflowStepSchema.parse({
        key: "draft",
        label: "Draft",
        status: "DRAFT",
      }),
    ).toMatchObject({ key: "draft", label: "Draft", status: "DRAFT", isOptional: false });
  });

  it("accepts a transition with a strict guard DSL using eq", () => {
    const transition = workflowTransitionSchema.parse({
      fromState: "draft",
      action: "send",
      toState: "sent",
      allowedRoles: ["ADMIN"],
      guard: [{ field: "document.status", operator: "eq", value: "READY_TO_SEND" }],
    });
    expect(transition.guard?.[0]?.operator).toBe("eq");
  });

  it("accepts exists/notExists guards without a value", () => {
    const transition = workflowTransitionSchema.parse({
      fromState: "draft",
      action: "submit",
      toState: "review",
      allowedRoles: ["MEMBER"],
      guard: [{ field: "purchaseOrder", operator: "exists" }],
    });
    expect(transition.guard?.[0]?.operator).toBe("exists");
  });

  it("accepts in/notIn guards with array values", () => {
    const transition = workflowTransitionSchema.parse({
      fromState: "review",
      action: "approve",
      toState: "approved",
      allowedRoles: ["ADMIN"],
      guard: [{ field: "document.type", operator: "in", value: ["QUOTATION", "INVOICE"] }],
    });
    expect(transition.guard?.[0]?.operator).toBe("in");
  });

  it("rejects unknown guard operators (no arbitrary expressions)", () => {
    expect(
      workflowGuardConditionSchema.safeParse({
        field: "x",
        operator: "eval",
        value: "anything",
      }).success,
    ).toBe(false);
    expect(
      workflowGuardConditionSchema.safeParse({
        field: "x",
        operator: "exec",
        value: "anything",
      }).success,
    ).toBe(false);
  });

  it("rejects eq/neq guards without a value", () => {
    expect(workflowGuardConditionSchema.safeParse({ field: "x", operator: "eq" }).success).toBe(
      false,
    );
    expect(workflowGuardConditionSchema.safeParse({ field: "x", operator: "neq" }).success).toBe(
      false,
    );
  });

  it("rejects exists/notExists guards that include a value", () => {
    expect(
      workflowGuardConditionSchema.safeParse({
        field: "x",
        operator: "exists",
        value: "y",
      }).success,
    ).toBe(false);
    expect(
      workflowGuardConditionSchema.safeParse({
        field: "x",
        operator: "notExists",
        value: "y",
      }).success,
    ).toBe(false);
  });

  it("rejects in/notIn guards with non-array values", () => {
    expect(
      workflowGuardConditionSchema.safeParse({
        field: "x",
        operator: "in",
        value: "QUOTATION",
      }).success,
    ).toBe(false);
  });

  it("rejects lt/lte/gt/gte guards with non-numeric values", () => {
    expect(
      workflowGuardConditionSchema.safeParse({
        field: "x",
        operator: "lt",
        value: "10",
      }).success,
    ).toBe(false);
    expect(
      workflowGuardConditionSchema.safeParse({
        field: "x",
        operator: "gte",
        value: 10,
      }).success,
    ).toBe(true);
  });

  it("accepts a full workflow definition with states and transitions", () => {
    const definition = workflowDefinitionSchema.parse({
      states: [
        { key: "draft", label: "Draft", status: "DRAFT" },
        { key: "sent", label: "Sent", status: "SENT" },
      ],
      transitions: [
        {
          fromState: "draft",
          action: "send",
          toState: "sent",
          allowedRoles: ["ADMIN"],
        },
      ],
    });
    expect(definition.states).toHaveLength(2);
    expect(definition.transitions).toHaveLength(1);
  });

  it("accepts a workflow template and version", () => {
    expect(
      workflowTemplateSchema.safeParse({
        id: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf048",
        code: "sales-workflow",
        name: "Sales workflow",
        description: null,
        documentType: "QUOTATION",
        createdAt: "2026-07-28T00:00:00.000Z",
        updatedAt: "2026-07-28T00:00:00.000Z",
      }).success,
    ).toBe(true);

    expect(
      workflowTemplateVersionSchema.safeParse({
        id: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf048",
        workflowTemplateId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf049",
        version: "1.0.0",
        status: "PUBLISHED",
        definition: {
          states: [{ key: "draft", label: "Draft", status: "DRAFT" }],
          transitions: [],
        },
        publishedAt: "2026-07-28T00:00:00.000Z",
        retiredAt: null,
        createdAt: "2026-07-28T00:00:00.000Z",
        updatedAt: "2026-07-28T00:00:00.000Z",
      }).success,
    ).toBe(true);
  });
});
