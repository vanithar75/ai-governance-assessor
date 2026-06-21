import { type NextRequest } from "next/server";

import {
  buildAssessmentReportHtml,
  buildReportAnswerRows,
} from "@/lib/assessment-report-html";
import { parseFramework } from "@/lib/frameworks";
import { createClient } from "@/lib/supabase/server";
import type {
  AssessmentAnswers,
  AssessmentMode,
  AssessmentReport,
  CustomerProfile,
  FrameworkQuestion,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: assessment, error } = await supabase
    .from("assessments_with_framework")
    .select(
      "id, framework_id, framework_version_id, framework_name, framework_version, status, answers, score, report, assessment_mode, customer_profile, created_at, updated_at",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !assessment) {
    return new Response("Assessment not found", { status: 404 });
  }

  if (assessment.status === "draft" || assessment.status === "in_progress") {
    return new Response("Assessment is not yet completed", { status: 409 });
  }

  const answers = assessment.answers as AssessmentAnswers;
  const report = assessment.report as AssessmentReport | null;
  const assessmentMode = (assessment.assessment_mode ??
    "internal") as AssessmentMode;
  const customerProfile =
    assessment.customer_profile as CustomerProfile | null;

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

  const autoPrint = request.nextUrl.searchParams.get("print") === "1";

  const html = buildAssessmentReportHtml({
    frameworkName: assessment.framework_name,
    frameworkVersion: assessment.framework_version,
    score: assessment.score ?? 0,
    assessmentMode,
    customerProfile,
    report,
    answerRows: buildReportAnswerRows(questionsById, answers),
    generatedAt: new Date().toISOString(),
    autoPrint,
  });

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
