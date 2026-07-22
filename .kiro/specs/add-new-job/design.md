# Design Document: Add New Job

## Overview

This feature adds a job creation flow to the recruiter portal, allowing admin-level users to create new job postings without accessing the PocketBase Admin UI. It follows the existing patterns established by the job update action (`job-update.ts`), reusing the same validation rules, CSRF protection, and redirect-based feedback.

The implementation consists of three parts:
1. A new Astro page at `/recruiter/jobs/new` rendering the creation form (admin only)
2. A new API route action at `/recruiter/actions/job-create` handling form submission
3. A "New job" button on the jobs list page, conditionally rendered for admin users

## Architecture

The feature integrates into the existing server-rendered Astro architecture:

```mermaid
flowchart TD
    A[Jobs List Page] -->|Admin clicks 'New job'| B["/recruiter/jobs/new"]
    B -->|Admin fills form and submits| C["/recruiter/actions/job-create (POST)"]
    C -->|CSRF check| D{Valid CSRF?}
    D -->|No| E[Redirect /recruiter/login?error=csrf]
    D -->|Yes| F{Admin role?}
    F -->|No| G[Redirect /recruiter/jobs?error=forbidden]
    F -->|Yes| H{Fields valid?}
    H -->|No| I[Redirect /recruiter/jobs/new?error=...&fields preserved]
    H -->|Yes| J[PocketBase create jobs record]
    J -->|Success| K[Redirect /recruiter/jobs/{id}?created=1]
    J -->|Error| I
```

**Key architectural decisions:**
- **Server-side form handling** (no client-side JS required) — consistent with the existing job-update pattern
- **Redirect-based feedback** using query params (`?error=`, `?created=`) — matches existing flash message pattern in `recruiter-flash.ts`
- **Field preservation on error** — when validation fails, submitted values are preserved in the redirect URL so the form can be repopulated (using query params or session-based flash)
- **Status always "draft"** — new jobs start as drafts; publishing is a separate action on the detail page

## Components and Interfaces

### 1. Job Creation Form Page (`/recruiter/jobs/new`)

**File:** `apps/web/src/pages/recruiter/jobs/new.astro`

**Responsibilities:**
- Verify the current user has `role === "admin"` (redirect to jobs list with `?error=forbidden` otherwise)
- Render a form with all job fields
- Include hidden CSRF token
- Repopulate fields from query params when redirected back after validation error

**Interface:**
- **Input:** HTTP GET request from authenticated admin user
- **Output:** HTML page with form, or redirect (303) for non-admin users

### 2. Job Create Action (`/recruiter/actions/job-create`)

**File:** `apps/web/src/pages/recruiter/actions/job-create.ts`

**Responsibilities:**
- Parse multipart form data
- Verify CSRF token
- Verify admin role
- Validate all required fields
- Assemble payload with defaults for optional fields
- Call PocketBase SDK to create the record
- Redirect to job detail page on success, or back to form with error on failure

**Interface:**
```typescript
// POST /recruiter/actions/job-create
// Content-Type: multipart/form-data
//
// Fields:
//   csrf: string (required)
//   title: string (required, 1-200 chars)
//   slug: string (required, 1-120 chars, pattern: [a-z0-9]+(?:-[a-z0-9]+)*)
//   summary: string (required, 1-1000 chars)
//   description: string (required, non-empty)
//   work_model: "remote" | "hybrid" | "onsite" (required)
//   employment_type: "full_time" | "part_time" | "contract" | "internship" (required)
//   work_location: string (optional)
//   required_skills: string (optional, newline-separated)
//   nice_to_have_skills: string (optional, newline-separated)
//   what_to_expect: string (optional)
//   hiring_process: string (optional)
```

### 3. Validation Module

**File:** `apps/web/src/lib/job-validation.ts`

A shared module extracting field validation logic so it can be reused between the create and update actions, and tested independently.

```typescript
export interface JobFieldsInput {
  title: string;
  slug: string;
  summary: string;
  description: string;
  workModel: string;
  employmentType: string;
}

export type ValidationError = "fields" | "slug" | "work_model" | "employment_type";

/** Returns null if valid, or an error code if invalid. */
export function validateJobFields(input: JobFieldsInput): ValidationError | null;
```

### 4. Jobs List Page Update

**File:** `apps/web/src/pages/recruiter/jobs/index.astro` (modification)

**Change:** Add a conditional "New job" button/link visible only when `user.role === "admin"`.

### 5. Flash Messages Update

**File:** `apps/web/src/lib/recruiter-flash.ts` (modification)

**Change:** Add error messages for the job creation form page and a `created` success indicator on the job detail page.

## Data Models

### PocketBase `jobs` Collection Fields

The feature writes to the existing `jobs` collection. Based on the codebase, the schema includes:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `title` | text | yes | max 200 chars |
| `slug` | text | yes | unique, max 120 chars, pattern `[a-z0-9]+(?:-[a-z0-9]+)*` |
| `summary` | text | yes | max 1000 chars |
| `description` | text | yes | non-empty |
| `status` | select | yes | `draft`, `published`, `archived` |
| `workModel` | select | yes | `remote`, `hybrid`, `onsite` |
| `employmentType` | select | yes | `full_time`, `part_time`, `contract`, `internship` |
| `workLocation` | text | no | — |
| `requiredSkills` | text | no | newline-separated |
| `niceToHaveSkills` | text | no | newline-separated |
| `whatToExpect` | text | no | markdown |
| `hiringProcess` | text | no | markdown |
| `publishedAt` | date | no | — |

### Payload Assembly

When creating a new job, the action assembles:

```typescript
const payload = {
  title,          // from form, trimmed
  slug,           // from form, trimmed
  summary,        // from form, trimmed
  description,    // from form, trimmed
  status: "draft",
  workModel,      // from form select
  employmentType, // from form select
  workLocation: workLocation || "",
  requiredSkills: requiredSkills || "",
  niceToHaveSkills: niceToHaveSkills || "",
  whatToExpect: whatToExpect || "",
  hiringProcess: hiringProcess || "",
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Title validation

*For any* string, the title validator accepts it if and only if the string is non-empty and its length is at most 200 characters.

**Validates: Requirements 3.1**

### Property 2: Slug validation

*For any* string, the slug validator accepts it if and only if the string is non-empty, its length is at most 120 characters, and it matches the pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$`.

**Validates: Requirements 3.2**

### Property 3: Summary validation

*For any* string, the summary validator accepts it if and only if the string is non-empty and its length is at most 1000 characters.

**Validates: Requirements 3.3**

### Property 4: Enum field validation

*For any* string, the work model validator accepts it if and only if it is one of `"remote"`, `"hybrid"`, `"onsite"`, and the employment type validator accepts it if and only if it is one of `"full_time"`, `"part_time"`, `"contract"`, `"internship"`.

**Validates: Requirements 3.5, 3.6**

### Property 5: Payload assembly defaults and status

*For any* valid set of required job fields and any combination of present/absent optional fields, the assembled creation payload always has `status === "draft"` and every omitted optional field has a value of `""` (empty string).

**Validates: Requirements 4.1, 4.4**

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Form body cannot be parsed | Redirect to `/recruiter/jobs/new?error=form` |
| CSRF token missing or invalid | Redirect to `/recruiter/login?error=csrf` |
| User is not admin | Redirect to `/recruiter/jobs?error=forbidden` |
| Title validation fails | Redirect to `/recruiter/jobs/new?error=fields` with preserved values |
| Slug validation fails | Redirect to `/recruiter/jobs/new?error=slug` with preserved values |
| Summary validation fails | Redirect to `/recruiter/jobs/new?error=fields` with preserved values |
| Description empty | Redirect to `/recruiter/jobs/new?error=fields` with preserved values |
| Work model invalid | Redirect to `/recruiter/jobs/new?error=fields` with preserved values |
| Employment type invalid | Redirect to `/recruiter/jobs/new?error=fields` with preserved values |
| PocketBase create fails (e.g. duplicate slug) | Redirect to `/recruiter/jobs/new?error=create` with preserved values |

**Field preservation strategy:** On validation/creation errors, the action redirects back to the form page with query parameters encoding the previously submitted values. The form page reads these params and pre-fills the inputs so the user doesn't lose their work. For long fields (description, what_to_expect), server-side session storage or cookies could be used if URL length becomes a concern — but the initial implementation uses query params for simplicity, consistent with how error codes already work.

## Testing Strategy

### Unit Tests

Unit tests cover the validation module (`job-validation.ts`) with specific examples:
- Valid title at boundary (1 char, 200 chars)
- Invalid title (empty, 201 chars)
- Valid slug examples (`"my-job"`, `"a"`, `"abc-123-def"`)
- Invalid slug examples (`"My-Job"`, `"trailing-"`, `"-leading"`, `""`)
- Enum membership for both work model and employment type
- Payload assembly with all fields, with some optional fields missing

### Property-Based Tests

Property-based tests validate the universal properties defined above using the Node.js built-in test runner with a custom property-testing helper (since the project uses `node --test` without a dedicated PBT framework, we'll use [fast-check](https://github.com/dubcheck/fast-check) as the PBT library).

**Configuration:**
- Minimum 100 iterations per property test
- Each property test references its design document property in a comment tag
- Tag format: **Feature: add-new-job, Property {number}: {property_text}**

**Property test file:** `apps/web/src/lib/job-validation.test.ts`

Tests:
1. Title validation property (100+ random strings)
2. Slug validation property (100+ random strings + targeted valid slug generation)
3. Summary validation property (100+ random strings)
4. Enum validation property (100+ random strings against both enum sets)
5. Payload assembly property (100+ random valid inputs with randomized optional field presence)

### Integration Tests

Integration-level concerns (tested manually or via end-to-end tests):
- Middleware redirects unauthenticated users to login with `?next=` param
- Admin can submit form and see new job on detail page
- Non-admin is redirected with forbidden error
- Duplicate slug returns error from PocketBase
