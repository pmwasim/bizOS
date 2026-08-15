import { z } from "zod";

const apiEnvironmentSchema = z
  .object({
    API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    /** Build metadata baked into the runtime image, surfaced on /health for release verification. */
    BUILD_TIME: z.iso.datetime().optional(),
    DATABASE_URL: z.url().startsWith("postgresql://"),
    GIT_SHA: z
      .string()
      .regex(/^[0-9a-f]{40}$/, "GIT_SHA must be a full 40-character lowercase git SHA.")
      .optional(),
    INTERNAL_AUTH_SECRET: z.string().min(32),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    SMTP_FROM: z.email(),
    SMTP_URL: z
      .url()
      .refine(
        (value) => value.startsWith("smtp://") || value.startsWith("smtps://"),
        "SMTP_URL must use smtp:// or smtps://.",
      ),
    FRAPPE_API_KEY: z.string().min(1).optional(),
    FRAPPE_API_SECRET: z.string().min(1).optional(),
    FRAPPE_BASE_URL: z.url().optional(),
    KEEP_WARM_URL: z.url().optional(),
    KEEP_WARM_SECRET: z.string().min(16).optional(),
    CLIENT_IP_SIGNATURE_SECRET: z.string().min(16).optional(),
    /**
     * Widens every request throttle by this factor. Exists so an automated harness can drive the
     * whole product from a single source IP without tripping limits that are correct for real
     * traffic. Production is pinned to 1 by the refinement below — the strict limits are the
     * shipped behaviour, never a value CI can relax by accident.
     */
    THROTTLE_SCALE: z.coerce.number().min(1).max(1000).default(1),
    /** Public origin used to build password reset links in outbound email. */
    APP_BASE_URL: z.url().default("http://localhost:3000"),
  })
  .superRefine((value, context) => {
    const configured = [
      value.FRAPPE_BASE_URL,
      value.FRAPPE_API_KEY,
      value.FRAPPE_API_SECRET,
    ].filter(Boolean).length;

    if (configured > 0 && configured < 3) {
      context.addIssue({
        code: "custom",
        message:
          "FRAPPE_BASE_URL, FRAPPE_API_KEY, and FRAPPE_API_SECRET must be configured together.",
      });
    }

    if (value.NODE_ENV === "production" && value.FRAPPE_BASE_URL?.startsWith("http://")) {
      context.addIssue({
        code: "custom",
        message: "FRAPPE_BASE_URL must use HTTPS in production.",
        path: ["FRAPPE_BASE_URL"],
      });
    }

    if (value.NODE_ENV === "production" && value.THROTTLE_SCALE !== 1) {
      context.addIssue({
        code: "custom",
        message: "THROTTLE_SCALE must be 1 in production; throttles are not relaxable in prod.",
        path: ["THROTTLE_SCALE"],
      });
    }

    const keepWarmConfigured = [value.KEEP_WARM_URL, value.KEEP_WARM_SECRET].filter(Boolean).length;

    if (keepWarmConfigured === 1) {
      context.addIssue({
        code: "custom",
        message: "KEEP_WARM_URL and KEEP_WARM_SECRET must be configured together.",
      });
    }

    if (value.NODE_ENV === "production" && value.KEEP_WARM_URL?.startsWith("http://")) {
      context.addIssue({
        code: "custom",
        message: "KEEP_WARM_URL must use HTTPS in production.",
        path: ["KEEP_WARM_URL"],
      });
    }
  });

export type ApiEnvironment = z.infer<typeof apiEnvironmentSchema>;

export function readApiEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): ApiEnvironment {
  return apiEnvironmentSchema.parse(environment);
}
