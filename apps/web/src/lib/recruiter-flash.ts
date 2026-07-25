/** `?error=` codes on `/recruiter/applications` (list). */
export const recruiterApplicationsIndexErrors: Record<string, string> = {
  form: "The form could not be read. Please try again.",
  invalid: "That request was not valid.",
  notfound: "That application could not be found.",
};

/** `?error=` codes on `/recruiter/applications/[id]`. */
export const recruiterApplicationDetailErrors: Record<string, string> = {
  star: "Could not update star.",
  email_send: "The email could not be sent.",
  status: "Status could not be updated.",
  note: "Notes must be between 1 and 8,000 characters.",
  note_save: "The note could not be saved.",
  ai_run: "Could not queue AI evaluation. An evaluation may already be in progress.",
  clarification_active: "A clarification request is already waiting for the candidate.",
  clarification_email:
    "The clarification request could not be emailed to the candidate. Please try again.",
};

/** `?error=` codes on `/recruiter/jobs` (list). */
export const recruiterJobsIndexErrors: Record<string, string> = {
  form: "The form could not be read. Please try again.",
  forbidden: "Only administrators can change job postings.",
  invalid: "That request was not valid.",
};

/** `?error=` codes on `/recruiter/jobs/new`. */
export const recruiterJobNewErrors: Record<string, string> = {
  form: "The form could not be read. Please try again.",
  forbidden: "Only administrators can create job postings.",
  fields: "Title (max 200 chars), summary (max 1,000 chars), and description are required. Please check those fields and try again.",
  slug: "Slug is required and may only contain lowercase letters, numbers, and hyphens between words (max 120 chars). Example: senior-frontend-engineer",
  work_model: "Please select a valid work model (remote, hybrid, or onsite).",
  employment_type: "Please select a valid employment type (full_time, part_time, contract, or internship).",
  slug_taken: "A job with this slug already exists. Please choose a different slug.",
  create: "The job could not be created due to a server error. Please try again or contact support.",
};

/** `?error=` codes on `/recruiter/jobs/[id]`. */
export const recruiterJobDetailErrors: Record<string, string> = {
  forbidden: "Only administrators can change job postings.",
  fields: "Title, summary (up to 1,000 characters), and description did not meet validation.",
  slug: "Slug may only use lowercase letters, numbers, and hyphens between words.",
  status: "That status value is not allowed.",
  date: "Published date could not be read.",
  update: "The job could not be saved. The slug might already be in use on another job.",
};

/** `?created=1` / `?updated=1` success messages on `/recruiter/jobs/[id]`. */
export const recruiterJobDetailSuccess: Record<string, string> = {
  created: "Job created as draft.",
  updated: "Job saved.",
};
