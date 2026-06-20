import Link from "next/link";
import { CheckCircle2, RotateCcw } from "lucide-react";

import { RfpSummaryPanel } from "@/components/assessment/rfp-summary-panel";
import type { AssessmentReport, CustomerProfile } from "@/lib/types";
import { Button } from "@/components/ui/button";

type ResultsPanelProps = {
  score: number;
  report: AssessmentReport;
  assessmentId?: string;
  isCustomerMode?: boolean;
  customerProfile?: CustomerProfile | null;
};

export function ResultsPanel({
  score,
  report,
  assessmentId,
  isCustomerMode = false,
  customerProfile,
}: ResultsPanelProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-7" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          {isCustomerMode ? "Customer assessment submitted" : "Assessment submitted"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {isCustomerMode
            ? `RFP readiness results for ${customerProfile?.companyName ?? "customer"} have been saved.`
            : `Your ${report.frameworkName} results have been saved to Supabase.`}
        </p>
        <div className="mx-auto mt-6 flex size-32 items-center justify-center rounded-full border-4 border-emerald-500/30 bg-background">
          <div>
            <p className="text-4xl font-bold text-foreground">{score}</p>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Score
            </p>
          </div>
        </div>
        <p className="mx-auto mt-6 max-w-xl text-sm leading-6 text-muted-foreground">
          {report.summary}
        </p>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold text-foreground">
          Section breakdown
        </h3>
        <div className="space-y-4">
          {report.sectionScores.map((section) => (
            <div key={section.sectionId} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">
                  {section.title}
                </span>
                <span className="text-muted-foreground">
                  {section.percentage}%
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
      </div>

      {isCustomerMode && report.rfpSummary ? (
        <RfpSummaryPanel
          summary={report.rfpSummary}
          customerProfile={customerProfile}
        />
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        {assessmentId ? (
          <Button
            nativeButton={false}
            render={<Link href={`/assessments/${assessmentId}`} />}
          >
            View full report
          </Button>
        ) : null}
        <Button nativeButton={false} render={<Link href="/" />}>
          <RotateCcw />
          Back to dashboard
        </Button>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/" />}
        >
          Start another assessment
        </Button>
      </div>
    </div>
  );
}
