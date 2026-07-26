# Tax engine

Status: Accepted design direction; no jurisdiction rules are approved

## Goals

- Calculate taxes correctly for the configured jurisdiction and effective date.
- Explain every component in language a business user can understand.
- Preserve formal codes and evidence needed by specialists and integrations.
- Add countries by data and reviewed rule modules rather than product forks.

## Inputs

Calculation uses seller and buyer registrations, supply and invoice dates, locations, product or
service classification, exemptions, quantities, prices, discounts, currency, inclusive/exclusive
pricing, document type, and referenced corrections.

Unknown or contradictory jurisdiction facts stop finalization when they affect legal outcome. The
engine does not invent a tax treatment from an AI suggestion.

## Rule packages

A signed, versioned package contains jurisdiction, authority/source references, effective period,
tax categories, rates, rounding, exemptions, reverse-charge behavior, document wording, and test
vectors. Publishing requires specialist review and an effective date. Past packages remain available
for reproduction.

## Calculation pipeline

1. Normalize canonical inputs without locale-dependent parsing.
2. Determine jurisdiction and applicable package.
3. Classify lines and exemptions.
4. Calculate line or document bases according to the package.
5. Apply rates and rounding at the defined level.
6. Reconcile displayed totals.
7. Return components, totals, warnings, rule version, and explanation.

## Rounding

Money uses integer minor units plus explicit scale. Intermediate decimal precision and rounding mode
are defined by the rule package. Residual minor units are allocated deterministically and the
allocation is recorded.

## Safety and scale

- Rules cannot execute arbitrary code or network requests.
- Cache keys include all material inputs and rule version.
- Tax results are immutable on issued document versions.
- Bulk recalculation is asynchronous and produces an impact report; it never rewrites issued facts.
- Country rollout requires golden examples, boundary dates, refund/correction cases, and independent
  specialist acceptance.
