"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Send,
} from "lucide-react";

import { submitAssessment } from "@/app/actions/assessments";
import { ResultsPanel } from "@/components/assessment/results-panel";
import { QuestionField } from "@/components/assessment/question-field";
import { Button } from "@/components/ui/button";
import { getUnansweredRequired } from "@/lib/scoring";
import type {
  AssessmentAnswers,
  AssessmentReport,
  Framework,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type ComplianceQuestionnaireProps = {
  framework: Framework;
};

export function ComplianceQuestionnaire({
  framework,
}: ComplianceQuestionnaireProps) {
  const sections = framework.questions.sections;
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<AssessmentAnswers>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    score: number;
    report: AssessmentReport;
  } | null>(null);

  const currentSection = sections[currentStep];
  const progress = ((currentStep + 1) / sections.length) * 100;
  const answeredInSection = currentSection.questions.filter(
    (question) => answers[question.id]?.value !== undefined,
  ).length;

  const sectionProgress = useMemo(
    () =>
      sections.map((section, index) => {
        const answered = section.questions.filter(
          (question) => answers[question.id]?.value !== undefined,
        ).length;
        return {
          id: section.id,
          title: section.title,
          index,
          answered,
          total: section.questions.length,
          complete: answered === section.questions.length,
        };
      }),
    [answers, sections],
  );

  function updateAnswer(questionId: string, value: AssessmentAnswers[string]) {
    setAnswers((previous) => ({
      ...previous,
      [questionId]: value,
    }));
    setError(null);
  }

  function goToStep(step: number) {
    setCurrentStep(Math.max(0, Math.min(step, sections.length - 1)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleNext() {
    const missing = getUnansweredRequired(
      {
        ...framework.questions,
        sections: [currentSection],
      },
      answers,
    );

    if (missing.length > 0) {
      setError(
        `Please answer all required questions in this section (${missing.length} remaining).`,
      );
      return;
    }

    if (currentStep < sections.length - 1) {
      goToStep(currentStep + 1);
      return;
    }

    handleSubmit();
  }

  function handleSubmit() {
    startTransition(async () => {
      const response = await submitAssessment(
        framework.id,
        framework.name,
        framework.questions,
        answers,
        framework.framework_version_id,
      );

      if (response.error) {
        setError(response.error);
        return;
      }

      if (response.success && response.report) {
        setResult({ score: response.score ?? 0, report: response.report });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  if (result) {
    return <ResultsPanel score={result.score} report={result.report} />;
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">
              {framework.name}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {currentSection.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {currentSection.description}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-foreground">
              Step {currentStep + 1} of {sections.length}
            </p>
            <p className="text-xs text-muted-foreground">
              {answeredInSection} of {currentSection.questions.length} answered
              in this section
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Overall progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {sectionProgress.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => goToStep(section.index)}
              className={cn(
                "min-w-[9rem] rounded-lg border px-3 py-2 text-left transition-colors",
                currentStep === section.index
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background hover:bg-muted/50",
              )}
            >
              <p className="truncate text-xs font-medium text-foreground">
                {section.title}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {section.answered}/{section.total}
                {section.complete ? " ✓" : ""}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {currentSection.questions.map((question, index) => (
          <div key={question.id} className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Question {index + 1} of {currentSection.questions.length}
            </p>
            <QuestionField
              question={question}
              answer={answers[question.id]}
              onChange={(value) => updateAnswer(question.id, value)}
            />
          </div>
        ))}
      </div>

      {error ? (
        <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="sticky bottom-4 z-10 rounded-2xl border border-border/70 bg-background/90 p-4 shadow-lg backdrop-blur-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {currentStep === sections.length - 1
              ? "Review your answers, then submit to save your assessment."
              : "Complete required questions to continue to the next section."}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => goToStep(currentStep - 1)}
              disabled={currentStep === 0 || isPending}
            >
              <ArrowLeft />
              Previous
            </Button>
            <Button onClick={handleNext} disabled={isPending}>
              {isPending ? (
                <Loader2 className="animate-spin" />
              ) : currentStep === sections.length - 1 ? (
                <Send />
              ) : (
                <ArrowRight />
              )}
              {currentStep === sections.length - 1
                ? "Submit assessment"
                : "Next section"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
