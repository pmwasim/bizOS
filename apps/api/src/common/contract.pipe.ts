import { BadRequestException, type PipeTransform } from "@nestjs/common";
import { type z } from "zod";

export class ContractPipe implements PipeTransform<unknown, unknown> {
  constructor(private readonly schema: z.ZodType) {}

  transform(value: unknown): unknown {
    const parsed = this.schema.safeParse(value);

    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_FAILED",
        detail: "Check the highlighted information and try again.",
        errors: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    return parsed.data;
  }
}
