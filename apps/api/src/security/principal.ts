import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { type Request } from "express";

export interface AuthenticatedPrincipal {
  userId: string;
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
