"use server";

import { revalidatePath } from "next/cache";

import {
  buildAssessmentReport,
  calculateAssessmentScore,
  getUnansweredRequired,
} from "@/lib/scoring";
import { createClient } from "@/lib/supabase/server";
import type {
  AssessmentAnswers,
  AssessmentDraft,
  AssessmentMode,
  AssessmentStatus,
  CustomerProfile,
  FrameworkQuestions,
} from "@/lib/types";

const ACTIVE_DRAFT_STATUSES: AssessmentStatus[] = ["draft", "in_progress"];

function countAnsweredQuestions(answers: AssessmentAnswers): number {
  return Object.values(answers).filter(
    (answer) => answer?.value !== undefined && answer.value !== "",
  ).length;
}

function draftStatusForAnswers(answers: AssessmentAnswers): AssessmentStatus {
  return countAnsweredQuestions(answers) > 0 ? "in_progress" : "draft";
}

async function findActiveDraft(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  frameworkVersionId?: string,
  frameworkId?: string,
) {
  let query = supabase
    .from("assessments")
    .select(
      "id, answers, status, updated_at, assessment_mode, customer_profile",
    )
    .eq("user_id", userId)
    .in("status", ACTIVE_DRAFT_STATUSES);

  if (frameworkVersionId) {
    query = query.eq("framework_version_id", frameworkVersionId);
  } else if (frameworkId) {
    query = query.eq("framework_id", frameworkId).is("framework_version_id", null);
  } else {
    return { data: null, error: null };
  }

  return query.order("updated_at", { ascending: false }).limit(1).maybeSingle();
}

export async function getAssessmentDraft(
  frameworkId: string,
  frameworkVersionId?: string,
): Promise<{ draft: AssessmentDraft | null; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { draft: null, error: "You must be signed in." };
  }

  const { data, error } = await findActiveDraft(
    supabase,
    user.id,
    frameworkVersionId,
    frameworkId,
  );

  if (error) {
    return { draft: null, error: error.message };
  }

  if (!data) {
    return { draft: null };
  }

  return {
    draft: {
      id: data.id,
      answers: data.answers as AssessmentAnswers,
      status: data.status as AssessmentStatus,
      updated_at: data.updated_at,
      assessment_mode: (data.assessment_mode ?? "internal") as AssessmentMode,
      customer_profile: (data.customer_profile as CustomerProfile | null) ?? null,
    },
  };
}

export async function saveAssessmentDraft(
  frameworkId: string,
  answers: AssessmentAnswers,
  frameworkVersionId?: string,
  currentStep?: number,
  assessmentMode: AssessmentMode = "internal",
  customerProfile?: CustomerProfile | null,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to save a draft." };
  }

  const status = draftStatusForAnswers(answers);
  const answersWithMeta =
    currentStep !== undefined
      ? { ...answers, __meta: { currentStep } }
      : answers;

  const { data: existing, error: findError } = await findActiveDraft(
    supabase,
    user.id,
    frameworkVersionId,
    frameworkId,
  );

  if (findError) {
    return { error: findError.message };
  }

  if (existing) {
    const { data, error } = await supabase
      .from("assessments")
      .update({
        answers: answersWithMeta,
        status,
        assessment_mode: assessmentMode,
        customer_profile:
          assessmentMode === "customer" ? (customerProfile ?? null) : null,
      })
      .eq("id", existing.id)
      .eq("user_id", user.id)
      .select("id")
      .single();

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/");
    revalidatePath(`/assess/${frameworkId}`);
    return { success: true, assessmentId: data.id, status };
  }

  const { data, error } = await supabase
    .from("assessments")
    .insert({
      user_id: user.id,
      framework_id: frameworkId,
      framework_version_id: frameworkVersionId ?? null,
      status,
      answers: answersWithMeta,
      assessment_mode: assessmentMode,
      customer_profile:
        assessmentMode === "customer" ? (customerProfile ?? null) : null,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  revalidatePath(`/assess/${frameworkId}`);
  return { success: true, assessmentId: data.id, status };
}

export async function discardAssessmentDraft(
  frameworkId: string,
  frameworkVersionId?: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  let query = supabase
    .from("assessments")
    .delete()
    .eq("user_id", user.id)
    .in("status", ACTIVE_DRAFT_STATUSES);

  if (frameworkVersionId) {
    query = query.eq("framework_version_id", frameworkVersionId);
  } else {
    query = query.eq("framework_id", frameworkId).is("framework_version_id", null);
  }

  const { error } = await query;

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  revalidatePath(`/assess/${frameworkId}`);
  return { success: true };
}

export async function getEvidenceSignedUrl(path: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  if (!path.startsWith(`${user.id}/`)) {
    return { error: "Access denied." };
  }

  const { data, error } = await supabase.storage
    .from("assessment-evidence")
    .createSignedUrl(path, 3600);

  if (error) {
    return { error: error.message };
  }

  return { url: data.signedUrl };
}

export async function submitAssessment(
  frameworkId: string,
  frameworkName: string,
  questions: FrameworkQuestions,
  answers: AssessmentAnswers,
  frameworkVersionId?: string,
  assessmentId?: string,
  assessmentMode: AssessmentMode = "internal",
  customerProfile?: CustomerProfile | null,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to submit an assessment." };
  }

  const { __meta, ...answerPayload } = answers as AssessmentAnswers & {
    __meta?: { currentStep?: number };
  };

  const missingRequired = getUnansweredRequired(questions, answerPayload);
  if (missingRequired.length > 0) {
    return {
      error: `Please answer all required questions (${missingRequired.length} remaining).`,
    };
  }

  const score = calculateAssessmentScore(questions, answerPayload);
  const report = buildAssessmentReport(
    frameworkName,
    questions,
    answerPayload,
    { includeRfpSummary: assessmentMode === "customer" },
  );

  let targetId = assessmentId;

  if (!targetId) {
    const { data: existingDraft } = await findActiveDraft(
      supabase,
      user.id,
      frameworkVersionId,
      frameworkId,
    );
    targetId = existingDraft?.id;
  }

  if (targetId) {
    const { data, error } = await supabase
      .from("assessments")
      .update({
        status: "completed",
        answers: answerPayload,
        score,
        report,
        assessment_mode: assessmentMode,
        customer_profile:
          assessmentMode === "customer" ? (customerProfile ?? null) : null,
      })
      .eq("id", targetId)
      .eq("user_id", user.id)
      .select("id")
      .single();

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/");
    revalidatePath(`/assessments/${data.id}`);
    return { success: true, assessmentId: data.id, score, report };
  }

  const { data, error } = await supabase
    .from("assessments")
    .insert({
      user_id: user.id,
      framework_id: frameworkId,
      framework_version_id: frameworkVersionId ?? null,
      status: "completed",
      answers: answerPayload,
      score,
      report,
      assessment_mode: assessmentMode,
      customer_profile:
        assessmentMode === "customer" ? (customerProfile ?? null) : null,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  revalidatePath(`/assessments/${data.id}`);
  return { success: true, assessmentId: data.id, score, report };
}
