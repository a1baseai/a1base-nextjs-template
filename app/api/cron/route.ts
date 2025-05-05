/**
 * CRON Endpoint for AI Agent Systems
 *
 * This endpoint provides a secure way to trigger scheduled tasks for AI agents.
 *
 * ### Common Use Cases
 * 1. **Daily Check-ins & Status Reports**
 *    - Send daily summaries of agent activities
 *    - Report on conversation metrics and outcomes
 *    - Alert on any anomalies or issues
 * 2. **End of Day Processing**
 *    - Aggregate conversation data and analytics
 *    - Clean up temporary conversation states
 *    - Archive completed conversations
 *    - Generate daily performance reports
 * 3. **Scheduled Agent Maintenance**
 *    - Refresh API tokens and credentials
 *    - Update agent knowledge bases
 *    - Clear conversation caches
 *    - Verify agent health and responsiveness
 * 4. **Automated Follow-ups**
 *    - Send scheduled reminders for pending conversations
 *    - Follow up on unresolved queries
 *    - Re-engage with inactive users
 *
 * ### Security and Implementation Considerations
 * 1. **Authentication**: Use the CRON_SECRET for request validation
 * 2. **HTTPS Only**: Never expose cron endpoints over plain HTTP
 * 3. **Idempotency**: Ensure tasks can safely run multiple times
 * 4. **Timeouts**: Keep tasks within your hosting platform's timeout limits
 * 5. **Logging**: Maintain detailed logs for debugging and monitoring
 * 6. **Error Handling**: Implement robust error handling and notifications
 * 7. **Rate Limiting**: Consider implementing rate limiting for security
 *
 * ### Setting up the Cron Job with A1Base
 * To schedule this endpoint, use the A1Base Cron system as follows:
 *
 * 1. **Log In**: Log into your A1Base account and go to the Cron Jobs dashboard at [a1base.com/dashboard/cron-jobs](https://a1base.com/dashboard/cron-jobs).
 * 2. **Create Cron Job**: Click "Create New Cron Job."
 * 3. **Configure Settings**:
 *    - **Endpoint URL**: Set to your cron endpoint, e.g., `https://your-domain.com/api/cron` (replace with your actual domain).
 *    - **Frequency**: Choose your desired schedule (e.g., "Daily").
 *    - **Time**: Select the time for the job to run (e.g., "12:00 am").
 *    - **Timezone**: Pick your timezone (e.g., "America/Los_Angeles").
 *    - **HTTP Method**: Select "POST" (this endpoint requires POST requests).
 *    - **Headers (JSON)**: Enter the following, replacing "your-cron-secret" with the value of your `CRON_SECRET` environment variable:
 *      ```json
 *      {
 *        "Authorization": "Bearer your-cron-secret"
 *      }
 *      ```
 *    - **Request Body**: Leave empty unless your cron logic needs specific data.
 * 4. **Save**: Click "Create Cron Job" to activate the schedule.
 *
 * ### Important Notes
 * - **CRON_SECRET**: Ensure the `CRON_SECRET` environment variable is set in your server's deployment settings (e.g., in your `.env` file or hosting platform) and matches the value in the Authorization header.
 * - **HTTPS**: Your endpoint must use HTTPS for security.
 * - **Monitoring**: Check the A1Base dashboard to monitor execution status and troubleshoot issues.
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: Request) {
  const headersList = await headers();
  const authHeader = headersList.get("authorization");

  // Verify authorization header matches the expected Bearer token
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    // Log the request object to understand what data is available in cron job requests
    // Example request object properties:
    // - request.url: The full URL of the request
    // - request.method: The HTTP method (POST)
    // - request.headers: Headers including authorization
    // - request.body: Request body if any data was sent
    // This helps debug what information A1Base sends during cron job execution
    // Console log removed - Cron job request with URL, method, and headers
    // Details included URL, HTTP method, headers, etc.

    return new NextResponse("Cron job completed successfully", { status: 200 });
  } catch (error) {
    console.error('Cron job failed:', error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}