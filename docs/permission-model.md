# Permission model

Status: Accepted

## Layers

1. **Authentication** establishes the person or service principal.
2. **Membership** establishes tenant and available businesses.
3. **Casbin policy** decides whether the subject may perform an action on an object in that scope.
4. **Domain guards** decide whether the action is valid for the object's state and facts.
5. **Database scope** ensures queries cannot escape the resolved tenant/business.

Passing one layer never bypasses another.

## Request tuple

Casbin evaluates:

```text
(subject, tenant, business, object, action)
```

The adapter canonicalizes tenant and business into one non-user-controlled Casbin domain; both
remain separate at application and database boundaries. Roles are assigned within that exact domain.
Platform support access is a separate, time-bounded principal path with explicit customer
authorization and audit.

## Default roles

Runtime MVP roles (`OWNER`, `ADMIN`, `MEMBER`) map through `BusinessAccessService`:

| Object            | Actions                      | OWNER/ADMIN | MEMBER |
| ----------------- | ---------------------------- | ----------- | ------ |
| `purchase_orders` | create, read, update, upload | yes         | yes    |
| `purchase_orders` | archive                      | yes         | no     |
| `approvals`       | read                         | yes         | yes    |
| `approvals`       | update, upload_evidence      | yes         | no     |

Future templates (Approver, Finance, Viewer) remain documented for later role expansion.

- Owner: business administration and high-impact decisions.
- Admin: team and operational configuration, excluding ownership transfer.
- Operator: create and progress ordinary work.
- Approver: review only assigned or policy-eligible decisions.
- Finance specialist: tax, payment, correction, reconciliation, and formal exports.
- Viewer: read explicitly allowed business information.

Roles are templates, not hard-coded checks. Custom roles compose permissions after the default
experience proves insufficient.

## Policy rules

- Deny by default.
- Explicit deny overrides allow.
- Tenant and business domain equality is mandatory in every rule; cross-business roles expand to
  explicit business-domain grants.
- Object patterns use stable resource names, not UI routes.
- Actions are verbs such as `read`, `create`, `approve`, `finalize`, `cancel`, `export`, and
  `administer`.
- Field-level masking is applied after object authorization and is covered by contract tests.

## Agents, plugins, and integrations

Each non-human actor is a principal with a tenant, business allowlist, scopes, expiry, owner, and
revocation state. Delegation intersects the actor's policy with the initiating user's policy;
authority is never widened. High-impact commands require confirmation tokens bound to the exact
previewed action.

## Enforcement rules

- Controllers and UI checks are convenience boundaries, not the final authority.
- Application use cases call one authorization service before loading sensitive detail.
- Repositories require a scope object and do not expose unscoped collection methods.
- Background jobs re-authorize or use a narrowly scoped service principal; queued user authority is
  not assumed to remain valid forever.
- Authorization decisions record policy version and correlation ID for investigation.
