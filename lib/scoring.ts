import type {
  AssessmentAnswers,
  AssessmentReport,
  FrameworkQuestions,
  FrameworkSection,
  FrameworkQuestion,
  QuestionAnswer,
  RfpGapItem,
  RfpNonComplianceItem,
  RfpRecommendedAction,
  RfpSummary,
  SectionScore,
} from "@/lib/types";

export const RFP_GAP_THRESHOLD_PERCENT = 60;

function isAnswered(question: FrameworkQuestion, answer?: QuestionAnswer) {
  if (!answer || answer.value === undefined || answer.value === "") {
    return false;
  }

  if (question.type === "text") {
    return typeof answer.value === "string" && answer.value.trim().length > 0;
  }

  return true;
}

function scoreQuestion(
  question: FrameworkQuestion,
  answer?: QuestionAnswer,
): number {
  if (!isAnswered(question, answer)) {
    return 0;
  }

  if (question.type === "yes_no") {
    return answer?.value === true ? question.weight : 0;
  }

  if (question.type === "scale" && question.options?.length) {
    const index =
      typeof answer?.value === "number"
        ? answer.value
        : question.options.indexOf(String(answer?.value));

    if (index < 0) {
      return 0;
    }

    const ratio = index / Math.max(question.options.length - 1, 1);
    return Math.round(question.weight * ratio * 100) / 100;
  }

  if (question.type === "text") {
    return question.weight * 0.5;
  }

  return 0;
}

function scoreSection(
  section: FrameworkSection,
  answers: AssessmentAnswers,
): SectionScore {
  const maxScore = section.questions.reduce(
    (total, question) => total + question.weight,
    0,
  );
  const score = section.questions.reduce(
    (total, question) => total + scoreQuestion(question, answers[question.id]),
    0,
  );

  return {
    sectionId: section.id,
    title: section.title,
    score: Math.round(score * 100) / 100,
    maxScore,
    percentage: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
  };
}

export function calculateAssessmentScore(
  questions: FrameworkQuestions,
  answers: AssessmentAnswers,
): number {
  const sectionScores = questions.sections.map((section) =>
    scoreSection(section, answers),
  );
  const totalScore = sectionScores.reduce(
    (total, section) => total + section.score,
    0,
  );
  const maxScore = sectionScores.reduce(
    (total, section) => total + section.maxScore,
    0,
  );

  if (maxScore === 0) {
    return 0;
  }

  return Math.round((totalScore / maxScore) * 100);
}

function isLowScaleAnswer(
  question: FrameworkQuestion,
  answer?: QuestionAnswer,
): boolean {
  if (question.type !== "scale" || !question.options?.length || !answer) {
    return false;
  }

  const index =
    typeof answer.value === "number"
      ? answer.value
      : question.options.indexOf(String(answer.value));

  if (index < 0) {
    return false;
  }

  const maxIndex = question.options.length - 1;
  if (maxIndex <= 0) {
    return index === 0;
  }

  return index / maxIndex <= 0.25;
}

function isNonCompliantAnswer(
  question: FrameworkQuestion,
  answer?: QuestionAnswer,
): boolean {
  if (!isAnswered(question, answer)) {
    return false;
  }

  if (question.type === "yes_no") {
    return answer?.value === false;
  }

  if (question.type === "scale") {
    return isLowScaleAnswer(question, answer);
  }

  return false;
}

export function buildRfpSummary(
  questions: FrameworkQuestions,
  answers: AssessmentAnswers,
  sectionScores: SectionScore[],
  thresholdPercent = RFP_GAP_THRESHOLD_PERCENT,
): RfpSummary {
  const highRiskGaps: RfpGapItem[] = sectionScores
    .filter((section) => section.percentage < thresholdPercent)
    .map((section) => ({
      sectionId: section.sectionId,
      sectionTitle: section.title,
      percentage: section.percentage,
    }))
    .sort((a, b) => a.percentage - b.percentage);

  const nonComplianceFlags: RfpNonComplianceItem[] = [];

  for (const section of questions.sections) {
    for (const question of section.questions) {
      if (!question.required) {
        continue;
      }

      const answer = answers[question.id];
      if (!isNonCompliantAnswer(question, answer)) {
        continue;
      }

      let reason = "Required control not met";
      if (question.type === "yes_no") {
        reason = "Required question answered No";
      } else if (question.type === "scale") {
        const optionIndex =
          typeof answer?.value === "number"
            ? answer.value
            : question.options?.indexOf(String(answer?.value)) ?? -1;
        const optionLabel =
          optionIndex >= 0
            ? question.options?.[optionIndex]
            : String(answer?.value);
        reason = `Low maturity rating: ${optionLabel ?? "lowest tier"}`;
      }

      nonComplianceFlags.push({
        questionId: question.id,
        questionText: question.text,
        sectionTitle: section.title,
        reason,
      });
    }
  }

  const recommendedActions: RfpRecommendedAction[] = [];

  for (const gap of highRiskGaps) {
    recommendedActions.push({
      priority: gap.percentage < 40 ? "high" : "medium",
      action: `Address gaps in "${gap.sectionTitle}" (currently ${gap.percentage}%) with a targeted remediation plan and evidence collection before RFP submission.`,
      relatedSections: [gap.sectionTitle],
    });
  }

  for (const flag of nonComplianceFlags.slice(0, 8)) {
    recommendedActions.push({
      priority: "high",
      action: `Resolve non-compliance on "${flag.questionText.slice(0, 80)}${flag.questionText.length > 80 ? "…" : ""}" — ${flag.reason.toLowerCase()}. Document compensating controls or a committed remediation timeline for the RFP appendix.`,
      relatedSections: [flag.sectionTitle],
    });
  }

  if (recommendedActions.length === 0) {
    recommendedActions.push({
      priority: "medium",
      action:
        "Maintain current controls and attach supporting evidence (policies, audit reports, architecture diagrams) to strengthen the RFP response.",
    });
  }

  return {
    highRiskGaps,
    nonComplianceFlags,
    recommendedActions,
    thresholdPercent,
  };
}

export function buildAssessmentReport(
  frameworkName: string,
  questions: FrameworkQuestions,
  answers: AssessmentAnswers,
  options?: { includeRfpSummary?: boolean },
): AssessmentReport {
  const allQuestions = questions.sections.flatMap((section) => section.questions);
  const requiredQuestions = allQuestions.filter((question) => question.required);
  const answeredQuestions = allQuestions.filter((question) =>
    isAnswered(question, answers[question.id]),
  ).length;
  const requiredAnswered = requiredQuestions.filter((question) =>
    isAnswered(question, answers[question.id]),
  ).length;
  const sectionScores = questions.sections.map((section) =>
    scoreSection(section, answers),
  );
  const overallScore = calculateAssessmentScore(questions, answers);

  let summary: string;
  if (overallScore >= 80) {
    summary =
      "Strong compliance posture. Continue monitoring controls and document evidence for audit readiness.";
  } else if (overallScore >= 60) {
    summary =
      "Moderate compliance maturity. Prioritize gaps in lower-scoring sections and assign remediation owners.";
  } else if (overallScore >= 40) {
    summary =
      "Significant gaps identified. Establish foundational governance, risk assessment, and oversight controls.";
  } else {
    summary =
      "Early-stage compliance readiness. Focus on policy, accountability, and core risk management practices first.";
  }

  return {
    summary,
    frameworkName,
    sectionScores,
    completedAt: new Date().toISOString(),
    totalQuestions: allQuestions.length,
    answeredQuestions,
    requiredQuestions: requiredQuestions.length,
    requiredAnswered,
    ...(options?.includeRfpSummary
      ? { rfpSummary: buildRfpSummary(questions, answers, sectionScores) }
      : {}),
  };
}

export function getUnansweredRequired(
  questions: FrameworkQuestions,
  answers: AssessmentAnswers,
): FrameworkQuestion[] {
  return questions.sections
    .flatMap((section) => section.questions)
    .filter(
      (question) =>
        question.required && !isAnswered(question, answers[question.id]),
    );
}
