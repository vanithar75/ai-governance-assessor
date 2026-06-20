import type { Framework, FrameworkQuestions } from "@/lib/types";

type FrameworkRow = {
  id: string;
  slug?: string;
  name: string;
  description: string | null;
  questions: FrameworkQuestions | string;
  framework_version_id?: string;
  framework_version?: string;
  created_at: string;
};

export function parseFramework(row: FrameworkRow): Framework {
  const questions =
    typeof row.questions === "string"
      ? (JSON.parse(row.questions) as FrameworkQuestions)
      : row.questions;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    questions,
    framework_version_id: row.framework_version_id,
    framework_version: row.framework_version,
    created_at: row.created_at,
  };
}
