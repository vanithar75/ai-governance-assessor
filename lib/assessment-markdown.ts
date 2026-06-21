import type {
  AssessmentAnswers,
  AssessmentMode,
  AssessmentReport,
  CustomerProfile,
  FrameworkQuestion,
  QuestionAnswer,
} from "@/lib/types";

export type AssessmentMarkdownInput = {
  frameworkName: string;
  frameworkVersion?: string | null;
  score: number;
  report: AssessmentReport;
  answers: AssessmentAnswers;
  questionsById: Map<string, FrameworkQuestion>;
  assessmentMode: AssessmentMode;
  customerProfile?: CustomerProfile | null;
};

function formatAnswer(question: FrameworkQuestion, answer?: QuestionAnswer): string {
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

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(iso));
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function buildAssessmentMarkdownFilename(input: AssessmentMarkdownInput): string {
  const date = new Date(input.report.completedAt).toISOString().slice(0, 10);
  if (input.assessmentMode === "customer" && input.customerProfile?.companyName) {
    const slug = input.customerProfile.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return `rfp-assessment-${slug || "customer"}-${date}.md`;
  }
  const frameworkSlug = input.frameworkName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `assessment-${frameworkSlug || "report"}-${date}.md`;
}

export function buildAssessmentMarkdown(input: AssessmentMarkdownInput): string {
  const {
    frameworkName,
    frameworkVersion,
    score,
    report,
    answers,
    questionsById,
    assessmentMode,
    customerProfile,
  } = input;

  const isCustomerMode = assessmentMode === "customer";
  const completedAt = report.completedAt;
  const lines: string[] = [];

  lines.push(
    isCustomerMode
      ? "# Customer RFP Assessment Report"
      : "# AI Governance Assessment Report",
  );
  lines.push("");

  if (isCustomerMode && customerProfile) {
    lines.push("## Customer context");
    lines.push("");
    lines.push(`- **Company:** ${customerProfile.companyName}`);
    lines.push(`- **RFP reference:** ${customerProfile.rfpReference}`);
    lines.push(`- **Industry:** ${customerProfile.industry}`);
    if (customerProfile.contactEmail) {
      lines.push(`- **Contact:** ${customerProfile.contactEmail}`);
    }
    lines.push("");
  }

  lines.push("## Assessment overview");
  lines.push("");
  lines.push(`- **Framework:** ${frameworkName}`);
  if (frameworkVersion) {
    lines.push(`- **Version:** ${frameworkVersion}`);
  }
  lines.push(`- **Completed:** ${formatDate(completedAt)}`);
  lines.push(`- **Assessment mode:** ${isCustomerMode ? "Customer RFP" : "Internal"}`);
  lines.push(`- **Overall score:** ${score}/100`);
  lines.push("");

  if (report.summary) {
    lines.push("## Executive summary");
    lines.push("");
    lines.push(report.summary);
    lines.push("");
  }

  if (report.sectionScores.length > 0) {
    lines.push("## Section scores");
    lines.push("");
    lines.push("| Section | Score | Max | Percentage |");
    lines.push("| --- | ---: | ---: | ---: |");
    for (const section of report.sectionScores) {
      lines.push(
        `| ${escapeTableCell(section.title)} | ${section.score} | ${section.maxScore} | ${section.percentage}% |`,
      );
    }
    lines.push("");
  }

  if (isCustomerMode && report.rfpSummary) {
    const { rfpSummary } = report;
    lines.push("## RFP risk summary");
    lines.push("");
    lines.push(
      `Sections below ${rfpSummary.thresholdPercent}% and required controls flagged for presales appendix drafting.`,
    );
    lines.push("");

    lines.push("### High-risk gaps");
    lines.push("");
    if (rfpSummary.highRiskGaps.length > 0) {
      for (const gap of rfpSummary.highRiskGaps) {
        lines.push(`- **${gap.sectionTitle}** — ${gap.percentage}%`);
      }
    } else {
      lines.push(`No sections below the ${rfpSummary.thresholdPercent}% threshold.`);
    }
    lines.push("");

    lines.push("### Non-compliance flags");
    lines.push("");
    if (rfpSummary.nonComplianceFlags.length > 0) {
      for (const flag of rfpSummary.nonComplianceFlags) {
        lines.push(`#### ${flag.sectionTitle}`);
        lines.push("");
        lines.push(flag.questionText);
        lines.push("");
        lines.push(`*${flag.reason}*`);
        lines.push("");
      }
    } else {
      lines.push("No required non-compliance flags detected.");
      lines.push("");
    }

    lines.push("### Recommended actions (presales appendix)");
    lines.push("");
    rfpSummary.recommendedActions.forEach((item, index) => {
      lines.push(`${index + 1}. **[${item.priority} priority]** ${item.action}`);
    });
    lines.push("");
  }

  const answerEntries = Object.entries(answers).filter(([key]) => key !== "__meta");
  if (answerEntries.length > 0) {
    lines.push("## Answers summary");
    lines.push("");
    for (const [questionId, answer] of answerEntries) {
      const question = questionsById.get(questionId);
      const heading = question?.text ?? questionId;
      lines.push(`### ${heading}`);
      lines.push("");
      if (!isCustomerMode) {
        lines.push(`- **Question ID:** \`${questionId}\``);
      }
      lines.push(
        `- **Answer:** ${question ? formatAnswer(question, answer) : JSON.stringify(answer.value)}`,
      );
      if (answer.notes) {
        lines.push(`- **Notes:** ${answer.notes}`);
      }
      if (answer.evidence) {
        lines.push(`- **Evidence:** ${answer.evidence.name}`);
      }
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("");
  lines.push("*Generated by AI Governance Assessor*");

  return lines.join("\n");
}
