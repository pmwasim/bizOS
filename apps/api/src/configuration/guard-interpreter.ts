// Phase 4 — Workflow guard DSL interpreter.
//
// Pure, deterministic evaluator for the fixed WorkflowCondition operator set.
// No eval, no Function, no arbitrary expressions. Unknown operators throw a
// TypeError so a malformed transition definition fails loudly instead of
// silently allowing or denying the transition.

import type { WorkflowGuardCondition } from "@bizo/contracts/workflows";

export interface GuardEvaluation {
  allowed: boolean;
  failedCondition?: WorkflowGuardCondition;
}

const UNKNOWN_OPERATOR_PREFIX = "Unknown guard operator";

function resolveField(context: Record<string, unknown>, field: string): unknown {
  if (field.length === 0) {
    return undefined;
  }
  const segments = field.split(".");
  let cursor: unknown = context;
  for (const segment of segments) {
    if (segment.length === 0) {
      return undefined;
    }
    if (cursor === null || cursor === undefined) {
      return undefined;
    }
    if (typeof cursor !== "object" || Array.isArray(cursor)) {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

function compareNumbers(left: number, right: number, operator: string): boolean {
  switch (operator) {
    case "lt":
      return left < right;
    case "lte":
      return left <= right;
    case "gt":
      return left > right;
    case "gte":
      return left >= right;
    default:
      throw new TypeError(`${UNKNOWN_OPERATOR_PREFIX}: ${operator}`);
  }
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }
  if (typeof left === "number" && typeof right === "number") {
    return left === right;
  }
  if (typeof left === "string" && typeof right === "string") {
    return left === right;
  }
  if (typeof left === "boolean" && typeof right === "boolean") {
    return left === right;
  }
  if (left === null || right === null) {
    return left === right;
  }
  // Coerce matching primitives across string/number boundaries (e.g. "15" vs 15)
  // so the DSL stays ergonomic for JSON-sourced values. Object/array values are
  // never coerced — only primitive non-empty scalars.
  if (typeof left === "number" && typeof right === "string") {
    if (right.trim() === "") return false;
    const num = Number(right);
    return !Number.isNaN(num) && left === num;
  }
  if (typeof left === "string" && typeof right === "number") {
    if (left.trim() === "") return false;
    const num = Number(left);
    return !Number.isNaN(num) && num === right;
  }
  return false;
}

function evaluateCondition(
  condition: WorkflowGuardCondition,
  context: Record<string, unknown>,
): boolean {
  const operator = condition.operator;
  const actual = resolveField(context, condition.field);

  switch (operator) {
    case "eq":
      return valuesEqual(actual, condition.value);
    case "neq":
      return !valuesEqual(actual, condition.value);
    case "lt":
    case "lte":
    case "gt":
    case "gte": {
      if (typeof condition.value !== "number") {
        throw new TypeError(`Operator "${operator}" requires a numeric value.`);
      }
      if (actual === null || actual === undefined || typeof actual === "boolean") {
        return false;
      }
      let numericActual: number;
      if (typeof actual === "number") {
        numericActual = actual;
      } else if (typeof actual === "string") {
        if (actual.trim() === "") {
          return false;
        }
        numericActual = Number(actual);
      } else {
        return false;
      }
      if (Number.isNaN(numericActual)) {
        return false;
      }
      return compareNumbers(numericActual, condition.value, operator);
    }
    case "in": {
      if (!Array.isArray(condition.value)) {
        throw new TypeError('Operator "in" requires an array value.');
      }
      return condition.value.some((candidate) => valuesEqual(actual, candidate));
    }
    case "notIn": {
      if (!Array.isArray(condition.value)) {
        throw new TypeError('Operator "notIn" requires an array value.');
      }
      return !condition.value.some((candidate) => valuesEqual(actual, candidate));
    }
    case "exists":
      return actual !== null && actual !== undefined;
    case "notExists":
      return actual === null || actual === undefined;
    default:
      throw new TypeError(`${UNKNOWN_OPERATOR_PREFIX}: ${operator}`);
  }
}

export function evaluateGuard(
  conditions: WorkflowGuardCondition[],
  context: Record<string, unknown>,
): GuardEvaluation {
  for (const condition of conditions) {
    if (!evaluateCondition(condition, context)) {
      return { allowed: false, failedCondition: condition };
    }
  }
  return { allowed: true };
}
