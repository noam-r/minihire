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
  /** Last line of the plain-text "Application received" email body. Defaults to PUBLIC_COMPANY_NAME. */
  readonly APPLICATION_EMAIL_SIGN_OFF?: string;
  readonly MAX_CV_SIZE_BYTES?: string;
  readonly FORM_SIGNING_SECRET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
