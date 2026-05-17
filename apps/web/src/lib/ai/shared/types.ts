export type Confidence = "low" | "medium" | "high";
export type ProcessingStatus = "pending" | "running" | "complete" | "failed" | "skipped";

export type CvExtractionStatus = "success" | "failed";
export type CvFormat = "pdf" | "markdown";

export type CvJudgement = "supported" | "claimed" | "partial" | "missing" | "unclear";

export type RecommendationLabel =
  | "review_manually"
  | "promising_match"
  | "needs_clarification"
  | "weak_match";

export type NormalizedJob = {
  jobId: string;
  title: string;
  descriptionMarkdown: string;
  requiredSkills: string[];
  niceToHaveSkills: string[];
  workModel?: string;
  workLocation?: string;
  employmentType?: string;
  hiringProcess?: string;
};

export type NormalizedApplication = {
  applicationId: string;
  jobId: string;
  candidate: {
    fullName?: string;
    location?: string;
    timezone?: string;
    phoneNumber?: string;
    githubUrl?: string;
    portfolioUrl?: string;
    linkedinUrl?: string;
    anythingElse?: string;
  };
  cv: {
    originalFileName: string;
    originalFormat: CvFormat;
    extractedMarkdown: string;
    extractionStatus: CvExtractionStatus;
    extractionWarnings: string[];
    wordCount: number;
  };
  normalizedAt: string;
  normalizationVersion: string;
};

export type ValidationPrompt = {
  system: string;
  user: string;
  promptVersion: string;
  responseSchemaVersion: string;
};

export type RequirementMatch = {
  requirement: string;
  requirementType: "required" | "nice_to_have";
  judgement: CvJudgement;
  confidence: Confidence;
  evidence: Array<{
    source: "cv" | "application_field";
    quoteOrSummary: string;
    strength: "weak" | "moderate" | "strong";
  }>;
  gaps: string[];
  suggestedScore: number;
  reasoning: string;
};

export type ValidationModelOutput = {
  candidateSummary: string;
  requirementMatches: RequirementMatch[];
  overall: {
    strengths: string[];
    gaps: string[];
    concerns: string[];
    suggestedInterviewQuestions: string[];
    recruiterSummary: string;
    confidence: Confidence;
    confidenceRationale: string;
  };
};

export type CvFitMetrics = {
  requiredSkillsScore: number;
  niceToHaveSkillsScore: number;
  evidenceCoverageScore: number;
  applicationCompletenessScore: number;
  overallCvFitScore: number;
  requiredSkillsMatched: number;
  requiredSkillsTotal: number;
  niceToHaveSkillsMatched: number;
  niceToHaveSkillsTotal: number;
  confidence: Confidence;
};

export type CandidateEvaluationMetrics = {
  overallFitScore: number;
  cvFitScore: number;
  requiredSkillsScore: number;
  niceToHaveSkillsScore: number;
  confidence: Confidence;
  flags: string[];
  recommendation: RecommendationLabel;
};
