import type PocketBase from "pocketbase";

import { requireAiConfig } from "../config";
import { normalizeApplication } from "../candidate-normalization/normalize-application";
import { buildCandidateMetrics } from "../reports/build-candidate-metrics";
import { buildRecruiterSummary } from "../reports/build-recruiter-summary";
import { PDF_FAILURE_MESSAGE } from "../candidate-normalization/extract-markdown-cv";
import type { AiRunRecord } from "../pocketbase";
import { loadApplication } from "../pocketbase";
import { validateCandidate } from "../validation/validate-candidate";
import { canRunValidation, VALIDATION_SKIP_REASON } from "./can-run-validation";
import {
  storeEvaluationReport,
  storeNormalization,
  storeValidation,
  syncApplicationAiScores,
  updateAiRun,
} from "./store-artifacts";

export async function processEvaluationRun(
  pb: PocketBase,
  runId: string,
): Promise<{ runId: string; status: string }> {
  const run = await pb.collection("application_ai_runs").getOne<AiRunRecord>(runId);
  const applicationId = run.application;

  if (run.status !== "requested") {
    return { runId, status: run.status };
  }

  const startedAt = new Date().toISOString();
  await updateAiRun(pb, runId, {
    status: "running",
    started_at: startedAt,
    error_message: "",
  });

  try {
    if (run.run_type === "github_evidence") {
      throw new Error("github_evidence runs are not implemented yet (Phase 3)");
    }

    const { job, normalized } = await normalizeApplication({ pb, applicationId });
    const normStatus = normalized.cv.extractionStatus === "success" ? "complete" : "failed";
    const normRecord = await storeNormalization(pb, {
      applicationId,
      jobId: job.jobId,
      normalized,
      status: normStatus,
      errorMessage:
        normStatus === "failed" ? normalized.cv.extractionWarnings[0] ?? PDF_FAILURE_MESSAGE : "",
    });

    if (!canRunValidation(normalized)) {
      await storeValidation(pb, {
        applicationId,
        jobId: job.jobId,
        normalizationId: normRecord.id,
        status: "skipped",
        errorMessage: VALIDATION_SKIP_REASON,
        summary: VALIDATION_SKIP_REASON,
      });

      const metrics = buildCandidateMetrics({
        cvMetrics: {
          requiredSkillsScore: 0,
          niceToHaveSkillsScore: 0,
          evidenceCoverageScore: 0,
          applicationCompletenessScore: 0,
          overallCvFitScore: 0,
          requiredSkillsMatched: 0,
          requiredSkillsTotal: job.requiredSkills.length,
          niceToHaveSkillsMatched: 0,
          niceToHaveSkillsTotal: job.niceToHaveSkills.length,
          confidence: "low",
        },
        normalized,
        job,
      });

      const reportMd = buildRecruiterSummary({
        application: normalized,
        job,
        cvMetrics: {
          requiredSkillsScore: 0,
          niceToHaveSkillsScore: 0,
          evidenceCoverageScore: 0,
          applicationCompletenessScore: 0,
          overallCvFitScore: 0,
          requiredSkillsMatched: 0,
          requiredSkillsTotal: job.requiredSkills.length,
          niceToHaveSkillsMatched: 0,
          niceToHaveSkillsTotal: job.niceToHaveSkills.length,
          confidence: "low",
        },
        candidateMetrics: metrics,
      });

      await storeEvaluationReport(pb, {
        applicationId,
        status: "partial",
        metrics,
        reportMd,
      });

      await syncApplicationAiScores(pb, {
        applicationId,
        cvFitScore: metrics.cvFitScore,
        requiredSkillsScore: metrics.requiredSkillsScore,
        niceToHaveScore: metrics.niceToHaveSkillsScore,
      });

      await updateAiRun(pb, runId, {
        status: "complete",
        completed_at: new Date().toISOString(),
        metadata: { normalizationId: normRecord.id, validationSkipped: true },
      });

      return { runId, status: "complete" };
    }

    const config = requireAiConfig();
    const validation = await validateCandidate({ config, job, application: normalized });

    const valRecord = await storeValidation(pb, {
      applicationId,
      jobId: job.jobId,
      normalizationId: normRecord.id,
      status: "complete",
      model: validation.model,
      rawModelOutput: parseRawModelOutput(validation.rawModelOutput),
      parsedOutput: validation.parsedOutput,
      metrics: validation.metrics,
      summary: validation.parsedOutput.candidateSummary,
      recruiterReportMd: validation.parsedOutput.overall.recruiterSummary,
    });

    const candidateMetrics = buildCandidateMetrics({
      cvMetrics: validation.metrics,
      normalized,
      job,
    });

    const reportMd = buildRecruiterSummary({
      application: normalized,
      job,
      validation: validation.parsedOutput,
      cvMetrics: validation.metrics,
      candidateMetrics,
      provider: validation.provider,
      model: validation.model,
    });

    await storeEvaluationReport(pb, {
      applicationId,
      validationId: valRecord.id,
      status: "complete",
      metrics: candidateMetrics,
      reportMd,
    });

    await syncApplicationAiScores(pb, {
      applicationId,
      cvFitScore: candidateMetrics.cvFitScore,
      requiredSkillsScore: candidateMetrics.requiredSkillsScore,
      niceToHaveScore: candidateMetrics.niceToHaveSkillsScore,
    });

    await updateAiRun(pb, runId, {
      status: "complete",
      completed_at: new Date().toISOString(),
      metadata: {
        normalizationId: normRecord.id,
        validationId: valRecord.id,
        provider: validation.provider,
        model: validation.model,
      },
    });

    return { runId, status: "complete" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateAiRun(pb, runId, {
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: message.slice(0, 2000),
    });
    throw error;
  }
}

function parseRawModelOutput(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return { text: raw };
  }
}

export async function createEvaluationRun(
  pb: PocketBase,
  input: {
    applicationId: string;
    startedByUserId: string;
    runType?: "cv_validation" | "full_evaluation";
  },
): Promise<string> {
  await loadApplication(pb, input.applicationId);
  const record = await pb.collection("application_ai_runs").create({
    application: input.applicationId,
    run_type: input.runType ?? "cv_validation",
    status: "requested",
    started_by: input.startedByUserId,
    started_at: new Date().toISOString(),
    metadata: { source: "api" },
  });
  return record.id;
}
