import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { type Request, type Response } from "express";

type RequestWithId = Request & { id?: unknown };

export const RequestId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<RequestWithId>();
    const response = context.switchToHttp().getResponse<Response>();
    const responseId = response.getHeader("x-request-id");
    if (typeof responseId === "string") {
      return responseId;
    }
    if (typeof request.id === "string" && request.id.length <= 128) {
      return request.id;
    }
    return crypto.randomUUID();
  },
);
