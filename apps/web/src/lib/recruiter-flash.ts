/** `?error=` codes on `/recruiter/applications` (list). */
export const recruiterApplicationsIndexErrors: Record<string, string> = {
  form: "The form could not be read. Please try again.",
  invalid: "That request was not valid.",
  notfound: "That application could not be found.",
};

/** `?error=` codes on `/recruiter/applications/[id]`. */
export const recruiterApplicationDetailErrors: Record<string, string> = {
  status: "Status could not be updated.",
  note: "Notes must be between 1 and 8,000 characters.",
  note_save: "The note could not be saved.",
  ai_run: "Could not queue AI evaluation. An evaluation may already be in progress.",
};

/** `?error=` codes on `/recruiter/jobs` (list). */
export const recruiterJobsIndexErrors: Record<string, string> = {
  form: "The form could not be read. Please try again.",
  forbidden: "Only administrators can change job postings.",
  invalid: "That request was not valid.",
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
