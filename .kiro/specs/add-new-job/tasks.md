# Implementation Plan: Add New Job

## Overview

Implement job creation for admin-level recruiters in the recruiter portal. The approach extracts shared validation logic, creates a new form page and API action, and wires a "New job" button into the existing jobs list. All patterns follow the established `job-update.ts` action style — server-rendered Astro pages, redirect-based feedback, and CSRF protection.

## Tasks

- [x] 1. Create shared validation module
  - [x] 1.1 Create `apps/web/src/lib/job-validation.ts` with `validateJobFields` function
    - Export `JobFieldsInput` interface and `ValidationError` type
    - Implement title validation: non-empty, max 200 chars
    - Implement slug validation: non-empty, max 120 chars, pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$`
    - Implement summary validation: non-empty, max 1000 chars
    - Implement description validation: non-empty
    - Implement work model validation: must be one of `remote`, `hybrid`, `onsite`
    - Implement employment type validation: must be one of `full_time`, `part_time`, `contract`, `internship`
    - Return specific error code (`"fields"`, `"slug"`, `"work_model"`, `"employment_type"`) or `null` if valid
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 1.2 Write property tests for validation module
    - Install `fast-check` as a dev dependency
    - Create `apps/web/src/lib/job-validation.test.ts`
    - **Property 1: Title validation** — for any string, accepted iff non-empty and length ≤ 200
    - **Property 2: Slug validation** — for any string, accepted iff non-empty, length ≤ 120, and matches pattern
    - **Property 3: Summary validation** — for any string, accepted iff non-empty and length ≤ 1000
    - **Property 4: Enum field validation** — for any string, work model accepted iff in allowed set; same for employment type
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.6**

  - [ ]* 1.3 Write unit tests for payload assembly
    - Add tests to `apps/web/src/lib/job-validation.test.ts`
    - **Property 5: Payload assembly defaults and status** — for any valid required fields and random optional field presence, status is always `"draft"` and omitted optional fields default to `""`
    - **Validates: Requirements 4.1, 4.4**

- [x] 2. Implement job create API action
  - [x] 2.1 Create `apps/web/src/pages/recruiter/actions/job-create.ts`
    - Export `POST` APIRoute handler with `prerender = false`
    - Parse form data with try/catch, redirect to `/recruiter/jobs/new?error=form` on failure
    - Verify CSRF token using `verifySessionCsrf`, redirect to `/recruiter/login?error=csrf` on failure
    - Verify session exists, redirect to login if not
    - Verify `session.user.role === "admin"`, redirect to `/recruiter/jobs?error=forbidden` if not
    - Extract and trim all form fields
    - Call `validateJobFields` and redirect to `/recruiter/jobs/new?error={code}` with preserved field values on failure
    - Assemble payload with `status: "draft"` and empty string defaults for optional fields
    - Call `pb.collection("jobs").create(payload)`
    - On success, redirect to `/recruiter/jobs/{newRecord.id}?created=1`
    - On PocketBase error, redirect to `/recruiter/jobs/new?error=create` with preserved values
    - _Requirements: 1.1, 1.2, 3.7, 4.1, 4.2, 4.3, 4.4_

  - [ ]* 2.2 Write unit tests for job-create action error paths
    - Test CSRF failure redirects to login
    - Test non-admin redirects with forbidden
    - Test validation errors redirect with correct error codes
    - _Requirements: 1.1, 3.7, 4.3_

- [x] 3. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create the job creation form page
  - [x] 4.1 Create `apps/web/src/pages/recruiter/jobs/new.astro`
    - Add frontmatter with `prerender = false`
    - Check `session.user.role === "admin"`, redirect to `/recruiter/jobs?error=forbidden` if not
    - Read query params for error code and previously submitted field values
    - Use `RecruiterLayout` as wrapper
    - Include back link labeled "Jobs" linking to `/recruiter/jobs`
    - Render form with `action="/recruiter/actions/job-create"` and `method="POST"` with `enctype="multipart/form-data"`
    - Include hidden CSRF token field
    - Add title input (text, required, maxlength 200)
    - Add slug input (text, required, maxlength 120)
    - Add summary textarea (required, maxlength 1000)
    - Add description textarea (required)
    - Add work model select with options: remote, hybrid, onsite (required)
    - Add employment type select with options: full_time, part_time, contract, internship (required)
    - Add work location input (text, optional)
    - Add required skills textarea (optional, placeholder "One skill per line")
    - Add nice-to-have skills textarea (optional, placeholder "One skill per line")
    - Add what to expect textarea (optional)
    - Add hiring process textarea (optional)
    - Mark required fields with visible asterisk
    - Add submit button labeled "Create job"
    - Display error message from `recruiterJobNewErrors` if error query param present
    - Repopulate fields from query params on validation error redirect
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 5.2_

- [x] 5. Update jobs list page and flash messages
  - [x] 5.1 Add "New job" button to `apps/web/src/pages/recruiter/jobs/index.astro`
    - Import user role from session
    - Conditionally render a "New job" link/button above the jobs list when `session.user.role === "admin"`
    - Style consistently with existing buttons (use `btn-primary btn-sm`)
    - Link to `/recruiter/jobs/new`
    - _Requirements: 1.3, 1.4, 5.1, 5.3_

  - [x] 5.2 Update `apps/web/src/lib/recruiter-flash.ts` with new error/success messages
    - Add `recruiterJobNewErrors` record with keys: `form`, `forbidden`, `fields`, `slug`, `create`
    - Add `created` key to `recruiterJobDetailErrors` or handle `?created=1` as success on detail page
    - _Requirements: 4.2, 4.3_

- [x] 6. Refactor job-update action to use shared validation
  - [x] 6.1 Update `apps/web/src/pages/recruiter/actions/job-update.ts` to use `validateJobFields`
    - Import `validateJobFields` from `../../lib/job-validation`
    - Replace inline validation logic with call to shared function
    - Ensure existing behavior is preserved (same redirect URLs and error codes)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 7. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The validation module is extracted first so both the create and update actions can share it
- Field preservation on error uses query params, consistent with existing patterns

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.1"] },
    { "id": 2, "tasks": ["2.2", "4.1", "6.1"] },
    { "id": 3, "tasks": ["5.1", "5.2"] }
  ]
}
```
