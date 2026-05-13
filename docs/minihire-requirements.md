# Requirements v2: minihire

## 1. Overview

Build minihire: a small hiring site for publishing job openings and receiving applications.

Version 1 is intentionally narrow in scope. It must remain small, maintainable, and suitable for a single operator or very small team.

The system must provide:

- A public jobs website.
- A public application form for each published job.
- CV upload in PDF or Markdown format.
- Automatic confirmation email after submission.
- A private admin workflow using PocketBase Admin UI.
- Application status management.
- Internal notes per application.

Version 1 is not a full ATS and must not grow into one.

---

## 2. Core Decisions

### 2.1 Required Stack

| Layer | Technology |
|---|---|
| Public frontend | Astro |
| Backend | PocketBase |
| Database | PocketBase embedded SQLite |
| File storage | PocketBase file storage |
| Admin interface | PocketBase Admin UI |
| Email provider | Resend |
| Styling | Tailwind CSS |
| Language | TypeScript |
| Package manager | pnpm |
| Deployment | Single Linux VM or containerized deployment |

### 2.2 Explicit Constraints

- Do not use Supabase, Firebase, Airtable, Directus, or a custom PostgreSQL backend.
- Do not build a custom admin dashboard in version 1.
- Use PocketBase Admin UI as the only admin interface in version 1.

### 2.3 Trusted Server Model

Version 1 uses Astro as a trusted server-side application.

- The browser must never talk directly to PocketBase for application creation.
- The browser must never receive PocketBase admin credentials.
- The Astro server may use server-only PocketBase admin credentials to create applications, upload files, and write email logs.
- This is an accepted version 1 tradeoff. A narrower-privilege service account model may be added later, but is not required now.

---

## 3. Scope

### 3.1 In Scope

Version 1 must include:

- Public homepage.
- Public jobs index.
- Public job detail page.
- Public application form for each published job.
- CV upload.
- Form validation.
- Duplicate application handling.
- Confirmation email.
- Thank-you page.
- PocketBase collections and access rules.
- PocketBase Admin UI workflow for reviewing candidates.
- Application status field.
- Internal notes collection.
- Email delivery log collection.
- Basic spam protection.
- Production deployment instructions.
- Backup instructions and backup script.

### 3.2 Out of Scope

Version 1 must not include:

- AI ranking, filtering, summarization, or rejection.
- Resume parsing.
- Interview scheduling.
- Calendar integration.
- Candidate login or candidate portal.
- Multi-company or multi-tenant support.
- Custom admin dashboard.
- Job board syndication.
- Bulk email campaigns.
- Analytics dashboard.
- OAuth login.
- Complex role hierarchy.
- Third-party ATS sync.

---

## 4. High-Level Architecture

```text
Astro public website
  ├── homepage
  ├── jobs index
  ├── job detail page
  ├── application form page
  ├── success page
  └── server endpoint for application submission

PocketBase
  ├── jobs collection
  ├── applications collection
  ├── application_notes collection
  ├── email_logs collection
  ├── file storage
  └── built-in admin UI

Resend
  └── confirmation email delivery
```

Data flow:

1. Public pages read published jobs from PocketBase.
2. Candidate submits form to an Astro server endpoint.
3. Astro validates, filters spam, writes the application to PocketBase, sends confirmation email, and records the email attempt.
4. Admin reviews applications in PocketBase Admin UI.

---

## 5. User Roles

### 5.1 Anonymous Visitor

An anonymous visitor can:

- View published job listings.
- View a published job detail page.
- Submit an application to a published job.
- Upload one CV file.
- Receive a confirmation email.

An anonymous visitor cannot:

- View draft or archived jobs.
- View any application record.
- View any uploaded CV.
- Edit an application after submission.
- Access admin data.

### 5.2 Admin

An admin can:

- Log into PocketBase Admin UI.
- Create, edit, publish, and archive jobs.
- View submitted applications.
- Download CV files.
- Update application status.
- Add internal notes.
- View confirmation email logs.
- Export data manually from PocketBase if needed.

Admin accounts must be created directly in PocketBase.

### 5.3 Job Authoring and Admin Workflow

Version 1 job authoring happens in PocketBase Admin UI.

- No custom job editor in Astro is in scope.
- No custom admin dashboard is in scope.

The admin job-authoring workflow is:

1. Create or edit a record in the `jobs` collection from PocketBase Admin UI.
2. Enter job content into the defined `jobs` fields, including `title`, `slug`, `summary`, `description`, `whatToExpect`, `workModel`, `workLocation`, `employmentType`, optional skill-list fields, and optional `hiringProcess`.
3. Save the job as `draft` while preparing or revising content.
4. Change `status` to `published` when the job is ready to appear publicly.
5. Ensure `publishedAt` is set when a job is first published.
6. Change `status` to `archived` when the job should no longer appear publicly.

Behavior requirements:

- Draft jobs must not appear on public job routes.
- Published jobs must appear on public job routes according to the rendering rules in section 6.
- Archived jobs must stop appearing on public job routes.
- `summary` is the short listing copy shown on the public jobs index; `description` is the full job post shown on the public job detail page.
- Job description content must be authored in `description` as raw Markdown.
- Hiring-process content, if present, must be authored in `hiringProcess` as raw Markdown.
- The PocketBase Admin UI is the only admin content-entry interface required for version 1.

---

## 6. Rendering Strategy and Routes

### 6.1 Rendering Strategy

To avoid stale published jobs, rendering behavior is mandatory:

- `/` may be static.
- `/privacy` may be static.
- `/jobs` must be request-time rendered, or use an equivalent strategy that reflects newly published or archived jobs without requiring a full rebuild.
- `/jobs/[slug]` must be request-time rendered, or use an equivalent strategy that reflects publication changes without requiring a full rebuild.
- `/jobs/[slug]/apply` must be request-time rendered because it depends on live job state and server-issued anti-spam fields.
- `/jobs/[slug]/apply/success` may be static or request-time rendered.

### 6.2 Public Routes

The Astro app must implement:

```text
/
/jobs
/jobs/[slug]
/jobs/[slug]/apply
/jobs/[slug]/apply/success
/privacy
```

Route behavior:

- `/` shows a short intro and links to open jobs.
- `/jobs` lists all jobs where `status = "published"`.
- `/jobs/[slug]` shows one published job; draft or archived jobs return 404.
- `/jobs/[slug]/apply` shows the application form for one published job; draft or archived jobs return 404.
- `/jobs/[slug]/apply/success` shows a generic confirmation page and must expose no private candidate data.
- `/privacy` explains collection, use, retention, deletion requests, and contact information.

---

## 7. Public Page Requirements

### 7.1 Homepage

The homepage must include:

- Site title.
- Short explanation of the hiring process.
- Link to open jobs.
- Link to privacy page.

### 7.2 Jobs Index Page

The jobs index page must:

- Fetch published jobs from PocketBase.
- Show job title.
- Show short description.
- Show location mode.
- Link to the job detail page.
- Show a friendly empty state when there are no published jobs.

Jobs must be sorted by `publishedAt` descending, with newer jobs first.

### 7.3 Job Detail Page

The job detail page must show:

- Job title.
- Location mode.
- Employment type.
- Job description rendered from Markdown.
- Required skills, if present.
- Nice-to-have skills, if present.
- Hiring process, if present.
- Apply button.

The Apply button must link to `/jobs/[slug]/apply`.

If `requiredSkills`, `niceToHaveSkills`, `whatToExpect`, or `hiringProcess` are empty, the corresponding section must be hidden rather than rendering an empty heading or placeholder.

The page must include this note:

> Because we are a small team, we may not be able to respond personally to every application.

### 7.4 Application Form Page

The public application form must include the following candidate-editable fields:

- `full_name`
- `email`
- `phone_number`
- `location`
- `timezone`
- `github_url`
- `portfolio_url`
- `linkedin_url`
- `anything_else`
- `cv_file`
- `consent_to_store_data`

The form must also include hidden fields for:

- `job_slug`
- anti-spam fields defined in section 16

The public form must not expose or allow direct editing of system-managed fields such as `status`, `duplicate_key`, `source`, `user_agent`, or `submitted_at`.

The form must:

- Validate required fields before submission.
- Show clear validation messages next to relevant fields.
- Disable the submit button while submitting.
- Prevent accidental double submission.
- Upload the CV file as multipart form data.
- Submit to the Astro server endpoint, not directly to PocketBase.
- Redirect to the success page on any accepted submission outcome.

Accepted submission outcomes are:

- Normal valid submission.
- Duplicate submission.
- Spam-filtered submission.
- Rate-limited submission.

If validation fails, the form must stay on the page and show a friendly error message.

The form must not require account creation.

### 7.5 Success Page

The success page must say:

```text
Thank you. Your application has been received.
```

It must also say:

```text
Because we are a small team and may receive many applications, we may not be able to reply personally to every candidate. If your background looks like a strong match, we will contact you with next steps.
```

The success page must not include:

- Candidate email address.
- CV filename.
- Application ID.
- Job-internal IDs.
- Any other private data.

---

## 8. PocketBase Collections

The following collections are required:

```text
jobs
applications
application_notes
email_logs
```

The repository must include PocketBase migrations that create all required collections, indexes, and access rules from a clean checkout.

---

## 9. Collection: jobs

### 9.1 Purpose

Stores job openings.

### 9.2 Type

Base collection.

### 9.3 Fields

| Field | Type | Required | Notes |
|---|---:|---:|---|
| slug | text | yes | Unique, URL-safe slug |
| title | text | yes | Job title |
| summary | text | yes | Short listing copy used on jobs index |
| description | text | yes | Full description in raw Markdown |
| whatToExpect | text | no | Optional benefits, perks, or candidate-facing expectations in raw Markdown |
| workModel | select | yes | `remote`, `hybrid`, `onsite` |
| workLocation | text | no | Human-readable location |
| employmentType | select | yes | `full_time`, `part_time`, `contract`, `internship` |
| status | select | yes | `draft`, `published`, `archived` |
| requiredSkills | text | no | One skill per line |
| niceToHaveSkills | text | no | One skill per line |
| hiringProcess | text | no | Optional hiring-process description in raw Markdown |
| publishedAt | date | no | Required when `status = "published"` |
| created | auto date | yes | PocketBase system field |
| updated | auto date | yes | PocketBase system field |

### 9.4 Skill Field Format

The `requiredSkills` and `niceToHaveSkills` fields must be entered as plain text in PocketBase Admin UI, with one skill per line.

Rendering behavior:

- Split values on newlines.
- Trim whitespace for each line.
- Ignore empty lines.
- Render the resulting values as lists on the public job page.

This format is required for version 1 because it is easier for admins to edit than raw JSON while remaining easy to parse later.

### 9.5 Indexes

- Unique index on `slug`.
- Index on `status`.
- Index on `publishedAt`.

### 9.6 Rules

Public list rule:

```text
status = "published"
```

Public view rule:

```text
status = "published"
```

Public create, update, delete:

```text
deny
```

Admin access is allowed through PocketBase Admin UI.

### 9.7 Publishing Rule

When a job is first published:

- `status` must be set to `published`.
- `publishedAt` must be set if empty.

When a job is archived:

- It must stop appearing on public routes immediately.

When an archived job is republished:

- `status` must be set back to `published`.
- The existing `publishedAt` value must not be overwritten automatically.
- The job must become visible on public routes again immediately.

---

## 10. Collection: applications

### 10.1 Purpose

Stores submitted applications.

### 10.2 Type

Base collection.

### 10.3 Fields

| Field | Type | Required | Notes |
|---|---:|---:|---|
| job | relation | yes | Relation to `jobs`, max select 1 |
| full_name | text | yes | Candidate full name |
| email | email | yes | Candidate email |
| phone_number | text | no | Candidate phone number |
| location | text | no | Candidate location |
| timezone | text | no | Candidate timezone |
| github_url | url | no | GitHub profile or project |
| portfolio_url | url | no | Portfolio or personal site |
| linkedin_url | url | no | LinkedIn URL |
| anything_else | text | no | Optional additional note from the candidate |
| cv_file | file | yes | Exactly one file |
| status | select | yes | Review status |
| duplicate_key | text | yes | `lowercase(trim(email)) + ":" + job_id` |
| consent_to_store_data | bool | yes | Must be true |
| source | text | no | Optional source tag |
| user_agent | text | no | Optional sanitized request metadata |
| submitted_at | date | yes | Server-generated submission timestamp |
| created | auto date | yes | PocketBase system field |
| updated | auto date | yes | PocketBase system field |

### 10.4 Field Ownership

Public candidate-editable submission fields are:

- `full_name`
- `email`
- `phone_number`
- `location`
- `timezone`
- `github_url`
- `portfolio_url`
- `linkedin_url`
- `anything_else`
- `cv_file`
- `consent_to_store_data`

Request-only hidden fields are:

- `job_slug`
- anti-spam fields defined in section 16

System-managed or admin-managed fields are:

- `job`, resolved server-side from `job_slug`
- `status`, initialized server-side to `new`
- `duplicate_key`, computed server-side
- `source`, optional server-side metadata
- `user_agent`, optional server-side metadata
- `submitted_at`, generated server-side
- `created` and `updated`, managed by PocketBase

The public form and public API must not accept arbitrary client-controlled values for system-managed or admin-managed fields.

### 10.5 Status Values

The `status` field must allow only:

```text
new
reviewing
maybe
rejected
interview
offer
hired
withdrawn
```

New applications must always start with:

```text
new
```

Only admins may change the status after creation.

### 10.6 CV File Rules

The `cv_file` field must:

- Allow exactly one file.
- Allow only `.pdf`, `.md`, and `.markdown`.
- Reject all other file types.
- Enforce a maximum file size of 5 MB.
- Store files in PocketBase file storage.

The frontend must validate extension and size before submission.

The server must validate extension and size again before writing to PocketBase.

For version 1, required server-side file validation is:

- file extension validation
- maximum file size validation

Best-effort MIME type checking may be added, but full file-content inspection is not required in version 1.

### 10.7 Duplicate Handling

The system must prevent duplicate applications for the same job and email address.

Normalization rule:

```text
duplicate_key = lowercase(trim(email)) + ":" + job_id
```

Requirements:

- `duplicate_key` must have a unique index.
- The duplicate check must be enforced by the database, not only by frontend logic.
- The server must attempt creation once and treat a unique-index conflict as a duplicate submission.

Duplicate workflow:

1. Try to create the application record.
2. If creation succeeds, continue with normal email handling.
3. If creation fails because `duplicate_key` already exists, fetch the existing application with that same `duplicate_key`.
4. Check whether a successful `application_received` email log already exists for that application.
5. If a successful email log exists, do not resend the confirmation email.
6. If no successful email log exists, attempt to send the confirmation email and write a new `email_logs` entry for the attempt.
7. Return the same generic success response in either case.

The system must never reveal to the candidate that a duplicate application was detected.

### 10.8 Indexes

- Unique index on `duplicate_key`.
- Index on `job`.
- Index on `status`.
- Index on `submitted_at`.
- Index on `email`.

### 10.9 Rules

Public list and view:

```text
deny
```

Public create, update, delete:

```text
deny
```

Only the Astro server may create records on behalf of the public submission flow.

Admin access is allowed through PocketBase Admin UI.

### 10.10 Retention Basis

The `updated` system field is the retention reference for manual cleanup.

- `rejected` and `withdrawn` applications should be deleted 12 months after last update.
- Other non-hired applications with no activity for 12 months are considered inactive and should also be deleted.
- `hired` applications may follow the operator's employment-record policy and are outside the scope of this public-facing privacy policy.

---

## 11. Collection: application_notes

### 11.1 Purpose

Stores private admin notes about applications.

Notes are a separate collection so each note becomes a timestamped entry rather than a single overwritten field.

### 11.2 Type

Base collection.

### 11.3 Fields

| Field | Type | Required | Notes |
|---|---:|---:|---|
| application | relation | yes | Relation to `applications`, max select 1 |
| body | text | yes | Internal note text |
| created | auto date | yes | PocketBase system field |
| updated | auto date | yes | PocketBase system field |

### 11.4 Rules

Public list, view, create, update, delete:

```text
deny
```

Admin access is allowed through PocketBase Admin UI.

---

## 12. Collection: email_logs

### 12.1 Purpose

Stores confirmation email delivery attempts.

### 12.2 Type

Base collection.

### 12.3 Fields

| Field | Type | Required | Notes |
|---|---:|---:|---|
| application | relation | yes | Relation to `applications`, max select 1 |
| template | select | yes | `application_received` |
| recipient | email | yes | Candidate email |
| status | select | yes | `sent`, `failed` |
| provider | text | yes | Always `resend` |
| provider_message_id | text | no | Resend message ID |
| error_message | text | no | Sanitized provider error only |
| created | auto date | yes | PocketBase system field |
| updated | auto date | yes | PocketBase system field |

### 12.4 Rules

Public list, view, create, update, delete:

```text
deny
```

Admin access is allowed through PocketBase Admin UI.

---

## 13. Submission API

### 13.1 Endpoint

The public application submission must be handled by an Astro server endpoint:

```text
POST /api/applications/submit
```

The endpoint must accept multipart form data.

### 13.2 Required Behavior

The endpoint must:

1. Receive multipart form data.
2. Read the `job_slug` from the form payload.
3. Validate anti-spam fields before any write.
4. Fetch the job from PocketBase.
5. Confirm the job exists and `status = "published"`.
6. Validate all required candidate fields.
7. Validate email format.
8. Validate URL fields if present.
9. Validate that consent is true.
10. Validate that a CV file exists.
11. Validate CV extension.
12. Validate CV size.
13. Normalize and sanitize candidate fields.
14. Normalize email.
15. Compute `duplicate_key`.
16. Attempt to create the application in PocketBase.
17. Handle duplicate conflicts according to section 10.7.
18. Attempt to send the confirmation email if required.
19. Write an `email_logs` record for every email attempt.
20. Return a generic success response for accepted submissions.

### 13.3 Success and Error Semantics

There are three response classes:

1. Validation error.
2. Generic accepted success.
3. Unexpected server error.

Validation failure response:

```json
{
  "ok": false,
  "error": "VALIDATION_ERROR",
  "message": "Please check the form and try again.",
  "fields": {
    "email": "Enter a valid email address."
  }
}
```

Generic accepted success response:

```json
{
  "ok": true
}
```

Unexpected server failure response:

```json
{
  "ok": false,
  "error": "SERVER_ERROR",
  "message": "Something went wrong. Please try again."
}
```

### 13.4 Redirect Behavior

On any generic accepted success response, the frontend must redirect to:

```text
/jobs/[slug]/apply/success
```

This includes:

- Normal valid submissions.
- Duplicate submissions.
- Honeypot-triggered submissions.
- Too-fast submissions.
- Rate-limited submissions.

### 13.5 Security Behavior

The endpoint must not expose:

- Stack traces.
- PocketBase errors.
- Resend provider errors.
- Duplicate-detection details.
- Spam-detection details.

Candidate-facing behavior must remain generic.

---

## 14. Email Requirements

### 14.1 Provider

Use Resend.

### 14.2 Sender

The sender must be configured through environment variables.

Example:

```text
APPLICATION_EMAIL_FROM="Noam <jobs@example.com>"
```

### 14.3 Confirmation Email

Subject:

```text
Application received
```

Body:

```text
Hi {{full_name}},

Thank you for applying for the {{job_title}} role.

This email confirms that we received your application.

Because we are a small team and may receive a large number of applications, we may not be able to reply personally to every candidate. If your background looks like a strong match, we will contact you with next steps.

Thank you again for your interest.

Noam
```

Use the stored `full_name` directly. Do not require a separate `first_name` field.

### 14.4 Email Delivery Behavior

The confirmation email must be attempted after the application record exists or after a duplicate lookup determines that a resend is needed.

If email sending fails:

- The application must remain saved if it was newly created.
- The candidate must still receive the generic success flow.
- The failure must be logged in `email_logs`.
- Admin must be able to see the failed email log in PocketBase.

Submission must not fail solely because email delivery failed.

---

## 15. Validation Rules

### 15.1 Required Fields

The following are required:

- Job slug.
- Full name.
- Email.
- Why this role.
- Agent experience answer.
- CV file.
- Consent checkbox.

### 15.2 Field Limits

| Field | Limit |
|---|---:|
| full_name | 120 characters |
| email | 254 characters |
| phone_number | 40 characters |
| location | 120 characters |
| timezone | 80 characters |
| github_url | 300 characters |
| portfolio_url | 300 characters |
| linkedin_url | 300 characters |
| anything_else | 2,000 characters |
| cv_file | 5 MB |

### 15.3 Sanitization

The system must:

- Trim leading and trailing whitespace.
- Collapse repeated internal whitespace in short text fields.
- Preserve long-answer content as plain text.
- Never render candidate-provided text as HTML in public pages.
- Avoid logging CV content or long-answer content.
- Store only sanitized error details in logs.

---

## 16. Spam Protection

The application form must include:

- A hidden honeypot field.
- A minimum completion time check.
- Server-side rate limiting by IP address.

### 16.1 Honeypot

The form must include a hidden field named:

```text
company_website
```

If this field contains any value:

- Treat the submission as spam.
- Do not create an application.
- Do not send email.
- Return generic accepted success.

### 16.2 Minimum Completion Time

The minimum completion time is:

```text
4 seconds
```

The form must include two hidden fields generated by the server when the apply page is rendered:

- `form_started_at`
- `form_signature`

`form_signature` must be an HMAC or equivalent signed value derived from `form_started_at`, the job slug, and a server secret.

Server behavior:

- Reject any submission with a missing or invalid signature as suspicious.
- Reject any submission completed in under 4 seconds as suspicious.
- Suspicious submissions must return generic accepted success.
- Suspicious submissions must not create an application.
- Suspicious submissions must not send email.

This requirement makes the timer tamper-resistant enough for version 1.

### 16.3 Rate Limiting

The endpoint must rate limit by IP address.

Limit:

```text
5 submissions per IP per hour
```

If the rate limit is exceeded:

- Return generic accepted success.
- Do not create an application.
- Do not send email.

For version 1, an in-memory limiter is acceptable only if the app runs as a single server process.

If deployment later becomes multi-instance, the rate limiter must move to shared storage.

---

## 17. Privacy and Retention

The privacy page must state:

- What data is collected.
- That the data is used only to evaluate job applications.
- That CVs are stored in the application backend.
- That data is not sold.
- That data is not shared with advertisers.
- That application data may be deleted upon request.
- Contact email for deletion requests.
- Retention period.

Retention policy for public applicants:

- Rejected and withdrawn applications are retained for up to 12 months after last update.
- Other non-hired applications with no activity for 12 months are treated as inactive and should be deleted.
- The operator must manually review and delete expired records at least once per year.

The public privacy page does not need to define employment-record retention for hired candidates.

---

## 18. Security Requirements

The system must:

- Use HTTPS in production.
- Keep PocketBase Admin UI behind authentication.
- Not rely on `noindex` alone for admin protection.
- Disable public access to applications.
- Disable public access to notes.
- Disable public access to email logs.
- Prevent public listing or viewing of uploaded CV files.
- Use server-side application submission.
- Store API keys only in environment variables.
- Never expose PocketBase admin credentials to the browser.
- Never expose the Resend API key to the browser.
- Validate all uploaded files server-side.
- Return generic candidate-facing errors.
- Log only sanitized errors.

Public read access to `jobs` is allowed only when `status = "published"`.

If PocketBase is exposed on a public hostname, the deployment should also send `X-Robots-Tag: noindex, nofollow`, but authentication remains the primary protection.

---

## 19. Environment Variables

The app must use:

```text
PUBLIC_SITE_URL=
POCKETBASE_URL=
POCKETBASE_ADMIN_EMAIL=
POCKETBASE_ADMIN_PASSWORD=
RESEND_API_KEY=
APPLICATION_EMAIL_FROM=
APPLICATION_EMAIL_REPLY_TO=
MAX_CV_SIZE_BYTES=5242880
FORM_SIGNING_SECRET=
```

Rules:

- `POCKETBASE_ADMIN_EMAIL` and `POCKETBASE_ADMIN_PASSWORD` are server-only.
- `RESEND_API_KEY` is server-only.
- `FORM_SIGNING_SECRET` is server-only.
- No secret may be prefixed with `PUBLIC_`.

---

## 20. Project Structure

The project should use:

```text
minihire/
  apps/
    web/
      src/
        components/
          JobCard.astro
          ApplicationForm.astro
          MarkdownContent.astro
        layouts/
          BaseLayout.astro
        pages/
          index.astro
          jobs/
            index.astro
            [slug].astro
            [slug]/
              apply.astro
              apply/
                success.astro
          privacy.astro
          api/
            applications/
              submit.ts
        lib/
          pocketbase.ts
          resend.ts
          validation.ts
          rate-limit.ts
          sanitize.ts
          jobs.ts
          applications.ts
          spam.ts
        styles/
          global.css
      astro.config.mjs
      package.json
      tsconfig.json

  pocketbase/
    pb_migrations/
    pb_hooks/
    README.md

  docker/
    Dockerfile.web
    Dockerfile.pocketbase
    docker-compose.yml

  scripts/
    backup.sh

  README.md
  .env.example
  package.json
  pnpm-workspace.yaml
```

Equivalent structure is acceptable if responsibilities remain equally clear.

---

## 21. Frontend Design Requirements

The UI must be plain, fast, and accessible.

### 21.1 Visual Style

Use:

- White or near-white background.
- Dark text.
- Single accent color.
- Maximum reading width around 760px.
- Clear form labels.
- Large submit button.
- Minimal decoration.

### 21.2 Accessibility

The frontend must:

- Use semantic HTML.
- Associate every input with a visible label.
- Show validation messages near the relevant field.
- Expose validation messages to screen readers.
- Support keyboard-only navigation.
- Maintain sufficient color contrast.
- Avoid placeholder-only labels.

### 21.3 Performance

Public pages must:

- Load quickly.
- Avoid unnecessary client-side JavaScript.
- Prefer static rendering where content is truly static.
- Use minimal client-side code for the form.

---

## 22. Markdown Rendering

Job descriptions and hiring-process content are stored as Markdown.

The renderer must:

- Escape unsafe HTML.
- Prevent script injection.
- Support headings, paragraphs, lists, links, bold, italic, and code spans.
- Not execute raw HTML embedded in Markdown.

External links may open normally.

---

## 23. PocketBase Setup

The repository must include reproducible PocketBase setup.

Requirements:

- Migrations must create all required collections.
- Migrations must create indexes.
- Migrations must create access rules.
- Setup from a clean checkout must be documented.
- Seed instructions must explain how to create the first job.

---

## 24. Development Workflow

### 24.1 Local Development

Local development must run with:

```bash
pnpm install
pnpm dev
```

The local development environment must start:

- PocketBase
- Astro web app

A local `.env` file must be used for secrets.

The repository must include `.env.example`.

### 24.2 Required Scripts

Root `package.json` must expose equivalent commands for:

- `dev`
- `dev:web`
- `dev:pocketbase`
- `build`
- `preview`
- `lint`
- `typecheck`

Exact script strings may differ, but equivalent behavior is required.

---

## 25. Deployment Requirements

Production must run:

- One PocketBase instance.
- One Astro web server.
- One HTTPS reverse proxy.

Production must persist:

- PocketBase SQLite database.
- PocketBase uploaded files.

The production server must back up:

- `pb_data/data.db`
- `pb_data/storage`

Backups must be documented.

### 25.1 Recommended Layout

```text
/opt/minihire/
  web/
  pocketbase/
    pocketbase
    pb_data/
  backups/
  docker-compose.yml
  .env
```

### 25.2 Reverse Proxy

The Astro app must be exposed over HTTPS.

PocketBase may be exposed on a separate host such as `pb.example.com` or behind an internal reverse-proxy path.

If PocketBase is externally reachable:

- Admin authentication is mandatory.
- Search indexing must be disabled.
- Reverse-proxy restrictions such as allowlists or private-network exposure are recommended where feasible.

---

## 26. Backup Requirements

A backup script must be included.

The script must:

- Create a safe SQLite backup or otherwise avoid inconsistent writes.
- Copy the PocketBase database.
- Copy PocketBase storage files.
- Compress the backup.
- Store the backup with a timestamped filename.
- Keep at least the latest 14 daily backups.

Filename format:

```text
minihire-backup-YYYY-MM-DD-HH-mm.tar.gz
```

The README must explain backup restore steps.

---

## 27. Logging Requirements

The system must log:

- Application submission success.
- Validation failure.
- Email send success.
- Email send failure.
- Spam rejection.
- Rate-limit rejection.
- Unexpected server errors.

Logs must not include:

- Full CV contents.
- Full long-answer contents.
- Secret environment variables.
- PocketBase admin password.
- Resend API key.
- Unsanitized provider errors.

---

## 28. Error Handling

Candidate-facing messages must be generic and helpful.

Examples:

```text
Please check the form and try again.
```

```text
Something went wrong. Please try again.
```

The UI and API must not expose:

- Stack traces.
- Database errors.
- PocketBase admin errors.
- Resend provider errors.
- Duplicate-detection details.
- Spam-detection details.

Admin-visible logs may include sanitized technical details.

---

## 29. Acceptance Criteria

The implementation is complete when all of the following are true.

### 29.1 Public Job Pages

- A published job appears on `/jobs` without requiring a rebuild.
- A draft or archived job does not appear on `/jobs`.
- A published job detail page is accessible.
- A draft or archived job detail page returns 404.
- Job Markdown renders safely.
- Empty optional sections for skills or hiring process are hidden rather than rendered as empty blocks.
- Republishing an archived job makes it visible again without automatically overwriting the existing `publishedAt` value.

### 29.2 Application Form

- Candidate can submit a valid application.
- Candidate can upload a PDF CV.
- Candidate can upload a Markdown CV.
- Candidate cannot upload `.docx`.
- Candidate cannot upload files larger than 5 MB.
- Required fields show validation errors.
- Invalid email shows a validation error.
- Invalid URL shows a validation error.
- Missing consent blocks submission.
- Public form exposes only candidate-editable fields plus hidden `job_slug` and anti-spam fields.
- Public form does not expose system-managed fields such as `status`, `duplicate_key`, `source`, `user_agent`, or `submitted_at`.

### 29.3 Submission Flow

- Valid submission creates an `applications` record.
- Valid submission stores the CV file.
- Valid submission attempts a confirmation email.
- Valid submission creates an `email_logs` record for the email attempt.
- Valid accepted submission redirects to the success page.
- Duplicate submission does not create a second application.
- Duplicate submission still results in the same public success flow.
- Duplicate resend happens only when no successful prior confirmation email is logged.

### 29.4 Admin

- Admin can log into PocketBase.
- Admin can create, publish, and archive jobs.
- Admin can view applications.
- Admin can download CV files.
- Admin can update application status.
- Admin can add notes.
- Admin can view email logs.

### 29.5 Security

- Public users cannot list or view applications.
- Public users cannot view notes.
- Public users cannot view email logs.
- Public users cannot list or download CV files.
- Secret credentials are not exposed to the browser.

### 29.6 Spam Protection

- Honeypot submission does not create an application.
- Too-fast submission does not create an application.
- Submission with invalid anti-spam signature does not create an application.
- Rate-limited submission does not create an application.
- Spam and rate-limited submissions still return the same public success flow.

### 29.7 Deployment and Backup

- App runs behind HTTPS.
- PocketBase data persists across restarts.
- Uploaded files persist across restarts.
- Backup script produces restorable backups.

---

## 30. Recommended Implementation Order

1. Create Astro project structure.
2. Add Tailwind CSS.
3. Add PocketBase client wrapper.
4. Create PocketBase migrations for collections and rules.
5. Build jobs index page.
6. Build job detail page.
7. Build application form page.
8. Add validation helpers.
9. Add signed anti-spam fields.
10. Implement server-side submit endpoint.
11. Implement CV upload handling.
12. Implement duplicate handling.
13. Add Resend integration.
14. Add email log writing.
15. Add success page.
16. Add privacy page.
17. Add rate limiting.
18. Add Docker and deployment files.
19. Add backup script.
20. Add README setup, deployment, backup, and restore instructions.
21. Verify acceptance criteria.

---

## 31. Non-Goals

Do not implement:

- AI scoring.
- AI summarization.
- AI filtering.
- Custom admin dashboard.
- Candidate accounts.
- OAuth.
- Payment flows.
- Calendar scheduling.
- External job board publishing.
- Complex role-based permissions.
- Multi-tenant support.

---

## 32. Future Enhancements

These may be added later, but must not be implemented in version 1:

- Custom admin review UI.
- Candidate search.
- Bulk status updates.
- Additional email templates.
- CV text extraction.
- Application summaries.
- GitHub profile enrichment.
- Interview scheduling.
- CSV export.
- Automatic retention cleanup.

### 32.1 Phase 2 AI Readiness

If AI workflows are added in a later phase, they must be layered on top of version 1 rather than changing the core submission flow.

- The `applications` collection must remain the source of truth for raw candidate submissions.
- AI outputs should be stored in separate collection(s), such as a future `application_ai_reviews` collection, rather than adding required AI fields to `applications`.
- Future AI matching should use existing job requirement fields such as `requiredSkills` and `niceToHaveSkills`, which are stored as one-skill-per-line text and can be normalized into arrays, rather than relying only on free-text prompts.
- If candidate data is sent to an external AI provider in a later phase, the privacy policy and consent language must be updated before release.
- Any future AI grading, thresholding, or ranking should start as admin-visible recommendations, not automatic rejection or filtering.

---

## 33. Definition of Done

The project is done when:

- The app can be deployed from a clean checkout.
- The admin can create and publish a job.
- A candidate can apply to that job.
- The candidate receives a confirmation email when appropriate under the duplicate rules.
- The admin can view the application and CV in PocketBase.
- The admin can update the application status.
- Invalid, duplicate, spam, and oversized-file submissions are handled correctly.
- The README explains local development, deployment, backup, and restore.
