"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  ClipboardList,
  FileText,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildAssessmentStartUrl } from "@/lib/assessment-session";
import type {
  AssessmentMode,
  AssessmentSessionConfig,
  Framework,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type StartAssessmentFormProps = {
  framework: Framework;
};

export function StartAssessmentForm({ framework }: StartAssessmentFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<AssessmentMode>("internal");
  const [companyName, setCompanyName] = useState("");
  const [rfpReference, setRfpReference] = useState("");
  const [industry, setIndustry] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleContinue() {
    setError(null);

    if (mode === "customer") {
      if (!companyName.trim() || !rfpReference.trim() || !industry.trim()) {
        setError(
          "Company name, RFP reference, and industry are required for customer assessments.",
        );
        return;
      }
    }

    const config: AssessmentSessionConfig =
      mode === "customer"
        ? {
            assessmentMode: "customer",
            customerProfile: {
              companyName: companyName.trim(),
              rfpReference: rfpReference.trim(),
              industry: industry.trim(),
              ...(contactEmail.trim()
                ? { contactEmail: contactEmail.trim() }
                : {}),
            },
          }
        : { assessmentMode: "internal", customerProfile: null };

    router.push(buildAssessmentStartUrl(framework.id, config));
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
        <p className="text-sm font-medium text-primary">{framework.name}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Choose assessment mode
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Run an internal readiness check for your team, or capture a
          customer-facing RFP assessment with company context for presales
          responses.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ModeCard
          selected={mode === "internal"}
          title="Internal assessment"
          description="Default mode for your own compliance readiness review."
          icon={ClipboardList}
          onSelect={() => setMode("internal")}
        />
        <ModeCard
          selected={mode === "customer"}
          title="Customer / RFP assessment"
          description="Customer-facing mode with company context and RFP risk summary."
          icon={Users}
          onSelect={() => setMode("customer")}
        />
      </div>

      {mode === "customer" ? (
        <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <Building2 className="size-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              Customer profile
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="companyName"
              label="Company name"
              required
              value={companyName}
              onChange={setCompanyName}
              placeholder="Acme Corp"
            />
            <FormField
              id="rfpReference"
              label="RFP reference"
              required
              value={rfpReference}
              onChange={setRfpReference}
              placeholder="RFP-2026-AI-001"
            />
            <FormField
              id="industry"
              label="Industry"
              required
              value={industry}
              onChange={setIndustry}
              placeholder="Financial services"
            />
            <FormField
              id="contactEmail"
              label="Contact email (optional)"
              value={contactEmail}
              onChange={setContactEmail}
              placeholder="customer@example.com"
              type="email"
            />
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/">Back to dashboard</Link>}
        />
        <Button onClick={handleContinue}>
          {mode === "customer" ? <FileText /> : <ArrowRight />}
          Continue to questionnaire
        </Button>
      </div>
    </div>
  );
}

function ModeCard({
  selected,
  title,
  description,
  icon: Icon,
  onSelect,
}: {
  selected: boolean;
  title: string;
  description: string;
  icon: typeof ClipboardList;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-2xl border p-5 text-left transition-all",
        selected
          ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
          : "border-border/70 bg-card hover:border-primary/30 hover:bg-muted/30",
      )}
    >
      <div
        className={cn(
          "mb-4 flex size-11 items-center justify-center rounded-xl",
          selected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-5" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </button>
  );
}

function FormField({
  id,
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/30"
      />
    </div>
  );
}
