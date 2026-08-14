import { z } from "zod";

const decimalSchema = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/);

export const projectStatusSchema = z.enum(["ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]);

export const projectStatusLabelByCode = {
  ACTIVE: "Active",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
} as const satisfies Record<z.infer<typeof projectStatusSchema>, string>;

export function projectStatusLabel(status: z.infer<typeof projectStatusSchema>): string {
  return projectStatusLabelByCode[status];
}

export const createProjectRequestSchema = z.strictObject({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  customerId: z.uuid().optional(),
  startDate: z.iso.date().nullable().optional(),
  endDate: z.iso.date().nullable().optional(),
  budgetMinor: decimalSchema.nullable().optional(),
  currencyCode: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable()
    .optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const updateProjectRequestSchema = z.strictObject({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  status: projectStatusSchema.optional(),
  startDate: z.iso.date().nullable().optional(),
  endDate: z.iso.date().nullable().optional(),
  budgetMinor: decimalSchema.nullable().optional(),
  currencyCode: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable()
    .optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const projectSchema = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: projectStatusSchema,
  startDate: z.iso.date().nullable(),
  endDate: z.iso.date().nullable(),
  budgetMinor: z.string().nullable(),
  currencyCode: z.string().nullable(),
  notes: z.string().nullable(),
  customer: z
    .strictObject({
      id: z.uuid(),
      name: z.string(),
    })
    .nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type Project = z.infer<typeof projectSchema>;
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;
export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>;
