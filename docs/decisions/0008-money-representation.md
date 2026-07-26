# ADR-0008: Represent money as integer minor units

Status: Accepted  
Date: 2026-07-26

## Context

Binary floating-point cannot safely represent business money. Countries and payment instruments use
different currency scales, and tax requires explicit rounding.

## Options considered

- Floating-point numbers: convenient and unsafe.
- Arbitrary decimal amount only: precise but easy to mix scale/currency.
- Integer minor units plus currency and scale: exact storage and explicit interpretation.

## Decision

Represent money as signed arbitrary-size integer minor units, ISO currency code, and explicit scale.
PostgreSQL uses `numeric(38,0)` for minor units. APIs encode large integers as strings. Intermediate
rates/quantities use bounded decimals with explicit rounding.

## Consequences

All operations need value-object functions and currency checks. The model supports zero-, two-,
three-, and nonstandard-scale cases without floating-point drift.

## Validation and review trigger

Validate with country/payment test vectors before the first document schema. Supersede only if a
different representation proves equal correctness and clearer interoperability.
