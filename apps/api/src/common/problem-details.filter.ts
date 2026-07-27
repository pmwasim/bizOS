import {
  type ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from "@nestjs/common";
import { type Request, type Response } from "express";

interface ExceptionBody {
  code?: string;
  detail?: string;
  errors?: unknown[];
  message?: string | string[];
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const body: ExceptionBody =
      typeof exceptionResponse === "object" && exceptionResponse !== null ? exceptionResponse : {};
    const detail =
      status >= 500
        ? "We could not complete that request. Try again."
        : this.readDetail(body, exceptionResponse);
    const requestId = response.getHeader("x-request-id") ?? request.headers["x-request-id"];

    response
      .status(status)
      .type("application/problem+json")
      .send({
        type: `https://docs.bizo.example/problems/${body.code?.toLowerCase() ?? "request-failed"}`,
        title: this.titleFor(status),
        status,
        detail,
        code: body.code ?? this.codeFor(status),
        requestId: typeof requestId === "string" ? requestId : undefined,
        errors: body.errors ?? [],
      });
  }

  private readDetail(body: ExceptionBody, raw: string | object | undefined): string {
    if (body.detail) {
      return body.detail;
    }
    if (typeof body.message === "string") {
      return body.message;
    }
    if (Array.isArray(body.message)) {
      return body.message.join(" ");
    }
    if (typeof raw === "string") {
      return raw;
    }
    return "The request could not be completed.";
  }

  private titleFor(status: number): string {
    return (
      {
        [HttpStatus.BAD_REQUEST]: "Check the information",
        [HttpStatus.UNAUTHORIZED]: "Sign in required",
        [HttpStatus.FORBIDDEN]: "You cannot do that",
        [HttpStatus.NOT_FOUND]: "Not found",
        [HttpStatus.CONFLICT]: "That already exists",
        [HttpStatus.TOO_MANY_REQUESTS]: "Too many attempts",
      }[status] ?? "Request failed"
    );
  }

  private codeFor(status: number): string {
    return (
      {
        [HttpStatus.BAD_REQUEST]: "BAD_REQUEST",
        [HttpStatus.UNAUTHORIZED]: "UNAUTHENTICATED",
        [HttpStatus.FORBIDDEN]: "FORBIDDEN",
        [HttpStatus.NOT_FOUND]: "NOT_FOUND",
        [HttpStatus.CONFLICT]: "CONFLICT",
        [HttpStatus.TOO_MANY_REQUESTS]: "RATE_LIMITED",
      }[status] ?? "INTERNAL_ERROR"
    );
  }
}
