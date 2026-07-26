import { newEnforcer, newModel, StringAdapter, type Enforcer } from "casbin";

const model = `
[request_definition]
r = subject, domain, object, action

[policy_definition]
p = role, domain, object, action, eft

[role_definition]
g = _, _, _

[policy_effect]
e = some(where (p.eft == allow)) && !some(where (p.eft == deny))

[matchers]
m = g(r.subject, p.role, r.domain) && r.domain == p.domain && keyMatch2(r.object, p.object) && regexMatch(r.action, p.action)
`;

export interface AuthorizationRequest {
  action: string;
  businessId: string;
  object: string;
  subjectId: string;
  tenantId: string;
}

export async function createAuthorizationEnforcer(
  policyLines: readonly string[] = [],
): Promise<Enforcer> {
  const adapter = new StringAdapter(policyLines.join("\n"));
  return newEnforcer(newModel(model), adapter);
}

export async function authorize(
  enforcer: Enforcer,
  request: AuthorizationRequest,
): Promise<boolean> {
  return enforcer.enforce(
    request.subjectId,
    `${request.tenantId}:${request.businessId}`,
    request.object,
    request.action,
  );
}
