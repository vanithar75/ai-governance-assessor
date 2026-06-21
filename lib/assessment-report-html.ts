import type {
  AssessmentAnswers,
  AssessmentMode,
  AssessmentReport,
  CustomerProfile,
  FrameworkQuestion,
  QuestionAnswer,
} from "@/lib/types";

export type ReportAnswerRow = {
  questionId: string;
  questionText: string;
  answerLabel: string;
  notes?: string;
  evidenceName?: string;
};

export type AssessmentReportHtmlInput = {
  frameworkName: string;
  frameworkVersion?: string | null;
  score: number;
  assessmentMode: AssessmentMode;
  customerProfile?: CustomerProfile | null;
  report: AssessmentReport | null;
  answerRows: ReportAnswerRow[];
  generatedAt: string;
  /** When true, the document triggers the browser print dialog on load. */
  autoPrint?: boolean;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatAnswerValue(
  question: FrameworkQuestion,
  answer?: QuestionAnswer,
): string {
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

export function buildReportAnswerRows(
  questionsById: Map<string, FrameworkQuestion>,
  answers: AssessmentAnswers,
): ReportAnswerRow[] {
  return Object.entries(answers)
    .filter(([key]) => key !== "__meta")
    .map(([questionId, answer]) => {
      const question = questionsById.get(questionId);
      return {
        questionId,
        questionText: question?.text ?? "Question",
        answerLabel: question
          ? formatAnswerValue(question, answer)
          : String(answer.value),
        notes: answer.notes,
        evidenceName: answer.evidence?.name,
      };
    });
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

function renderCustomerProfile(profile: CustomerProfile): string {
  const rows: Array<[string, string | undefined]> = [
    ["Company", profile.companyName],
    ["RFP reference", profile.rfpReference],
    ["Industry", profile.industry],
    ["Contact", profile.contactEmail],
  ];

  const cells = rows
    .filter(([, value]) => value)
    .map(
      ([label, value]) =>
        `<div class="profile-item"><span class="profile-label">${escapeHtml(
          label,
        )}</span><span class="profile-value">${escapeHtml(
          String(value),
        )}</span></div>`,
    )
    .join("");

  return `<section class="card"><h2>Customer profile</h2><div class="profile-grid">${cells}</div></section>`;
}

function renderSectionScores(report: AssessmentReport): string {
  if (!report.sectionScores?.length) {
    return "";
  }

  const rows = report.sectionScores
    .map(
      (section) => `
        <div class="score-row">
          <div class="score-head">
            <span class="score-title">${escapeHtml(section.title)}</span>
            <span class="score-value">${section.percentage}% (${section.score}/${section.maxScore})</span>
          </div>
          <div class="bar"><div class="bar-fill" style="width:${section.percentage}%"></div></div>
        </div>`,
    )
    .join("");

  return `<section class="card"><h2>Section scores</h2>${rows}</section>`;
}

function renderRfpSummary(report: AssessmentReport): string {
  const summary = report.rfpSummary;
  if (!summary) {
    return "";
  }

  const gaps = summary.highRiskGaps.length
    ? `<ul class="list">${summary.highRiskGaps
        .map(
          (gap) =>
            `<li><strong>${escapeHtml(gap.sectionTitle)}</strong> — ${gap.percentage}% (below ${summary.thresholdPercent}% threshold)</li>`,
        )
        .join("")}</ul>`
    : `<p class="muted">No high-risk gaps below the ${summary.thresholdPercent}% threshold.</p>`;

  const flags = summary.nonComplianceFlags.length
    ? `<ul class="list">${summary.nonComplianceFlags
        .map(
          (flag) =>
            `<li><strong>${escapeHtml(flag.sectionTitle)}:</strong> ${escapeHtml(flag.questionText)} <span class="muted">(${escapeHtml(flag.reason)})</span></li>`,
        )
        .join("")}</ul>`
    : `<p class="muted">No required-control non-compliance flags.</p>`;

  const actions = summary.recommendedActions.length
    ? `<ul class="list">${summary.recommendedActions
        .map(
          (action) =>
            `<li><span class="pill pill-${action.priority}">${action.priority}</span> ${escapeHtml(action.action)}</li>`,
        )
        .join("")}</ul>`
    : "";

  return `
    <section class="card">
      <h2>RFP readiness summary</h2>
      <h3>High-risk gaps</h3>
      ${gaps}
      <h3>Non-compliance flags</h3>
      ${flags}
      <h3>Recommended actions</h3>
      ${actions}
    </section>`;
}

function renderAnswers(rows: ReportAnswerRow[]): string {
  if (!rows.length) {
    return "";
  }

  const body = rows
    .map(
      (row) => `
        <div class="answer">
          <p class="answer-q">${escapeHtml(row.questionText)}</p>
          <p class="answer-a">${escapeHtml(row.answerLabel)}</p>
          ${row.notes ? `<p class="muted">Notes: ${escapeHtml(row.notes)}</p>` : ""}
          ${row.evidenceName ? `<p class="muted">Evidence: ${escapeHtml(row.evidenceName)}</p>` : ""}
        </div>`,
    )
    .join("");

  return `<section class="card answers"><h2>Answers summary</h2>${body}</section>`;
}

export function buildAssessmentReportHtml(
  input: AssessmentReportHtmlInput,
): string {
  const isCustomer = input.assessmentMode === "customer";
  const reportTitle = isCustomer
    ? "Customer RFP Assessment Report"
    : "Assessment Report";
  const versionLabel = input.frameworkVersion
    ? ` · v${escapeHtml(String(input.frameworkVersion))}`
    : "";
  const completedAt = input.report?.completedAt ?? input.generatedAt;

  const docTitle = `${input.frameworkName} ${reportTitle}`;

  const autoPrintScript = input.autoPrint
    ? `<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},350);});</script>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(docTitle)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #0f172a;
    background: #f8fafc;
    line-height: 1.5;
  }
  .toolbar {
    position: sticky;
    top: 0;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 16px;
    background: #ffffff;
    border-bottom: 1px solid #e2e8f0;
  }
  .toolbar button {
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    padding: 8px 14px;
    border-radius: 8px;
    border: 1px solid transparent;
    background: #4f46e5;
    color: #ffffff;
  }
  .page { max-width: 800px; margin: 0 auto; padding: 32px 24px 48px; }
  header.report-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    padding-bottom: 16px;
    border-bottom: 2px solid #e2e8f0;
    margin-bottom: 24px;
  }
  .eyebrow { color: #4f46e5; font-size: 13px; font-weight: 600; margin: 0; }
  h1 { font-size: 26px; margin: 6px 0 4px; }
  .meta { color: #64748b; font-size: 13px; margin: 4px 0 0; }
  .badge {
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 999px;
    background: #eef2ff;
    color: #4338ca;
    margin-bottom: 6px;
  }
  .score-badge {
    flex: 0 0 auto;
    width: 96px; height: 96px;
    border-radius: 50%;
    border: 5px solid rgba(79,70,229,0.25);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    background: #ffffff;
  }
  .score-badge .num { font-size: 30px; font-weight: 700; }
  .score-badge .lbl { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b; }
  .card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 20px;
    margin-bottom: 20px;
  }
  .card h2 { font-size: 17px; margin: 0 0 14px; }
  .card h3 { font-size: 14px; margin: 16px 0 6px; color: #334155; }
  .summary { font-size: 14px; color: #475569; }
  .profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; }
  .profile-item { display: flex; flex-direction: column; }
  .profile-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; }
  .profile-value { font-size: 14px; font-weight: 500; }
  .score-row { margin-bottom: 14px; }
  .score-head { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 5px; }
  .score-title { font-weight: 600; }
  .score-value { color: #64748b; }
  .bar { height: 8px; background: #e2e8f0; border-radius: 999px; overflow: hidden; }
  .bar-fill { height: 100%; background: #4f46e5; border-radius: 999px; }
  .list { margin: 6px 0; padding-left: 18px; font-size: 13px; }
  .list li { margin-bottom: 6px; }
  .muted { color: #64748b; font-size: 13px; }
  .pill {
    display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase;
    padding: 1px 7px; border-radius: 999px; margin-right: 6px;
  }
  .pill-high { background: #fee2e2; color: #b91c1c; }
  .pill-medium { background: #fef3c7; color: #92400e; }
  .answers .answer {
    border: 1px solid #eef2f7;
    border-radius: 10px;
    padding: 12px 14px;
    margin-bottom: 10px;
  }
  .answer-q { font-weight: 600; font-size: 13px; margin: 0 0 4px; }
  .answer-a { font-size: 13px; margin: 0; }
  footer.report-footer { color: #94a3b8; font-size: 11px; text-align: center; margin-top: 24px; }
  @media print {
    body { background: #ffffff; }
    .toolbar { display: none; }
    .page { max-width: none; padding: 0; }
    .card { break-inside: avoid; box-shadow: none; }
    .answers .answer { break-inside: avoid; }
    @page { margin: 16mm; }
  }
</style>
</head>
<body>
  <div class="toolbar"><button type="button" onclick="window.print()">Save as PDF</button></div>
  <div class="page">
    <header class="report-header">
      <div>
        <span class="badge">${isCustomer ? "Customer RFP" : "Internal"}</span>
        <p class="eyebrow">${escapeHtml(input.frameworkName)}${versionLabel}</p>
        <h1>${escapeHtml(reportTitle)}</h1>
        <p class="meta">Completed ${escapeHtml(formatDate(completedAt))}</p>
      </div>
      <div class="score-badge">
        <span class="num">${input.score}</span>
        <span class="lbl">Score</span>
      </div>
    </header>

    ${input.report?.summary ? `<section class="card"><p class="summary">${escapeHtml(input.report.summary)}</p></section>` : ""}
    ${isCustomer && input.customerProfile ? renderCustomerProfile(input.customerProfile) : ""}
    ${input.report ? renderSectionScores(input.report) : ""}
    ${isCustomer && input.report ? renderRfpSummary(input.report) : ""}
    ${renderAnswers(input.answerRows)}

    <footer class="report-footer">Generated by AI Governance Assessor · ${escapeHtml(formatDate(input.generatedAt))}</footer>
  </div>
  ${autoPrintScript}
</body>
</html>`;
}
