import { z } from "zod";

export const questionTypeSchema = z.enum(["yes_no", "scale", "text"]);

export const controlSeveritySchema = z.enum([
  "critical",
  "high",
  "medium",
  "low",
  "informational",
]);

export const frameworkVersionStatusSchema = z.enum([
  "draft",
  "published",
  "archived",
]);

export const controlSchema = z
  .object({
    control_id: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-]+$/i, "control_id must be alphanumeric with hyphens"),
    title: z.string().min(1),
    description: z.string().optional(),
    question_type: questionTypeSchema,
    weight: z.number().int().min(0).max(10).default(1),
    required: z.boolean().default(true),
    guidance: z.string().optional(),
    options: z.array(z.string()).optional(),
    severity: controlSeveritySchema.default("medium"),
    sort_order: z.number().int().optional(),
  })
  .superRefine((control, ctx) => {
    if (control.question_type === "scale") {
      if (!control.options?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "scale controls require at least one option",
          path: ["options"],
        });
      }
    }
  });

export const sectionSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_-]+$/i),
  title: z.string().min(1),
  description: z.string().min(1),
  controls: z.array(controlSchema).min(1),
});

export const frameworkMetadataSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase alphanumeric with hyphens"),
  name: z.string().min(1),
  description: z.string().min(1),
  publisher: z.string().optional(),
  jurisdiction: z.string().optional(),
  website_url: z.string().url().optional(),
});

export const versionManifestSchema = z.object({
  version: z.string().min(1),
  status: frameworkVersionStatusSchema.default("draft"),
  changelog: z.string().optional(),
  published_at: z.string().datetime().optional(),
});

export const controlsFileSchema = z.object({
  sections: z.array(sectionSchema).min(1),
});

export const standardBundleSchema = z.object({
  framework: frameworkMetadataSchema,
  manifest: versionManifestSchema,
  controls: controlsFileSchema,
});

export type FrameworkMetadata = z.infer<typeof frameworkMetadataSchema>;
export type VersionManifest = z.infer<typeof versionManifestSchema>;
export type ControlDefinition = z.infer<typeof controlSchema>;
export type SectionDefinition = z.infer<typeof sectionSchema>;
export type StandardBundle = z.infer<typeof standardBundleSchema>;

export const controlMappingTypeSchema = z.enum([
  "equivalent",
  "partial",
  "related",
  "supersedes",
]);

export const controlRefSchema = z.object({
  framework: z.string().min(1),
  version: z.string().min(1),
  control_id: z.string().min(1),
});

export const crosswalkMappingSchema = z.object({
  source: controlRefSchema,
  target: controlRefSchema,
  mapping_type: controlMappingTypeSchema.default("related"),
  notes: z.string().optional(),
});

export const crosswalkFileSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  mappings: z.array(crosswalkMappingSchema).min(1),
});

export type ControlRef = z.infer<typeof controlRefSchema>;
export type CrosswalkMapping = z.infer<typeof crosswalkMappingSchema>;
export type CrosswalkFile = z.infer<typeof crosswalkFileSchema>;
