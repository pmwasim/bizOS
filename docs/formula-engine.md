# Formula engine

Status: Accepted design direction

## Purpose

Formulas support totals, conditions, custom fields, and workflow rules without turning bizOS into an
unsafe programming platform.

## Representation

Formulas are a versioned, typed abstract syntax tree. There is no `eval`, JavaScript source, SQL, or
dynamic module loading. The initial type system includes boolean, text, date, decimal, quantity,
money, list, and optional values.

Example:

```json
{
  "op": "money.multiply",
  "left": { "ref": "line.unitPrice" },
  "right": { "ref": "line.quantity" }
}
```

## Evaluation contract

- Deterministic for the same inputs, engine version, locale-neutral context, and effective time.
- Decimal and money operations use explicit scale and rounding mode.
- Currency mismatch is an error unless an exchange-rate operation supplies provenance.
- Missing values produce typed errors or explicit fallback operations, never silent zero.
- Evaluation has limits for AST depth, node count, list size, and elapsed time.
- Results include value, referenced inputs, formula version, warnings, and explanation tree.

## Authoring

Most users select plain-language building blocks. Advanced expression editing is permission-gated
and validates continuously. Preview uses representative or explicitly selected business data and
cannot commit changes.

## Versioning

Published formulas are immutable. Documents and workflow instances pin a formula version. Changing a
formula creates a new version and runs impact simulation before activation. Historical records
retain the result and inputs required for reproduction.

## Extension

New functions are registered with name, input/output types, purity, cost, locale behavior,
permission requirements, and test vectors. Network and storage access are prohibited inside the
evaluator. External data must be fetched by an integration step and supplied as an explicit,
versioned input.
