/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_COMPANY_NAME?: string;
  readonly PUBLIC_SITE_URL?: string;
  readonly POCKETBASE_URL?: string;
  readonly POCKETBASE_SUBMISSION_SERVICE_EMAIL?: string;
  readonly POCKETBASE_SUBMISSION_SERVICE_PASSWORD?: string;
  readonly RESEND_API_KEY?: string;
  readonly APPLICATION_EMAIL_FROM?: string;
  readonly APPLICATION_EMAIL_REPLY_TO?: string;
  readonly MAX_CV_SIZE_BYTES?: string;
  readonly FORM_SIGNING_SECRET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
