import { AlertTriangle, CheckCircle2, Lightbulb } from "lucide-react";

import type { CustomerProfile, RfpSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

type RfpSummaryPanelProps = {
  summary: RfpSummary;
  customerProfile?: CustomerProfile | null;
  compact?: boolean;
};

export function RfpSummaryPanel({
  summary,
  customerProfile,
  compact = false,
}: RfpSummaryPanelProps) {
  return (
    <div className="space-y-6">
      {customerProfile ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">
            Customer context
          </p>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">Company</span>
              <p className="font-medium text-foreground">
                {customerProfile.companyName}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">RFP reference</span>
              <p className="font-medium text-foreground">
                {customerProfile.rfpReference}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Industry</span>
              <p className="font-medium text-foreground">
                {customerProfile.industry}
              </p>
            </div>
            {customerProfile.contactEmail ? (
              <div>
                <span className="text-muted-foreground">Contact</span>
                <p className="font-medium text-foreground">
                  {customerProfile.contactEmail}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <section className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" />
          <h2 className="text-lg font-semibold text-foreground">
            RFP risk summary
          </h2>
        </div>
        <p className="mb-5 text-sm text-muted-foreground">
          Sections below {summary.thresholdPercent}% and required controls flagged
          for presales appendix drafting.
        </p>

        <div className="space-y-6">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              High-risk gaps
            </h3>
            {summary.highRiskGaps.length > 0 ? (
              <ul className="space-y-2">
                {summary.highRiskGaps.map((gap) => (
                  <li
                    key={gap.sectionId}
                    className="flex items-start justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm"
                  >
                    <span className="font-medium text-foreground">
                      {gap.sectionTitle}
                    </span>
                    <span className="shrink-0 font-semibold text-amber-700 dark:text-amber-300">
                      {gap.percentage}%
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                No sections below the {summary.thresholdPercent}% threshold.
              </p>
            )}
          </div>

          {!compact ? (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                Non-compliance flags
              </h3>
              {summary.nonComplianceFlags.length > 0 ? (
                <ul className="space-y-3">
                  {summary.nonComplianceFlags.map((flag) => (
                    <li
                      key={flag.questionId}
                      className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3"
                    >
                      <p className="text-xs font-medium text-destructive">
                        {flag.sectionTitle}
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {flag.questionText}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {flag.reason}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="size-4 shrink-0" />
                  No required non-compliance flags detected.
                </p>
              )}
            </div>
          ) : null}

          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Lightbulb className="size-4 text-primary" />
              Recommended actions (presales appendix)
            </h3>
            <ol className="space-y-3">
              {summary.recommendedActions.map((item, index) => (
                <li
                  key={`${item.action.slice(0, 40)}-${index}`}
                  className="rounded-xl border border-border/60 bg-background/50 px-4 py-3 text-sm"
                >
                  <span
                    className={cn(
                      "mb-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                      item.priority === "high"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                    )}
                  >
                    {item.priority} priority
                  </span>
                  <p className="leading-6 text-foreground">{item.action}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </div>
  );
}
