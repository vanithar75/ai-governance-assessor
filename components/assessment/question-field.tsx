import type {
  AssessmentAnswers,
  FrameworkQuestion,
  QuestionAnswer,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type QuestionFieldProps = {
  question: FrameworkQuestion;
  answer?: QuestionAnswer;
  onChange: (answer: QuestionAnswer) => void;
};

export function QuestionField({ question, answer, onChange }: QuestionFieldProps) {
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
            });
          }}
          rows={2}
          placeholder="Add context, evidence links, or remediation notes..."
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/30"
        />
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
