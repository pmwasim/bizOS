import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { type Request } from "express";

import { type AuthenticatedPrincipal } from "./principal.js";

type PrincipalRequest = Request & { principal?: AuthenticatedPrincipal };

export const Principal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedPrincipal => {
    const request = context.switchToHttp().getRequest<PrincipalRequest>();
    if (!request.principal) {
      throw new Error("The authenticated principal is unavailable.");
    }
    return request.principal;
  },
);
