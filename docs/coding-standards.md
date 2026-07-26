# Coding standards

Status: Accepted

## Language

- TypeScript is strict. Do not add `any`, non-null assertions, ignored errors, or disabled rules
  without a narrow documented reason.
- Validate at every untrusted boundary; TypeScript types are not runtime validation.
- Prefer small named functions, immutable values, explicit result types at public boundaries, and
  dependency injection at infrastructure boundaries.
- Comments explain decisions and constraints, not syntax.
- No `eval`, dynamic code generation, shell interpolation, or unvalidated dynamic URLs.

## Architecture

- UI depends on contracts and UI primitives, not database or server-only packages.
- Controllers translate transport; application use cases orchestrate; domain code owns rules;
  infrastructure adapters handle external systems.
- Modules do not read another module's tables directly.
- Domain commands use verbs and events use past tense.
- Tenant/business scope and correlation IDs remain explicit.

## React and Next.js

- Server Components are the default; use Client Components only for interaction.
- Never import secrets, database clients, or privileged code into client bundles.
- Use React escaping; raw HTML requires centralized sanitization and security review.
- Validate navigation targets and external URLs.
- Accessible HTML semantics precede component abstraction.
- Shared primitives belong in `packages/ui`; feature composition stays with the app.

## NestJS

- One module owns each business capability.
- Controllers are thin and globally validated.
- Authorization occurs server-side for every protected action.
- Errors are typed and mapped centrally; clients never receive stack traces.
- Request bodies, outbound calls, and worker jobs have explicit limits and timeouts.
- Logs are structured and redact credentials, cookies, tokens, and sensitive document content.

## Naming

- Files use kebab-case except framework conventions.
- Types/classes use PascalCase; values/functions use camelCase; constants use SCREAMING_SNAKE_CASE
  only for true constants.
- Database uses snake_case; external JSON uses camelCase.
- Avoid ambiguous names such as `data`, `manager`, `helper`, or `process` at public boundaries.

## Commits and versions

Commits follow Conventional Commits with an approved scope. Pull requests are small, explain the
why, include verification, and update docs/ADRs. The repository uses semantic versioning:

- patch: compatible fix;
- minor: compatible capability;
- major: intentional public contract break.

Pre-1.0 releases may move quickly, but breaking public contracts still require explicit notes.
Packages are private until a publishing ADR is accepted.

## Definition of done

- Requirements and edge cases are explicit.
- Security and tenant boundaries are tested.
- `pnpm check` passes.
- Docs and contracts match behavior.
- Observability and recovery are included.
- No undocumented placeholder, skipped test, weakened assertion, or hidden retry remains.
