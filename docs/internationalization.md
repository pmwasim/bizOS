# Internationalization

Status: Accepted

## Locale model

User interface locale, business document locale, business time zone, country, base currency, and
document currency are independent settings. The system stores canonical values and formats at the
edge.

## Requirements

- Unicode everywhere with normalized comparison where business rules require it.
- CLDR-backed formatting for numbers, currency, dates, names, and addresses.
- ICU message syntax for pluralization and grammatical variants.
- Translation keys describe meaning, not English wording or screen coordinates.
- Right-to-left layout is supported at the component and document-template level.
- User-entered text keeps its direction and language metadata when relevant.
- Search supports locale-aware tokenization without weakening tenant filters.

## Currency

Every amount carries ISO 4217 code and scale. Formatting never determines stored precision. Exchange
rates record source, direction, effective instant, imported instant, and precision. Reports
distinguish transaction, base, and presentation currency.

## Documents

Templates define locale, page direction, legal labels, number/date formatting, and font coverage.
The immutable document version records the template and translation bundle used for rendering.

## Release gate

A locale is production-ready only after native-language product review, terminology approval,
bidirectional and PDF checks, input validation, expansion testing, and help/error coverage.
