import type { APIRoute } from "astro";
import type { RecordModel } from "pocketbase";

import {
  buildDuplicateKey,
  createEmailLog,
  findApplicationByDuplicateKey,
  hasSuccessfulConfirmationEmail,
} from "../../../lib/applications";
import { normalizeSubmissionIp, resolveIpLocationLabel } from "../../../lib/ip-geolocation";
import { getPublicPocketBase, getSubmissionServicePocketBase } from "../../../lib/pocketbase";
import { isRateLimited } from "../../../lib/rate-limit";
import { sendApplicationReceivedEmail } from "../../../lib/resend";
import { sanitizeErrorMessage } from "../../../lib/sanitize";
import { isSuspiciousSubmission } from "../../../lib/spam";
import { getMaxCvSizeBytes, validateApplicationFormData } from "../../../lib/validation";

type JobRecord = RecordModel & {
  id: string;
  slug: string;
  title: string;
  status: string;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function getClientIp(request: Request, clientAddress: string | undefined): string {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return clientAddress || "unknown";
}

async function findPublishedJobBySlug(slug: string): Promise<JobRecord | null> {
  const pb = getPublicPocketBase();

  try {
    return await pb.collection("jobs").getFirstListItem<JobRecord>(
      `slug = "${slug.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}" && status = "published"`,
    );
  } catch (error) {
    if (typeof error === "object" && error !== null && "status" in error && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const maxCvSizeBytes = getMaxCvSizeBytes();

  try {
    const formData = await request.formData();
    const ipAddress = getClientIp(request, clientAddress);

    // Count every POST toward the limit before spam short-circuit (otherwise bad signatures bypass rate limiting).
    if (isRateLimited(ipAddress)) {
      console.warn(`Application submission rate limited for IP ${ipAddress}`);
      return json({ ok: true });
    }

    const jobSlug = String(formData.get("job_slug") ?? "").trim();

    if (!jobSlug) {
      console.warn("Application submission validation failure: missing job_slug");
      return json({
        ok: false,
        error: "VALIDATION_ERROR",
        message: "Please check the form and try again.",
        fields: {
          job_slug: "This role is no longer accepting applications.",
        },
      }, 400);
    }

    if (isSuspiciousSubmission(jobSlug, formData)) {
      console.info(`Application submission treated as spam for job ${jobSlug}`);
      return json({ ok: true });
    }

    const job = await findPublishedJobBySlug(jobSlug);

    if (!job) {
      console.warn(`Application submission validation failure: invalid job slug ${jobSlug}`);
      return json({
        ok: false,
        error: "VALIDATION_ERROR",
        message: "Please check the form and try again.",
        fields: {
          job_slug: "This role is no longer accepting applications.",
        },
      }, 400);
    }

    const validated = validateApplicationFormData(formData, maxCvSizeBytes);

    if (!validated.success || !validated.data) {
      console.warn(`Application submission validation failure for job ${job.slug}`);
      return json({
        ok: false,
        error: "VALIDATION_ERROR",
        message: "Please check the form and try again.",
        fields: validated.fields ?? {},
      }, 400);
    }

    const pb = await getSubmissionServicePocketBase();
    const duplicateKey = buildDuplicateKey(validated.data.email, job.id);

    const submissionIp = normalizeSubmissionIp(ipAddress);
    const submissionIpLocation = (await resolveIpLocationLabel(submissionIp)) ?? "";

    let application = null;
    let createdNewApplication = false;

    try {
      const recordData = new FormData();
      recordData.set("job", job.id);
      recordData.set("full_name", validated.data.full_name);
      recordData.set("email", validated.data.email);
      recordData.set("phone_number", validated.data.phone_number);
      recordData.set("location", validated.data.location);
      recordData.set("timezone", validated.data.timezone);
      recordData.set("github_url", validated.data.github_url);
      recordData.set("portfolio_url", validated.data.portfolio_url);
      recordData.set("linkedin_url", validated.data.linkedin_url);
      recordData.set("anything_else", validated.data.anything_else);
      recordData.set("cv_file", validated.data.cvFile);
      recordData.set("status", "new");
      recordData.set("duplicate_key", duplicateKey);
      recordData.set("consent_to_store_data", "true");
      recordData.set("source", "website");
      recordData.set("user_agent", (request.headers.get("user-agent") ?? "").slice(0, 500));
      recordData.set("submission_ip", submissionIp);
      recordData.set("submission_ip_location", submissionIpLocation);
      recordData.set("submitted_at", new Date().toISOString());

      application = await pb.collection("applications").create(recordData);
      createdNewApplication = true;
    } catch (error) {
      application = await findApplicationByDuplicateKey(pb, duplicateKey);

      if (!application) {
        throw error;
      }
    }

    if (!application) {
      throw new Error("Application record was not available after submission.");
    }

    let shouldSendConfirmation = true;

    if (!createdNewApplication) {
      shouldSendConfirmation = !(await hasSuccessfulConfirmationEmail(pb, application.id));
    }

    if (shouldSendConfirmation) {
      try {
        const providerMessageId = await sendApplicationReceivedEmail({
          to: validated.data.email,
          fullName: validated.data.full_name,
          jobTitle: job.title,
        });

        await createEmailLog(pb, {
          applicationId: application.id,
          recipient: validated.data.email,
          status: "sent",
          providerMessageId,
        });

        console.info(`Application email sent for job ${job.slug} and application ${application.id}`);
      } catch (error) {
        const sanitizedError = sanitizeErrorMessage(error);

        console.error(`Application email failed for application ${application.id}: ${sanitizedError}`);

        try {
          await createEmailLog(pb, {
            applicationId: application.id,
            recipient: validated.data.email,
            status: "failed",
            errorMessage: sanitizedError,
          });
        } catch (logError) {
          console.error(
            `Application email log creation failed for application ${application.id}: ${sanitizeErrorMessage(logError)}`,
          );
        }
      }
    }

    console.info(
      `Application submission success for job ${job.slug} (${createdNewApplication ? "created" : "duplicate"})`,
    );

    return json({ ok: true });
  } catch (error) {
    console.error(`Application submission server error: ${sanitizeErrorMessage(error)}`);
    return json({
      ok: false,
      error: "SERVER_ERROR",
      message: "Something went wrong. Please try again.",
    }, 500);
  }
};
