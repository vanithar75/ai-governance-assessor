import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Download,
  GitCompareArrows,
} from "lucide-react";

import { ExportMarkdownButton } from "@/components/assessment/export-markdown-button";
import { RfpSummaryPanel } from "@/components/assessment/rfp-summary-panel";
import { SiteHeader } from "@/components/dashboard/site-header";
import { Button } from "@/components/ui/button";
import { fetchRelatedControlsForVersion } from "@/lib/control-mappings";
import { parseFramework } from "@/lib/frameworks";
import { createClient } from "@/lib/supabase/server";
import type {
  AssessmentAnswers,
  AssessmentMode,
  AssessmentReport,
  CustomerProfile,
  FrameworkQuestion,
  QuestionAnswer,
} from "@/lib/types";

type AssessmentDetailPageProps = {
  params: Promise<{ id: string }>;
};

function formatAnswer(question: FrameworkQuestion, answer?: QuestionAnswer) {
  if (!answer || answer.value === undefined || answer.value === "") {
    return "Not answered";
  }

  if (question.type === "yes_no") {
    return answer.value === true ? "Yes" : "No";
  }

  if (question.type === "scale" && question.options?.length) {
    const index =
      typeof answer.value === "number"
        ? answer.value
        : question.options.indexOf(String(answer.value));
    return question.options[index] ?? String(answer.value);
  }

  return String(answer.value);
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default async function AssessmentDetailPage({
  params,
}: AssessmentDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
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
    notFound();
  }

  if (assessment.status === "draft" || assessment.status === "in_progress") {
    redirect(`/assess/${assessment.framework_id}`);
  }

  const answers = assessment.answers as AssessmentAnswers;
  const report = assessment.report as AssessmentReport | null;
  const assessmentMode = (assessment.assessment_mode ??
    "internal") as AssessmentMode;
  const customerProfile = assessment.customer_profile as CustomerProfile | null;
  const isCustomerMode = assessmentMode === "customer";

  const questionsById = new Map<string, FrameworkQuestion>();
  let relatedControls: Awaited<
    ReturnType<typeof fetchRelatedControlsForVersion>
  > = [];

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

    const answeredIds = Object.keys(answers).filter((key) => key !== "__meta");
    relatedControls = await fetchRelatedControlsForVersion(
      supabase,
      assessment.framework_version_id,
      answeredIds,
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.1),_transparent_40%),linear-gradient(to_bottom,_#f8fafc,_#ffffff)] dark:bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.16),_transparent_40%),linear-gradient(to_bottom,_#020617,_#020617)]">
      <SiteHeader userEmail={user.email} showBack />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/" />}
            >
              <ArrowLeft />
              Back to dashboard
            </Button>
            <Button
              variant="default"
              size="sm"
              nativeButton={false}
              render={
                <a
                  href={`/assessments/${id}/report?print=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <Download />
              Download PDF
            </Button>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium text-primary">
                  {assessment.framework_name}
                  {assessment.framework_version
                    ? ` · v${assessment.framework_version}`
                    : ""}
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  {isCustomerMode ? "Customer RFP assessment report" : "Assessment report"}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                    {isCustomerMode ? "Customer RFP" : "Internal"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="size-4" />
                    {formatDate(report?.completedAt ?? assessment.updated_at)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="size-3.5" />
                    Completed
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-3">
                <ExportMarkdownButton assessmentId={assessment.id} />
                <div className="flex size-24 shrink-0 items-center justify-center rounded-full border-4 border-primary/20 bg-background">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-foreground">
                      {assessment.score ?? 0}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Score
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {report?.summary ? (
              <p className="mt-5 text-sm leading-6 text-muted-foreground">
                {report.summary}
              </p>
            ) : null}
          </div>
        </div>

        {isCustomerMode && report?.rfpSummary ? (
          <section className="mb-8">
            <RfpSummaryPanel
              summary={report.rfpSummary}
              customerProfile={customerProfile}
            />
          </section>
        ) : null}

        {report?.sectionScores?.length ? (
          <section className="mb-8 rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Section scores
            </h2>
            <div className="space-y-4">
              {report.sectionScores.map((section) => (
                <div key={section.sectionId} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">
                      {section.title}
                    </span>
                    <span className="text-muted-foreground">
                      {section.percentage}% ({section.score}/{section.maxScore})
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${section.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {relatedControls.length > 0 && !isCustomerMode ? (
          <section className="mb-8 rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <GitCompareArrows className="size-5 text-primary" />
                Related controls in other frameworks
              </h2>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href="/standards/mappings" />}
              >
                View all mappings
              </Button>
            </div>
            <div className="space-y-3">
              {relatedControls.map((related, index) => (
                <div
                  key={`${related.control_id}-${related.framework_slug}-${index}`}
                  className="rounded-xl border border-border/60 bg-background/50 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono text-primary">
                      {related.control_id}
                    </span>
                    <span>→</span>
                    <span className="font-medium text-foreground">
                      {related.framework_name}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5">
                      {related.mapping_type}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-foreground">{related.title}</p>
                  {related.notes ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {related.notes}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Answers summary
          </h2>
          <div className="space-y-4">
            {Object.entries(answers)
              .filter(([key]) => key !== "__meta")
              .map(([questionId, answer]) => {
                const question = questionsById.get(questionId);
                return (
                  <div
                    key={questionId}
                    className="rounded-xl border border-border/60 bg-background/50 p-4"
                  >
                    {!isCustomerMode ? (
                      <p className="font-mono text-xs text-muted-foreground">
                        {questionId}
                      </p>
                    ) : null}
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {question?.text ?? "Question"}
                    </p>
                    <p className="mt-2 text-sm text-foreground">
                      {question
                        ? formatAnswer(question, answer)
                        : JSON.stringify(answer.value)}
                    </p>
                    {answer.notes ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Notes: {answer.notes}
                      </p>
                    ) : null}
                    {answer.evidence ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Evidence: {answer.evidence.name}
                      </p>
                    ) : null}
                  </div>
                );
              })}
          </div>
        </section>
      </main>
    </div>
  );
}
