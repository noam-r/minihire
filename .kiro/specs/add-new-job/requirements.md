# Requirements Document

## Introduction

This feature adds the ability for recruiters with the admin role to create new job postings directly from the recruiter portal. Currently, job creation requires access to the PocketBase Admin UI (superuser). This feature brings job creation into the recruiter dashboard, making it accessible to admin-level portal users without needing PocketBase superuser credentials.

## Glossary

- **Recruiter_Portal**: The authenticated web interface at `/recruiter` used by hiring staff to manage jobs and applications
- **Admin_User**: A recruiter portal user with `role` set to `admin` in the PocketBase `users` collection
- **Job_Creation_Form**: The form page at `/recruiter/jobs/new` where admin users fill in job details to create a new posting
- **Job_Record**: A record in the PocketBase `jobs` collection containing all fields for a job posting
- **PocketBase_Client**: The authenticated PocketBase SDK instance available through the recruiter session
- **CSRF_Token**: A session-bound token used to protect form submissions against cross-site request forgery
- **Slug**: A URL-friendly identifier for a job, composed of lowercase letters, numbers, and hyphens

## Requirements

### Requirement 1: Access Control for Job Creation

**User Story:** As a platform administrator, I want only admin-level recruiters to access the job creation page, so that unauthorized users cannot create job postings.

#### Acceptance Criteria

1. WHEN a user with role "recruiter" requests the Job_Creation_Form page, THE Recruiter_Portal SHALL redirect the user to the jobs list page with a "forbidden" error indicator displayed as an inline error message
2. WHEN an unauthenticated user requests the Job_Creation_Form page, THE Recruiter_Portal SHALL redirect the user to the login page, preserving the originally requested path so the user is returned to it after successful authentication
3. WHILE an Admin_User is authenticated, THE Recruiter_Portal SHALL display a "New job" link on the jobs list page that navigates to the Job_Creation_Form
4. WHILE a user with role "recruiter" (non-admin) is authenticated, THE Recruiter_Portal SHALL NOT display the "New job" link on the jobs list page

### Requirement 2: Job Creation Form Display

**User Story:** As an admin recruiter, I want a form with all required job fields, so that I can provide complete information for a new posting.

#### Acceptance Criteria

1. THE Job_Creation_Form SHALL display input fields for: title (single-line text input), slug (single-line text input), summary (multiline text area), description (multiline text area), work model (select), employment type (select), work location (single-line text input), required skills (multiline text area), nice-to-have skills (multiline text area), what to expect (multiline text area), and hiring process (multiline text area)
2. THE Job_Creation_Form SHALL mark title, slug, summary, description, work model, and employment type as required fields using a visible asterisk indicator and the HTML required attribute
3. THE Job_Creation_Form SHALL present work model as a select with options: remote, hybrid, onsite
4. THE Job_Creation_Form SHALL present employment type as a select with options: full_time, part_time, contract, internship
5. THE Job_Creation_Form SHALL include a hidden CSRF_Token field for submission protection
6. THE Job_Creation_Form SHALL display required skills and nice-to-have skills as multiline text areas with placeholder text indicating one skill per line
7. THE Job_Creation_Form SHALL display a submit button labeled "Create job" that submits the form data to the server

### Requirement 3: Job Field Validation

**User Story:** As an admin recruiter, I want the system to validate my inputs before saving, so that I receive clear feedback if something is wrong.

#### Acceptance Criteria

1. WHEN the title field is empty or exceeds 200 characters, THE Recruiter_Portal SHALL reject the submission and redirect back with a field validation error
2. WHEN the slug field is empty, exceeds 120 characters, or does not match the pattern `[a-z0-9]+(?:-[a-z0-9]+)*`, THE Recruiter_Portal SHALL reject the submission and redirect back with a slug validation error
3. WHEN the summary field is empty or exceeds 1000 characters, THE Recruiter_Portal SHALL reject the submission and redirect back with a field validation error
4. WHEN the description field is empty, THE Recruiter_Portal SHALL reject the submission and redirect back with a field validation error
5. WHEN the work model value is not one of remote, hybrid, or onsite, THE Recruiter_Portal SHALL reject the submission and redirect back with a field validation error
6. WHEN the employment type value is not one of full_time, part_time, contract, or internship, THE Recruiter_Portal SHALL reject the submission and redirect back with a field validation error
7. WHEN the CSRF_Token is missing or invalid, THE Recruiter_Portal SHALL redirect to the login page with a CSRF error indicator

### Requirement 4: Job Record Creation

**User Story:** As an admin recruiter, I want the system to save valid job data to the database, so that the new job becomes available for publishing.

#### Acceptance Criteria

1. WHEN a valid form submission is received, THE Recruiter_Portal SHALL create a new Job_Record in the PocketBase jobs collection with status set to "draft"
2. WHEN the Job_Record is created successfully, THE Recruiter_Portal SHALL redirect the Admin_User to the new job's detail page at `/recruiter/jobs/{id}` with a success indicator
3. IF the PocketBase_Client returns an error during creation (for example a duplicate slug), THEN THE Recruiter_Portal SHALL redirect back to the Job_Creation_Form preserving submitted values and displaying an error message
4. THE Recruiter_Portal SHALL store optional fields (work location, required skills, nice-to-have skills, what to expect, hiring process) as empty strings when not provided by the Admin_User

### Requirement 5: Navigation and Discoverability

**User Story:** As an admin recruiter, I want to easily find and access the job creation form, so that creating a new job is straightforward from my workflow.

#### Acceptance Criteria

1. WHILE an Admin_User is viewing the jobs list page, THE Recruiter_Portal SHALL display a visually distinct "New job" button above the jobs list that links to the Job_Creation_Form
2. THE Job_Creation_Form SHALL include a back link labeled with the destination "Jobs" that navigates to the jobs list page without submitting the form, discarding any unsaved input
3. WHILE a non-admin user is viewing the jobs list page, THE Recruiter_Portal SHALL NOT display the "New job" button
