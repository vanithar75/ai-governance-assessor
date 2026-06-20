"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Save,
  Send,
} from "lucide-react";

import {
  saveAssessmentDraft,
  submitAssessment,
} from "@/app/actions/assessments";
import { DraftResumePrompt } from "@/components/assessment/draft-resume-prompt";
import { ResultsPanel } from "@/components/assessment/results-panel";
import { QuestionField } from "@/components/assessment/question-field";
import { Button } from "@/components/ui/button";
import { getUnansweredRequired } from "@/lib/scoring";
import type {
  AssessmentAnswers,
  AssessmentDraft,
  AssessmentReport,
  AssessmentSessionConfig,
  CustomerProfile,
  Framework,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type ComplianceQuestionnaireProps = {
  framework: Framework;
  initialDraft?: AssessmentDraft | null;
  sessionConfig: AssessmentSessionConfig;
};

type DraftMeta = {
  currentStep?: number;
};

function stripMeta(answers: AssessmentAnswers): AssessmentAnswers {
  const { __meta, ...rest } = answers as AssessmentAnswers & {
    __meta?: DraftMeta;
  };
  return rest;
}

function readMeta(answers: AssessmentAnswers): DraftMeta | undefined {
  return (answers as AssessmentAnswers & { __meta?: DraftMeta }).__meta;
}

export function ComplianceQuestionnaire({
  framework,
  initialDraft,
  sessionConfig,
}: ComplianceQuestionnaireProps) {
  const sections = framework.questions.sections;
  const isCustomerMode = sessionConfig.assessmentMode === "customer";
  const customerProfile: CustomerProfile | null =
    sessionConfig.customerProfile ??
    initialDraft?.customer_profile ??
    null;
  const [showResumePrompt, setShowResumePrompt] = useState(
    Boolean(initialDraft),
  );
  const [assessmentId, setAssessmentId] = useState<string | undefined>(
    initialDraft?.id,
  );
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<AssessmentAnswers>(() =>
    initialDraft ? stripMeta(initialDraft.answers) : {},
  );
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    score: number;
    report: AssessmentReport;
    assessmentId: string;
  } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answersRef = useRef(answers);
  const currentStepRef = useRef(currentStep);

  answersRef.current = answers;
  currentStepRef.current = currentStep;

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

  const persistDraft = useCallback(
    async (nextAnswers: AssessmentAnswers, step: number) => {
      setSaveState("saving");
      const response = await saveAssessmentDraft(
        framework.id,
        nextAnswers,
        framework.framework_version_id,
        step,
        sessionConfig.assessmentMode,
        customerProfile,
      );

      if (response.error) {
        setSaveState("idle");
        return;
      }

      if (response.assessmentId) {
        setAssessmentId(response.assessmentId);
      }
      setSaveState("saved");
    },
    [customerProfile, framework.framework_version_id, framework.id, sessionConfig.assessmentMode],
  );

  const scheduleSave = useCallback(
    (nextAnswers: AssessmentAnswers, step: number) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(() => {
        void persistDraft(nextAnswers, step);
      }, 800);
    },
    [persistDraft],
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  function updateAnswer(questionId: string, value: AssessmentAnswers[string]) {
    setAnswers((previous) => {
      const next = {
        ...previous,
        [questionId]: value,
      };
      if (!assessmentId) {
        void persistDraft(next, currentStepRef.current);
      } else {
        scheduleSave(next, currentStepRef.current);
      }
      return next;
    });
    setError(null);
  }

  function goToStep(step: number) {
    const nextStep = Math.max(0, Math.min(step, sections.length - 1));
    setCurrentStep(nextStep);
    void persistDraft(answersRef.current, nextStep);
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
        assessmentId,
        sessionConfig.assessmentMode,
        customerProfile,
      );

      if (response.error) {
        setError(response.error);
        return;
      }

      if (response.success && response.report && response.assessmentId) {
        setResult({
          score: response.score ?? 0,
          report: response.report,
          assessmentId: response.assessmentId,
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  function handleResumeDraft() {
    if (initialDraft) {
      const meta = readMeta(initialDraft.answers);
      const restoredAnswers = stripMeta(initialDraft.answers);
      setAnswers(restoredAnswers);
      setAssessmentId(initialDraft.id);
      setCurrentStep(
        Math.min(meta?.currentStep ?? 0, sections.length - 1),
      );
    }
    setShowResumePrompt(false);
  }

  function handleStartFresh() {
    setAnswers({});
    setAssessmentId(undefined);
    setCurrentStep(0);
    setShowResumePrompt(false);
  }

  if (result) {
    return (
      <ResultsPanel
        score={result.score}
        report={result.report}
        assessmentId={result.assessmentId}
        isCustomerMode={isCustomerMode}
        customerProfile={customerProfile}
      />
    );
  }

  if (showResumePrompt && initialDraft) {
    return (
      <DraftResumePrompt
        frameworkId={framework.id}
        frameworkVersionId={framework.framework_version_id}
        draft={initialDraft}
        onResume={handleResumeDraft}
        onStartFresh={handleStartFresh}
      />
    );
  }

  return (
    <div className="space-y-8">
      {isCustomerMode && customerProfile ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">
            Customer RFP assessment
          </p>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span>
              <span className="text-muted-foreground">Company: </span>
              <span className="font-medium text-foreground">
                {customerProfile.companyName}
              </span>
            </span>
            <span>
              <span className="text-muted-foreground">RFP: </span>
              <span className="font-medium text-foreground">
                {customerProfile.rfpReference}
              </span>
            </span>
            <span>
              <span className="text-muted-foreground">Industry: </span>
              <span className="font-medium text-foreground">
                {customerProfile.industry}
              </span>
            </span>
          </div>
        </div>
      ) : null}

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
            <p className="mt-1 flex items-center justify-end gap-1 text-xs text-muted-foreground">
              {saveState === "saving" ? (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  Saving...
                </>
              ) : saveState === "saved" ? (
                <>
                  <Save className="size-3" />
                  Draft saved
                </>
              ) : null}
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
              assessmentId={assessmentId}
              onChange={(value) => updateAnswer(question.id, value)}
              customerMode={isCustomerMode}
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
