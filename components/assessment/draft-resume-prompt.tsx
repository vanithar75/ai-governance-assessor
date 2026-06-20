"use client";

import { useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";

import { discardAssessmentDraft } from "@/app/actions/assessments";
import { Button } from "@/components/ui/button";
import type { AssessmentDraft } from "@/lib/types";

type DraftResumePromptProps = {
  frameworkId: string;
  frameworkVersionId?: string;
  draft: AssessmentDraft;
  onResume: () => void;
  onStartFresh: () => void;
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function DraftResumePrompt({
  frameworkId,
  frameworkVersionId,
  draft,
  onResume,
  onStartFresh,
}: DraftResumePromptProps) {
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStartFresh() {
    setIsDiscarding(true);
    setError(null);
    const response = await discardAssessmentDraft(
      frameworkId,
      frameworkVersionId,
    );
    setIsDiscarding(false);

    if (response.error) {
      setError(response.error);
      return;
    }

    onStartFresh();
  }

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 shadow-sm">
      <p className="text-sm font-medium text-primary">Draft found</p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
        Resume your in-progress assessment?
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        You have a saved draft last updated {formatDate(draft.updated_at)}.
        {draft.assessment_mode === "customer" && draft.customer_profile ? (
          <>
            {" "}
            Customer RFP for {draft.customer_profile.companyName} (
            {draft.customer_profile.rfpReference}).
          </>
        ) : draft.assessment_mode === "customer" ? (
          " Customer RFP mode."
        ) : (
          " Internal assessment mode."
        )}{" "}
        Resume to continue where you left off, or start fresh to discard the
        draft.
      </p>

      {error ? (
        <p className="mt-3 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Button onClick={onResume} disabled={isDiscarding}>
          Resume draft
        </Button>
        <Button
          variant="outline"
          onClick={handleStartFresh}
          disabled={isDiscarding}
        >
          {isDiscarding ? <Loader2 className="animate-spin" /> : <RotateCcw />}
          Start fresh
        </Button>
      </div>
    </div>
  );
}
