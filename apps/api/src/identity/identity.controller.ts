import { Body, Controller, Get, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";

import {
  signUpRequestSchema,
  type SignUpRequest,
  verifyCredentialsRequestSchema,
  type VerifyCredentialsRequest,
} from "@bizo/contracts/auth";

import { ContractPipe } from "../common/contract.pipe.js";
import { type AuthenticatedPrincipal } from "../security/principal.js";
import { Principal } from "../security/principal.decorator.js";
import { Public } from "../security/public.decorator.js";
import { type IdentityService } from "./identity.service.js";

@Controller()
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("auth/signup")
  signUp(@Body(new ContractPipe(signUpRequestSchema)) input: SignUpRequest) {
    return this.identity.signUp(input);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("auth/verify")
  verifyCredentials(
    @Body(new ContractPipe(verifyCredentialsRequestSchema)) input: VerifyCredentialsRequest,
  ) {
    return this.identity.verifyCredentials(input);
  }

  @Get("me")
  workspace(@Principal() principal: AuthenticatedPrincipal) {
    return this.identity.workspace(principal.userId);
  }
}
