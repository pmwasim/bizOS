import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { type Request } from "express";
import { jwtVerify } from "jose";

import { readApiEnvironment } from "@bizo/config/api";

import { type AuthenticatedPrincipal } from "./principal.js";
import { PUBLIC_ROUTE } from "./public.decorator.js";

type PrincipalRequest = Request & { principal?: AuthenticatedPrincipal };

@Injectable()
export class InternalAuthGuard implements CanActivate {
  private readonly secret: Uint8Array;

  constructor(@Inject(Reflector) private readonly reflector: Reflector) {
    this.secret = new TextEncoder().encode(readApiEnvironment(process.env).INTERNAL_AUTH_SECRET);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<PrincipalRequest>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Sign in to continue.");
    }

    try {
      const { payload } = await jwtVerify(authorization.slice(7), this.secret, {
        algorithms: ["HS256"],
        audience: "bizo-api",
        issuer: "bizo-web",
      });

      if (typeof payload.sub !== "string") {
        throw new Error("Missing token subject.");
      }

      request.principal = { userId: payload.sub };
      return true;
    } catch {
      throw new UnauthorizedException("Your session is no longer valid. Sign in again.");
    }
  }
}
