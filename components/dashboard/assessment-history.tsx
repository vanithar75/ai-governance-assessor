import Link from "next/link";
import { ArrowRight, Clock, FileText } from "lucide-react";

import type { AssessmentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export type AssessmentHistoryItem = {
  id: string;
  framework_id: string;
  framework_name: string;
  framework_version: string | null;
  status: AssessmentStatus;
  score: number | null;
  updated_at: string;
};

type AssessmentHistoryProps = {
  assessments: AssessmentHistoryItem[];
};

const statusLabels: Record<AssessmentStatus, string> = {
  draft: "Draft",
  in_progress: "In progress",
  completed: "Completed",
  archived: "Archived",
};

const statusStyles: Record<AssessmentStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  in_progress: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  archived: "bg-muted text-muted-foreground",
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function assessmentHref(item: AssessmentHistoryItem) {
  if (item.status === "completed" || item.status === "archived") {
    return `/assessments/${item.id}`;
  }
  return `/assess/${item.framework_id}`;
}

export function AssessmentHistory({ assessments }: AssessmentHistoryProps) {
  if (assessments.length === 0) {
    return null;
  }

  return (
    <section className="mt-14">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Your assessments</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Assessment history
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Resume drafts or review completed reports and scores.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="hidden grid-cols-[1.5fr_1fr_0.75fr_0.75fr_0.5fr] gap-4 border-b border-border/70 px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
          <span>Framework</span>
          <span>Status</span>
          <span>Score</span>
          <span>Updated</span>
          <span />
        </div>

        <ul className="divide-y divide-border/70">
          {assessments.map((item) => (
            <li key={item.id}>
              <Link
                href={assessmentHref(item)}
                className="grid gap-3 px-5 py-4 transition-colors hover:bg-muted/30 md:grid-cols-[1.5fr_1fr_0.75fr_0.75fr_0.5fr] md:items-center md:gap-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {item.framework_name}
                  </p>
                  {item.framework_version ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Version {item.framework_version}
                    </p>
                  ) : null}
                </div>

                <div>
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                      statusStyles[item.status],
                    )}
                  >
                    {statusLabels[item.status]}
                  </span>
                </div>

                <div className="text-sm text-foreground">
                  {item.status === "completed" || item.status === "archived" ? (
                    <span className="font-semibold">{item.score ?? "—"}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="size-3.5 shrink-0" />
                  <span>{formatDate(item.updated_at)}</span>
                </div>

                <div className="flex justify-end text-primary">
                  {item.status === "completed" || item.status === "archived" ? (
                    <FileText className="size-4" />
                  ) : (
                    <ArrowRight className="size-4" />
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
