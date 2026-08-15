import { z } from "zod";

import { type CustomFieldDefinition } from "@bizo/contracts/customization";

export function buildCustomFieldsZodSchema(
  definitions: CustomFieldDefinition[],
): z.ZodObject<Record<string, z.ZodType>> {
  const shape: Record<string, z.ZodType> = {};

  for (const def of definitions) {
    let fieldSchema: z.ZodType;

    switch (def.fieldType) {
      case "NUMBER": {
        fieldSchema = z.coerce.number();
        break;
      }
      case "BOOLEAN": {
        fieldSchema = z.boolean();
        break;
      }
      case "DATE": {
        fieldSchema = z.string().refine((val) => !isNaN(Date.parse(val)), {
          message: `Invalid date format for field ${def.label}`,
        });
        break;
      }
      case "SELECT": {
        const optionValues = def.config.options?.map((opt) => opt.value) ?? [];
        if (optionValues.length > 0) {
          fieldSchema = z.enum(optionValues as [string, ...string[]]);
        } else {
          fieldSchema = z.string();
        }
        break;
      }
      case "TEXT":
      case "MULTILINE":
      default: {
        let strSchema = z.string();
        if (def.config.validationRegex) {
          try {
            const regex = new RegExp(def.config.validationRegex);
            strSchema = strSchema.regex(regex, `Field ${def.label} does not match required format`);
          } catch {
            // ignore invalid regex string
          }
        }
        fieldSchema = strSchema;
        break;
      }
    }

    if (!def.config.required) {
      fieldSchema = fieldSchema.optional().nullable();
    }

    shape[def.fieldKey] = fieldSchema;
  }

  return z.object(shape);
}

export function validateCustomFieldsPayload(
  definitions: CustomFieldDefinition[],
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const schema = buildCustomFieldsZodSchema(definitions);
  return schema.parse(payload ?? {});
}
