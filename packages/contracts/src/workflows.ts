import { z } from "zod";

// Phase 4 — Workflow template contracts.
// The guard DSL is intentionally strict: a fixed set of operators, no arbitrary expressions,
// no eval, no code strings. The in-house interpreter evaluates conditions structurally.

export const workflowVersionStatusSchema = z.enum(["DRAFT", "PUBLISHED", "RETIRED"]);

export const workflowGuardOperatorSchema = z.enum([
  "eq",
  "neq",
  "lt",
  "lte",
  "gt",
  "gte",
  "in",
  "notIn",
  "exists",
  "notExists",
]);

export const workflowGuardConditionSchema = z
  .strictObject({
    field: z.string().trim().min(1).max(120),
    operator: workflowGuardOperatorSchema,
    value: z
      .union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.array(z.string()),
        z.array(z.number()),
      ])
      .optional(),
  })
  .superRefine((condition, ctx) => {
    const operator = condition.operator;
    const hasValue = condition.value !== undefined;

    if (operator === "exists" || operator === "notExists") {
      if (hasValue) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["value"],
          message: `Operator "${operator}" must not include a value.`,
        });
      }
      return;
    }

    if (!hasValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: `Operator "${operator}" requires a value.`,
      });
      return;
    }

    if (operator === "in" || operator === "notIn") {
      if (!Array.isArray(condition.value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["value"],
          message: `Operator "${operator}" requires an array value.`,
        });
      }
      return;
    }

    if (operator === "lt" || operator === "lte" || operator === "gt" || operator === "gte") {
      if (typeof condition.value !== "number") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["value"],
          message: `Operator "${operator}" requires a numeric value.`,
        });
      }
    }
  });

export const workflowStepSchema = z.strictObject({
  key: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(120),
  status: z.string().trim().min(1).max(40),
  isOptional: z.boolean().default(false),
});

export const workflowTransitionSchema = z.strictObject({
  fromState: z.string().trim().min(1).max(60),
  action: z.string().trim().min(1).max(60),
  toState: z.string().trim().min(1).max(60),
  allowedRoles: z.array(z.string().trim().min(1).max(80)).max(20),
  guard: z.array(workflowGuardConditionSchema).max(10).optional(),
});

export const workflowDefinitionSchema = z.strictObject({
  states: z.array(workflowStepSchema).min(1).max(50),
  transitions: z.array(workflowTransitionSchema).max(100),
});

export const workflowTemplateSchema = z.strictObject({
  id: z.uuid(),
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
  description: z.string().nullable(),
  documentType: z.string().min(1).max(40),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const workflowTemplateVersionSchema = z.strictObject({
  id: z.uuid(),
  workflowTemplateId: z.uuid(),
  version: z.string().min(1).max(20),
  status: workflowVersionStatusSchema,
  definition: workflowDefinitionSchema,
  publishedAt: z.iso.datetime().nullable(),
  retiredAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type WorkflowGuardOperator = z.infer<typeof workflowGuardOperatorSchema>;
export type WorkflowGuardCondition = z.infer<typeof workflowGuardConditionSchema>;
export type WorkflowStep = z.infer<typeof workflowStepSchema>;
export type WorkflowTransition = z.infer<typeof workflowTransitionSchema>;
export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;
export type WorkflowTemplate = z.infer<typeof workflowTemplateSchema>;
export type WorkflowTemplateVersion = z.infer<typeof workflowTemplateVersionSchema>;
export type WorkflowVersionStatus = z.infer<typeof workflowVersionStatusSchema>;
