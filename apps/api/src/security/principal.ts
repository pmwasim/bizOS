import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { type Request } from "express";

export interface AuthenticatedPrincipal {
  userId: string;
  // Phase 9 — populated by SystemAdminGuard when the authenticated user has
  // an ACTIVE PlatformSystemAdmin row. Endpoints decorated with @SystemAdmin
  // require this to be set; endpoints that don't use the guard see `undefined`.
  systemAdminId?: string;
  isSystemAdmin?: boolean;
  impersonatedBusinessId?: string;
  ticketReference?: string;
}

type PrincipalRequest = Request & { principal?: AuthenticatedPrincipal };

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedPrincipal => {
    const request = context.switchToHttp().getRequest<PrincipalRequest>();
    if (!request.principal) {
      throw new Error("Authenticated principal is missing.");
    }
    return request.principal;
  },
);
