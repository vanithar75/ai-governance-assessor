import { parseFramework } from "@/lib/frameworks";
import {
  buildAssessmentMarkdown,
  buildAssessmentMarkdownFilename,
  type AssessmentMarkdownInput,
} from "@/lib/assessment-markdown";
import { createClient } from "@/lib/supabase/server";
import type {
  AssessmentAnswers,
  AssessmentMode,
  AssessmentReport,
  CustomerProfile,
  FrameworkQuestion,
} from "@/lib/types";

export type AssessmentExportResult =
  | { ok: true; markdown: string; filename: string }
  | { ok: false; status: 401 | 404; error: string };

export async function getAssessmentMarkdownExport(
  assessmentId: string,
): Promise<AssessmentExportResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, status: 401, error: "You must be signed in." };
  }

  const { data: assessment, error } = await supabase
    .from("assessments_with_framework")
    .select(
      "id, framework_id, framework_version_id, framework_name, framework_version, status, answers, score, report, assessment_mode, customer_profile, created_at",
    )
    .eq("id", assessmentId)
    .eq("user_id", user.id)
    .single();

  if (error || !assessment) {
    return { ok: false, status: 404, error: "Assessment not found." };
  }

  if (assessment.status !== "completed") {
    return { ok: false, status: 404, error: "Only completed assessments can be exported." };
  }

  const report = assessment.report as AssessmentReport | null;
  if (!report) {
    return { ok: false, status: 404, error: "Assessment report is missing." };
  }

  const answers = assessment.answers as AssessmentAnswers;
  const assessmentMode = (assessment.assessment_mode ?? "internal") as AssessmentMode;
  const customerProfile = assessment.customer_profile as CustomerProfile | null;
  const questionsById = new Map<string, FrameworkQuestion>();

  if (assessment.framework_version_id) {
    const { data: versionRow } = await supabase
      .from("framework_versions_with_questions")
      .select("questions")
      .eq("framework_version_id", assessment.framework_version_id)
      .single();

    if (versionRow?.questions) {
      const parsed = parseFramework({
        id: assessment.framework_id,
        name: assessment.framework_name,
        description: null,
        questions: versionRow.questions,
        created_at: assessment.created_at,
      });
      for (const section of parsed.questions.sections) {
        for (const question of section.questions) {
          questionsById.set(question.id, question);
        }
      }
    }
  }

  const input: AssessmentMarkdownInput = {
    frameworkName: assessment.framework_name,
    frameworkVersion: assessment.framework_version,
    score: assessment.score ?? 0,
    report,
    answers,
    questionsById,
    assessmentMode,
    customerProfile,
  };

  return {
    ok: true,
    markdown: buildAssessmentMarkdown(input),
    filename: buildAssessmentMarkdownFilename(input),
  };
}
