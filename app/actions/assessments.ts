"use server";

import { revalidatePath } from "next/cache";

import {
  buildAssessmentReport,
  calculateAssessmentScore,
  getUnansweredRequired,
} from "@/lib/scoring";
import { createClient } from "@/lib/supabase/server";
import type { AssessmentAnswers, FrameworkQuestions } from "@/lib/types";

export async function submitAssessment(
  frameworkId: string,
  frameworkName: string,
  questions: FrameworkQuestions,
  answers: AssessmentAnswers,
  frameworkVersionId?: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to submit an assessment." };
  }

  const missingRequired = getUnansweredRequired(questions, answers);
  if (missingRequired.length > 0) {
    return {
      error: `Please answer all required questions (${missingRequired.length} remaining).`,
    };
  }

  const score = calculateAssessmentScore(questions, answers);
  const report = buildAssessmentReport(frameworkName, questions, answers);

  const { data, error } = await supabase
    .from("assessments")
    .insert({
      user_id: user.id,
      framework_id: frameworkId,
      framework_version_id: frameworkVersionId ?? null,
      status: "completed",
      answers,
      score,
      report,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true, assessmentId: data.id, score, report };
}
