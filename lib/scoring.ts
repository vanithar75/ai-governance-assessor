import type {
  AssessmentAnswers,
  AssessmentReport,
  FrameworkQuestions,
  FrameworkSection,
  FrameworkQuestion,
  QuestionAnswer,
  SectionScore,
} from "@/lib/types";

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

export function buildAssessmentReport(
  frameworkName: string,
  questions: FrameworkQuestions,
  answers: AssessmentAnswers,
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
