import type {
  AssessmentAnswers,
  AssessmentMode,
  AssessmentReport,
  CustomerProfile,
  FrameworkQuestion,
  FrameworkSection,
  QuestionAnswer,
} from "@/lib/types";

export type ReportControlRow = {
  controlId: string;
  text: string;
  answerLabel: string;
  required: boolean;
  notes?: string;
  evidenceName?: string;
};

export type ReportSection = {
  id: string;
  title: string;
  description?: string;
  controls: ReportControlRow[];
};

export type AssessmentReportHtmlInput = {
  frameworkName: string;
  frameworkVersion?: string | null;
  score: number;
  assessmentMode: AssessmentMode;
  customerProfile?: CustomerProfile | null;
  report: AssessmentReport | null;
  sections: ReportSection[];
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

/**
 * Group answered controls by framework section, preserving section and
 * question order. Includes every control (even unanswered optional ones) so
 * the report reads as a full control-by-control result set.
 */
export function buildReportSections(
  frameworkSections: FrameworkSection[],
  answers: AssessmentAnswers,
): ReportSection[] {
  return frameworkSections.map((section) => ({
    id: section.id,
    title: section.title,
    description: section.description,
    controls: section.questions.map((question) => {
      const answer = answers[question.id];
      return {
        controlId: question.id,
        text: question.text,
        answerLabel: formatAnswerValue(question, answer),
        required: question.required,
        notes: answer?.notes,
        evidenceName: answer?.evidence?.name,
      };
    }),
  }));
}

/**
 * Fallback grouping for legacy assessments that are not pinned to a framework
 * version (no normalized question metadata available). Renders the raw
 * responses under a single section.
 */
export function buildFallbackSections(
  answers: AssessmentAnswers,
): ReportSection[] {
  const controls: ReportControlRow[] = Object.entries(answers)
    .filter(([key]) => key !== "__meta")
    .map(([questionId, answer]) => ({
      controlId: questionId,
      text: questionId,
      answerLabel: String(answer.value),
      required: false,
      notes: answer.notes,
      evidenceName: answer.evidence?.name,
    }));

  if (controls.length === 0) {
    return [];
  }

  return [{ id: "responses", title: "Responses", controls }];
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

function formatDateOnly(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(date);
}

function renderCoverPage(input: AssessmentReportHtmlInput): string {
  const isCustomer = input.assessmentMode === "customer";
  const reportKind = isCustomer
    ? "Customer RFP Compliance Report"
    : "Internal Compliance Report";
  const versionLabel = input.frameworkVersion
    ? `Version ${escapeHtml(String(input.frameworkVersion))}`
    : "";
  const completedAt = input.report?.completedAt ?? input.generatedAt;

  const profile = input.customerProfile;
  const profileBlock =
    isCustomer && profile
      ? `<div class="cover-profile">
          ${profile.companyName ? `<div><span>Prepared for</span><strong>${escapeHtml(profile.companyName)}</strong></div>` : ""}
          ${profile.rfpReference ? `<div><span>RFP reference</span><strong>${escapeHtml(profile.rfpReference)}</strong></div>` : ""}
          ${profile.industry ? `<div><span>Industry</span><strong>${escapeHtml(profile.industry)}</strong></div>` : ""}
          ${profile.contactEmail ? `<div><span>Contact</span><strong>${escapeHtml(profile.contactEmail)}</strong></div>` : ""}
        </div>`
      : "";

  return `
    <section class="cover">
      <div class="cover-top">
        <p class="cover-brand">AI Governance Assessor</p>
        <span class="badge">${isCustomer ? "Customer RFP" : "Internal"}</span>
      </div>
      <div class="cover-main">
        <p class="cover-kicker">${escapeHtml(reportKind)}</p>
        <h1 class="cover-title">${escapeHtml(input.frameworkName)}</h1>
        ${versionLabel ? `<p class="cover-version">${versionLabel}</p>` : ""}
        <div class="cover-score">
          <div class="cover-score-num">${input.score}</div>
          <div class="cover-score-lbl">Overall score / 100</div>
        </div>
        ${profileBlock}
      </div>
      <div class="cover-foot">
        <div><span>Assessment completed</span><strong>${escapeHtml(formatDateOnly(completedAt))}</strong></div>
        <div><span>Report generated</span><strong>${escapeHtml(formatDateOnly(input.generatedAt))}</strong></div>
      </div>
    </section>`;
}

function renderExecutiveSummary(input: AssessmentReportHtmlInput): string {
  const report = input.report;
  const summaryText = report?.summary ?? "";

  const metrics: Array<[string, string]> = [
    ["Overall score", `${input.score} / 100`],
  ];

  if (report) {
    metrics.push([
      "Questions answered",
      `${report.answeredQuestions} / ${report.totalQuestions}`,
    ]);
    metrics.push([
      "Required controls met",
      `${report.requiredAnswered} / ${report.requiredQuestions}`,
    ]);
  }

  if (input.assessmentMode === "customer" && report?.rfpSummary) {
    metrics.push([
      "High-risk gaps",
      String(report.rfpSummary.highRiskGaps.length),
    ]);
    metrics.push([
      "Non-compliance flags",
      String(report.rfpSummary.nonComplianceFlags.length),
    ]);
  }

  const metricCells = metrics
    .map(
      ([label, value]) =>
        `<div class="metric"><span class="metric-label">${escapeHtml(label)}</span><span class="metric-value">${escapeHtml(value)}</span></div>`,
    )
    .join("");

  return `
    <section class="card">
      <h2>Executive summary</h2>
      ${summaryText ? `<p class="summary">${escapeHtml(summaryText)}</p>` : ""}
      <div class="metric-grid">${metricCells}</div>
    </section>`;
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

function renderControlResults(sections: ReportSection[]): string {
  if (!sections.length) {
    return "";
  }

  const sectionBlocks = sections
    .map((section) => {
      const controls = section.controls
        .map(
          (control) => `
            <div class="control">
              <div class="control-head">
                <span class="control-id">${escapeHtml(control.controlId)}</span>
                ${control.required ? `<span class="tag tag-required">Required</span>` : `<span class="tag">Optional</span>`}
              </div>
              <p class="control-q">${escapeHtml(control.text)}</p>
              <p class="control-a"><span class="control-a-label">Response:</span> ${escapeHtml(control.answerLabel)}</p>
              ${control.notes ? `<p class="muted">Notes: ${escapeHtml(control.notes)}</p>` : ""}
              ${control.evidenceName ? `<p class="muted">Evidence: ${escapeHtml(control.evidenceName)}</p>` : ""}
            </div>`,
        )
        .join("");

      return `
        <div class="control-section">
          <h3>${escapeHtml(section.title)}</h3>
          ${section.description ? `<p class="muted">${escapeHtml(section.description)}</p>` : ""}
          ${controls}
        </div>`;
    })
    .join("");

  return `<section class="card"><h2>Control-by-control results</h2>${sectionBlocks}</section>`;
}

function renderEvidenceReferences(sections: ReportSection[]): string {
  const items = sections.flatMap((section) =>
    section.controls
      .filter((control) => control.evidenceName)
      .map(
        (control) =>
          `<li><span class="control-id">${escapeHtml(control.controlId)}</span> ${escapeHtml(control.evidenceName ?? "")} <span class="muted">(${escapeHtml(section.title)})</span></li>`,
      ),
  );

  const body = items.length
    ? `<ul class="list">${items.join("")}</ul>`
    : `<p class="muted">No supporting evidence files were attached to this assessment.</p>`;

  return `<section class="card"><h2>Evidence references</h2>${body}</section>`;
}

export function buildAssessmentReportHtml(
  input: AssessmentReportHtmlInput,
): string {
  const docTitle = `${input.frameworkName} Compliance Report`;

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
    background: #f1f5f9;
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
    z-index: 10;
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
  .page { max-width: 820px; margin: 0 auto; padding: 24px; }
  .badge {
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 999px;
    background: #eef2ff;
    color: #4338ca;
  }
  /* Cover page */
  .cover {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 48px 40px;
    min-height: 60vh;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    margin-bottom: 24px;
  }
  .cover-top { display: flex; justify-content: space-between; align-items: center; }
  .cover-brand { font-weight: 700; color: #4f46e5; margin: 0; letter-spacing: 0.01em; }
  .cover-main { padding: 40px 0; }
  .cover-kicker { color: #64748b; font-size: 14px; font-weight: 600; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.06em; }
  .cover-title { font-size: 40px; line-height: 1.1; margin: 0; }
  .cover-version { color: #64748b; margin: 8px 0 0; font-size: 15px; }
  .cover-score {
    margin-top: 32px;
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    padding: 20px 32px;
    border: 2px solid rgba(79,70,229,0.25);
    border-radius: 16px;
    background: #f8fafc;
  }
  .cover-score-num { font-size: 52px; font-weight: 800; color: #4f46e5; line-height: 1; }
  .cover-score-lbl { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 6px; }
  .cover-profile {
    margin-top: 32px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px 28px;
    max-width: 540px;
  }
  .cover-profile div { display: flex; flex-direction: column; }
  .cover-profile span { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; }
  .cover-profile strong { font-size: 15px; }
  .cover-foot {
    display: flex; gap: 48px;
    border-top: 1px solid #e2e8f0; padding-top: 20px;
  }
  .cover-foot div { display: flex; flex-direction: column; }
  .cover-foot span { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; }
  .cover-foot strong { font-size: 14px; }
  /* Content cards */
  .card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 22px;
    margin-bottom: 20px;
  }
  .card h2 { font-size: 18px; margin: 0 0 14px; }
  .card h3 { font-size: 14px; margin: 18px 0 6px; color: #334155; }
  .summary { font-size: 14px; color: #475569; margin: 0 0 16px; }
  .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
  .metric {
    border: 1px solid #eef2f7; border-radius: 10px; padding: 12px 14px;
    display: flex; flex-direction: column; gap: 4px; background: #f8fafc;
  }
  .metric-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #94a3b8; }
  .metric-value { font-size: 18px; font-weight: 700; }
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
  .control-section { margin-bottom: 18px; }
  .control {
    border: 1px solid #eef2f7;
    border-radius: 10px;
    padding: 12px 14px;
    margin-bottom: 10px;
  }
  .control-head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
  .control-id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: #4f46e5; }
  .tag {
    font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em;
    padding: 1px 7px; border-radius: 999px; background: #f1f5f9; color: #64748b;
  }
  .tag-required { background: #eef2ff; color: #4338ca; }
  .control-q { font-weight: 600; font-size: 13px; margin: 0 0 4px; }
  .control-a { font-size: 13px; margin: 0; }
  .control-a-label { color: #64748b; font-weight: 600; }
  footer.report-footer { color: #94a3b8; font-size: 11px; text-align: center; margin-top: 24px; }
  @media print {
    body { background: #ffffff; }
    .toolbar { display: none; }
    .page { max-width: none; padding: 0; }
    .cover {
      border: none; border-radius: 0; min-height: calc(100vh - 32mm);
      break-after: page; margin-bottom: 0;
    }
    .card { break-inside: avoid; border-radius: 0; border-left: none; border-right: none; }
    .control, .control-section { break-inside: avoid; }
    @page { margin: 16mm; }
  }
</style>
</head>
<body>
  <div class="toolbar"><button type="button" onclick="window.print()">Save as PDF</button></div>
  <div class="page">
    ${renderCoverPage(input)}
    ${renderExecutiveSummary(input)}
    ${input.report ? renderSectionScores(input.report) : ""}
    ${input.assessmentMode === "customer" && input.report ? renderRfpSummary(input.report) : ""}
    ${renderControlResults(input.sections)}
    ${renderEvidenceReferences(input.sections)}
    <footer class="report-footer">Generated by AI Governance Assessor · ${escapeHtml(formatDate(input.generatedAt))}</footer>
  </div>
  ${autoPrintScript}
</body>
</html>`;
}
