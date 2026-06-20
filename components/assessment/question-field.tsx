"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2, Paperclip, X } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import type {
  FrameworkQuestion,
  QuestionAnswer,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type QuestionFieldProps = {
  question: FrameworkQuestion;
  answer?: QuestionAnswer;
  assessmentId?: string;
  onChange: (answer: QuestionAnswer) => void;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function QuestionField({
  question,
  answer,
  assessmentId,
  onChange,
}: QuestionFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFileSelect(file: File) {
    setUploadError(null);

    if (file.size > MAX_FILE_SIZE) {
      setUploadError("File must be 10 MB or smaller.");
      return;
    }

    setIsUploading(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setUploadError("You must be signed in to upload evidence.");
        return;
      }

      let activeAssessmentId = assessmentId;

      if (!activeAssessmentId) {
        setUploadError(
          "Save a draft first by answering a question, then attach evidence.",
        );
        return;
      }

      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/${activeAssessmentId}/${question.id}-${sanitizedName}`;

      const { error: uploadErrorResult } = await supabase.storage
        .from("assessment-evidence")
        .upload(path, file, { upsert: true });

      if (uploadErrorResult) {
        setUploadError(uploadErrorResult.message);
        return;
      }

      const { data: signedData } = await supabase.storage
        .from("assessment-evidence")
        .createSignedUrl(path, 3600);

      onChange({
        ...answer,
        value:
          answer?.value ??
          (question.type === "text" ? "" : (undefined as never)),
        evidence: {
          path,
          name: file.name,
          url: signedData?.signedUrl,
        },
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function removeEvidence() {
    onChange({
      ...answer,
      value:
        answer?.value ??
        (question.type === "text" ? "" : (undefined as never)),
      evidence: undefined,
    });
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
            {question.id}
          </span>
          {question.required ? (
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Required
            </span>
          ) : null}
        </div>
        <p className="text-base font-medium leading-7 text-foreground">
          {question.text}
        </p>
        {question.guidance ? (
          <p className="text-sm leading-6 text-muted-foreground">
            {question.guidance}
          </p>
        ) : null}
      </div>

      {question.type === "yes_no" ? (
        <YesNoInput
          value={answer?.value as boolean | undefined}
          onChange={(value) => onChange({ ...answer, value })}
        />
      ) : null}

      {question.type === "scale" && question.options ? (
        <ScaleInput
          options={question.options}
          value={answer?.value as number | undefined}
          onChange={(value) => onChange({ ...answer, value })}
        />
      ) : null}

      {question.type === "text" ? (
        <TextInput
          value={(answer?.value as string) ?? ""}
          onChange={(value) => onChange({ ...answer, value })}
        />
      ) : null}

      <div className="mt-4">
        <label
          htmlFor={`${question.id}-notes`}
          className="mb-2 block text-xs font-medium text-muted-foreground"
        >
          Notes (optional)
        </label>
        <textarea
          id={`${question.id}-notes`}
          value={answer?.notes ?? ""}
          onChange={(event) => {
            if (answer?.value === undefined && question.type !== "text") {
              return;
            }

            onChange({
              value:
                answer?.value ??
                (question.type === "text" ? "" : (answer?.value as never)),
              notes: event.target.value,
              evidence: answer?.evidence,
            });
          }}
          rows={2}
          placeholder="Add context, evidence links, or remediation notes..."
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/30"
        />
      </div>

      <div className="mt-4 border-t border-border/60 pt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <label className="text-xs font-medium text-muted-foreground">
            Evidence attachment (optional)
          </label>
          {!assessmentId ? (
            <span className="text-[11px] text-muted-foreground">
              Answer a question to enable uploads
            </span>
          ) : null}
        </div>

        {answer?.evidence ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <Paperclip className="size-4 shrink-0 text-muted-foreground" />
              {answer.evidence.url ? (
                <a
                  href={answer.evidence.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-sm text-primary hover:underline"
                >
                  {answer.evidence.name}
                </a>
              ) : (
                <span className="truncate text-sm text-foreground">
                  {answer.evidence.name}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={removeEvidence}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Remove evidence"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv,.doc,.docx"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleFileSelect(file);
                }
              }}
            />
            <button
              type="button"
              disabled={!assessmentId || isUploading}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm transition-colors",
                assessmentId
                  ? "hover:border-primary/40 hover:bg-muted/40"
                  : "cursor-not-allowed opacity-60",
              )}
            >
              {isUploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileUp className="size-4" />
              )}
              {isUploading ? "Uploading..." : "Upload evidence file"}
            </button>
          </div>
        )}

        {uploadError ? (
          <p className="mt-2 text-xs text-destructive">{uploadError}</p>
        ) : null}
      </div>
    </div>
  );
}

function YesNoInput({
  value,
  onChange,
}: {
  value?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[true, false].map((option) => (
        <button
          key={String(option)}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            "rounded-lg border px-4 py-3 text-sm font-medium transition-all",
            value === option
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted/50",
          )}
        >
          {option ? "Yes" : "No"}
        </button>
      ))}
    </div>
  );
}

function ScaleInput({
  options,
  value,
  onChange,
}: {
  options: string[];
  value?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      {options.map((option, index) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(index)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-all",
            value === index
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border bg-background hover:border-primary/40 hover:bg-muted/50",
          )}
        >
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
              value === index
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground",
            )}
          >
            {index + 1}
          </span>
          <span>{option}</span>
        </button>
      ))}
    </div>
  );
}

function TextInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={4}
      placeholder="Enter your response..."
      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/30"
    />
  );
}
