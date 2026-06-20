export type QuestionType = "yes_no" | "scale" | "text";

export type FrameworkQuestion = {
  id: string;
  text: string;
  type: QuestionType;
  weight: number;
  required: boolean;
  guidance?: string;
  options?: string[];
};

export type FrameworkSection = {
  id: string;
  title: string;
  description: string;
  questions: FrameworkQuestion[];
};

export type FrameworkQuestions = {
  version: string;
  framework: string;
  sections: FrameworkSection[];
};

export type Framework = {
  id: string;
  slug?: string;
  name: string;
  description: string | null;
  questions: FrameworkQuestions;
  framework_version_id?: string;
  framework_version?: string;
  created_at: string;
};

export type AnswerValue = boolean | number | string;

export type AnswerEvidence = {
  path: string;
  name: string;
  url?: string;
};

export type QuestionAnswer = {
  value: AnswerValue;
  notes?: string;
  evidence?: AnswerEvidence;
};

export type AssessmentAnswers = Record<string, QuestionAnswer>;

export type AssessmentStatus =
  | "draft"
  | "in_progress"
  | "completed"
  | "archived";

export type AssessmentMode = "internal" | "customer";

export type CustomerProfile = {
  companyName: string;
  rfpReference: string;
  industry: string;
  contactEmail?: string;
};

export type RfpGapItem = {
  sectionId: string;
  sectionTitle: string;
  percentage: number;
};

export type RfpNonComplianceItem = {
  questionId: string;
  questionText: string;
  sectionTitle: string;
  reason: string;
};

export type RfpRecommendedAction = {
  priority: "high" | "medium";
  action: string;
  relatedSections?: string[];
};

export type RfpSummary = {
  highRiskGaps: RfpGapItem[];
  nonComplianceFlags: RfpNonComplianceItem[];
  recommendedActions: RfpRecommendedAction[];
  thresholdPercent: number;
};

export type SectionScore = {
  sectionId: string;
  title: string;
  score: number;
  maxScore: number;
  percentage: number;
};

export type AssessmentReport = {
  summary: string;
  frameworkName: string;
  sectionScores: SectionScore[];
  completedAt: string;
  totalQuestions: number;
  answeredQuestions: number;
  requiredQuestions: number;
  requiredAnswered: number;
  rfpSummary?: RfpSummary;
};

export type AssessmentWithFramework = {
  id: string;
  user_id: string;
  framework_id: string;
  framework_version_id: string | null;
  framework_name: string;
  framework_description: string | null;
  framework_version: string | null;
  status: AssessmentStatus;
  answers: AssessmentAnswers;
  score: number | null;
  report: AssessmentReport | null;
  assessment_mode: AssessmentMode;
  customer_profile: CustomerProfile | null;
  created_at: string;
  updated_at: string;
};

export type AssessmentDraft = {
  id: string;
  answers: AssessmentAnswers;
  status: AssessmentStatus;
  updated_at: string;
  assessment_mode: AssessmentMode;
  customer_profile: CustomerProfile | null;
};

export type AssessmentSessionConfig = {
  assessmentMode: AssessmentMode;
  customerProfile?: CustomerProfile | null;
};
