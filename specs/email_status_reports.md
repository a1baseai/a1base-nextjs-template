# Specification: Project Status Email Reports

**Version:** 1.0
**Date:** 2025-06-01

## 1. Overview

This document outlines the specification for a feature enabling users to receive status reports on their projects and tasks via email. Users can request these reports on-demand for immediate delivery or schedule them to be sent at regular intervals (daily, weekly, monthly). The emails will be professionally formatted, aesthetically pleasing, and use tables where appropriate to present information clearly, with all operations scoped to the individual user.

## 2. Key Components & Systems

### A. User Intent Handling & NLP

*   **Goal:** Accurately interpret user requests for both on-demand and scheduled reports, ensuring actions are scoped to the requesting user.
*   **Mechanism:**
    *   Extend the existing NLP/intent recognition system (likely in `lib/services/openai.ts` - `triageMessageIntent` and `lib/ai-triage/triage-logic.ts` - `triageMessage`).
    *   New intents to identify:
        *   `request_on_demand_email_report`: For requests like "Email me a project status report now."
        *   `request_scheduled_email_report`: For requests like "Send me daily project updates every morning at 9 AM."
    *   The system needs to extract parameters: `user_id`, `email_address` (if not already known for the user), frequency (daily, weekly, monthly), specific time of day, and potentially the type of report.
*   **Relevant Files (Conceptual):**
    *   `lib/services/openai.ts`
    *   `lib/ai-triage/triage-logic.ts`

### B. Report Scheduling (A1Cron Integration)

*   **Goal:** Manage recurring report generation and sending, specific to each user.
*   **Mechanism:**
    1.  **Job Creation via A1Cron API:** When a `request_scheduled_email_report` intent is confirmed for a user, a new job is created in the A1Cron system using their API.
        *   **Endpoint:** `POST https://api.a1base.com/v1/cron-jobs/{accountId}/create`
        *   **Key A1Cron Job Parameters (scoped to user):**
            *   `name`: Descriptive, e.g., "User [UserID/Email] - Daily Project Report"
            *   `endpoint_url`: This will be a new API endpoint within our application (e.g., `https://<your-app-domain>/api/reports/trigger-scheduled-report`) that A1Cron will call.
            *   `method`: `POST`
            *   `headers`: Authentication for our internal endpoint if needed.
            *   `body`: JSON payload containing `userId`, `reportType`, `emailAddress`, and any other necessary parameters for our internal endpoint to generate the correct report for the specific user.
                ```json
                {
                  "userId": "user-uuid-123",
                  "reportType": "daily_project_summary",
                  "emailAddress": "user@example.com"
                }
                ```
            *   `timezone`: User's specified timezone.
            *   `schedule_config`: Object detailing `repeat_type`, `repeat_every`, `time` as per A1Cron documentation.
            *   `callbacks`: (Optional but recommended) `success_url` and `failure_url` pointing to our existing `@app/api/a1base/cron-webhook` to log job outcomes.
            *   `tags`: e.g., `["user_report", "user_id:user-uuid-123"]`
    2.  **Internal Job Tracking:** Store job details and their A1Cron `job_id` in a new Supabase table (e.g., `scheduled_email_reports`) linked to the user.
        ```sql
        CREATE TABLE scheduled_email_reports (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id), -- Assuming a users table
            a1cron_job_id TEXT, -- ID from A1Cron
            email_address TEXT NOT NULL,
            report_type TEXT DEFAULT 'default_status',
            frequency TEXT NOT NULL, -- 'daily', 'weekly', 'monthly'
            scheduled_time TIME WITH TIME ZONE,
            timezone TEXT NOT NULL,
            last_sent_at TIMESTAMPTZ,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX idx_scheduled_email_reports_user_id ON scheduled_email_reports(user_id);
        CREATE INDEX idx_scheduled_email_reports_a1cron_job_id ON scheduled_email_reports(a1cron_job_id);
        ```
    3.  **Job Execution:** A1Cron calls our application's `/api/reports/trigger-scheduled-report` endpoint at the scheduled time. This endpoint then initiates report generation and sending for the specified user.
*   **Relevant Files/Services (Conceptual):**
    *   New service: `lib/services/report-scheduler.ts` (to manage CRUD for `scheduled_email_reports` table and interact with A1Cron API).
    *   New Supabase migration for `scheduled_email_reports`.
    *   Updates to `@app/api/a1base/cron-webhook` to handle success/failure callbacks from A1Cron for these specific jobs.

### C. On-Demand Reports

*   **Goal:** Send a report to a user as soon as they request it.
*   **Mechanism:**
    1.  When a `request_on_demand_email_report` intent is confirmed for a user.
    2.  The system immediately triggers the report generation and email sending process for that user.
    3.  This flow bypasses A1Cron scheduling but uses the same user-scoped report generation and email sending services.

### D. Report Generation Service

*   **Goal:** Compile user-specific data and format it into an HTML email.
*   **Mechanism:**
    1.  **Data Fetching:** Retrieve relevant project/task data specifically for the `userId`.
        *   Requires new or extended methods in `lib/supabase/adapter.ts` (e.g., `getProjectsForReport(userId, dateRange)`).
    2.  **Content Templating:** Use an HTML templating engine to create the email body. The template will define the structure, tables, and styling.
*   **Relevant Files (Conceptual):**
    *   New service: `lib/services/report-generator.ts`
    *   HTML email templates: e.g., `templates/email/project_status_report.html`
    *   `lib/supabase/adapter.ts`

### E. Email Sending (A1Mail Integration)

*   **Goal:** Dispatch the generated HTML email to the user using A1Mail.
*   **Mechanism:**
    1.  The Report Generation Service will pass the HTML content, subject line, and the user's `recipient_address` to an A1Mail service/client.
    2.  **A1Mail API Call:**
        *   **Endpoint:** `POST https://api.a1base.com/v1/emails/{account_id}/send`
        *   **Request Body:**
            ```json
            {
                "sender_address": "reports@yourdomain.a1send.com", // Or a configured address
                "recipient_address": "user@example.com", // User's email
                "subject": "Your Project Status Report",
                "body": "<html>...your HTML report...</html>", // HTML content
                "headers": {}
            }
            ```
    3.  The `@app/api/a1base/email` directory might contain webhook handlers for *receiving* emails. For this feature, we are primarily *sending*. If replies to reports need to be handled, this endpoint would become relevant for processing incoming A1Mail webhooks.
*   **Relevant Files (Conceptual):**
    *   Interface/wrapper for A1Mail: `lib/services/email-sender.ts` (or directly use A1Mail SDK/HTTP client).

### F. New API Endpoint for Triggering Reports

*   **Goal:** Provide a dedicated internal endpoint that can be called by A1Cron for scheduled reports, or directly for on-demand/testing purposes, always acting on behalf of a specific user.
*   **Path:** `/api/reports/trigger-scheduled-report` (for A1Cron) and potentially `/api/reports/send-on-demand-report` (for immediate requests, or a single endpoint with a trigger type).
*   **Method:** `POST`
*   **Request Body (Example for A1Cron triggered):**
    ```json
    {
      "userId": "user-uuid-123",
      "reportType": "project_summary",
      "emailAddress": "user@example.com" // Can be fetched if only userId is passed
    }
    ```
*   **Action:** This endpoint orchestrates fetching user-specific data, generating the report HTML, and sending it via A1Mail to the user.
*   **Security:** Ensure proper authentication/authorization (e.g., a secret shared with A1Cron, or internal service authentication).
*   **Relevant Files (Conceptual):**
    *   New API route: `pages/api/reports/trigger-scheduled-report.ts`.

## 3. Workflow Examples

*   **A. User Requests On-Demand Report:**
    1.  User: "Email me my project status now."
    2.  NLP: Identifies `request_on_demand_email_report`. Extracts `userId`.
    3.  System: Calls internal logic/service that directly invokes `ReportGenerationService.generateReport(userId, 'current_status')`.
    4.  `ReportGenerationService`: Fetches data for `userId` via `SupabaseAdapter`, formats HTML.
    5.  System: Calls `EmailSendingService.send(userEmail, subject, htmlBody)` using A1Mail API.
    6.  User receives email ASAP.

*   **B. User Requests Scheduled Report:**
    1.  User: "Send me a daily project report every morning."
    2.  NLP: Identifies `request_scheduled_email_report`. Extracts `userId`, `frequency: 'daily'`, `time: 'morning'`.
    3.  System: Calls `ReportSchedulerService.createScheduledReport(userId, userEmail, 'daily', '09:00', userTimezone)`.
    4.  `ReportSchedulerService`: Makes a `POST` request to A1Cron's `/v1/cron-jobs/{accountId}/create` API with payload including our app's `endpoint_url` (`/api/reports/trigger-scheduled-report`) and a `body` for that endpoint containing `userId`, `reportType`, `userEmail`. Stores A1Cron job ID locally against the user.
    5.  User receives confirmation.

*   **C. A1Cron Executes Scheduled Report:**
    1.  A1Cron: Job for `userId` is due. Makes a `POST` request to our application's `/api/reports/trigger-scheduled-report` with the user-specific payload.
    2.  Our API Endpoint (`/api/reports/trigger-scheduled-report`): Receives request, validates.
    3.  Endpoint: Calls `ReportGenerationService.generateReport(payload.userId, payload.reportType, relevantDateRange)`.
    4.  `ReportGenerationService`: Fetches data for `payload.userId`, formats HTML.
    5.  Endpoint: Calls `EmailSendingService.send(payload.emailAddress, subject, htmlBody)` using A1Mail API.
    6.  (Optional) `ReportSchedulerService`: Updates `last_sent_at` for the job in Supabase (or this can be handled by A1Cron webhook callback processing).

## 4. Email Design Principles

*   **Subject Line:** Clear, user-specific (e.g., "Your Daily Project Status Update, [User Name]").
*   **Branding:** Consistent with A1Base.
*   **Tone:** Professional, clear, concise, friendly.
*   **Structure:** Greeting, brief overview, sections (Projects, Tasks), tables for data, clear CTAs.
*   **Aesthetics:** Clean, readable, responsive.
*   **Footer:** Unsubscribe link (for scheduled reports), contact/support info.

## 5. Key Considerations

*   **User Scoping:** All operations (data fetching, cron job creation, email sending) MUST be strictly scoped to the relevant user.
*   **A1Base API Keys:** Securely manage `X-API-Key` and `X-API-Secret` for A1Cron and A1Mail.
*   **Timezones:** Handle carefully for scheduled reports. Store user timezone preferences.
*   **Unsubscribe:** Users must be able to cancel scheduled reports. This involves:
    *   An NLP intent `cancel_scheduled_email_report`.
    *   Logic to call A1Cron's `DELETE /v1/cron-jobs/{accountId}/{jobId}` or `PATCH /v1/cron-jobs/{accountId}/{jobId}` (to set `is_active: false`).
    *   Updating the `is_active` flag in our `scheduled_email_reports` Supabase table.
*   **Error Handling & Logging:** Robust error handling. Log A1Cron callback details received at `@app/api/a1base/cron-webhook`.
*   **Idempotency:** Design the `/api/reports/trigger-scheduled-report` endpoint to be idempotent if possible, in case A1Cron retries.

## 6. Role of Existing Application Endpoints

*   `@app/api/a1base/email` (e.g., `/app/api/a1base/email/webhook`):
    *   **Current Use (Assumed):** Likely handles incoming email webhooks from A1Mail (i.e., when an email is *received* by an A1Mail address).
    *   **Relevance to this Feature:** Primarily for handling replies if users reply to the status report emails. Not directly involved in *sending* reports, but could be enhanced to process replies related to reports.
*   `@app/api/a1base/cron-webhook` (e.g., `/app/api/a1base/cron-webhook/callback`):
    *   **Current Use (Assumed):** Receives success/failure callback notifications from A1Cron for various cron jobs.
    *   **Relevance to this Feature:** This endpoint should be specified in the `callbacks` (`success_url`, `failure_url`) when creating A1Cron jobs for scheduled reports. It will be used to log the execution status of report sending jobs, update `last_sent_at`, or handle failures (e.g., notify admin, retry logic if not handled by A1Cron itself).

This specification provides a foundation. Detailed API interactions with A1Cron and A1Mail, specific HTML template designs, and precise Supabase queries will be defined during implementation.
