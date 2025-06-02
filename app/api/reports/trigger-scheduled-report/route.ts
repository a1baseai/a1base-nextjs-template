/**
 * API Endpoint: Trigger Scheduled Report
 * 
 * This endpoint is called by A1Cron to trigger scheduled email reports
 */

import { NextResponse } from 'next/server';
import { ReportGeneratorService } from '@/lib/services/report-generator';
import { ReportSchedulerService } from '@/lib/services/report-scheduler';
import { SendEmailFromAgent } from '@/lib/workflows/email_workflow';
import { getInitializedAdapter } from '@/lib/supabase/config';

interface TriggerReportRequest {
  reportId?: string;
  userId: string;
  reportType: string;
  emailAddress: string;
}

export async function POST(request: Request) {
  try {
    // Verify internal authentication
    const authHeader = request.headers.get('X-Internal-Secret');
    const expectedSecret = process.env.INTERNAL_API_SECRET || 'development-secret';
    
    if (authHeader !== expectedSecret) {
      console.error('[TriggerScheduledReport] Invalid authentication');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json() as TriggerReportRequest;
    const { reportId, userId, reportType, emailAddress } = body;

    if (!userId || !emailAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    console.log(`[TriggerScheduledReport] Generating report for user ${userId}`);

    // Initialize services
    const reportGenerator = new ReportGeneratorService();
    const reportScheduler = new ReportSchedulerService();

    // Determine date range based on the scheduled report if available
    let dateRange: 'daily' | 'weekly' | 'monthly' = 'weekly';
    
    if (reportId) {
      const adapter = await getInitializedAdapter();
      if (adapter) {
        // Get the report from user metadata
        const { data: user } = await adapter.supabase
          .from('conversation_users')
          .select('metadata')
          .eq('id', userId)
          .single();
        
        const scheduledReport = user?.metadata?.email_reports?.scheduled?.[reportId];
        if (scheduledReport) {
          dateRange = scheduledReport.frequency;
        }
      }
    }

    // Generate the report data
    const reportData = await reportGenerator.generateReport(
      userId,
      reportType,
      dateRange
    );

    // Set the email address
    reportData.userEmail = emailAddress;

    // Generate HTML email content
    const htmlContent = reportGenerator.generateHTMLEmail(reportData);

    // Prepare email details
    const emailDetails = {
      subject: `Your ${dateRange.charAt(0).toUpperCase() + dateRange.slice(1)} Project Status Report`,
      body: htmlContent,
      recipient_address: emailAddress
    };

    // Send the email
    await SendEmailFromAgent(emailDetails);

    // Update last sent timestamp if this is a scheduled report
    if (reportId) {
      await reportScheduler.updateLastSent(reportId, userId);
    }

    // Log report history
    await reportScheduler.logReportHistory(userId, {
      type: 'scheduled',
      email_address: emailAddress,
      subject: emailDetails.subject,
      status: 'sent',
      sent_at: new Date().toISOString()
    });

    console.log(`[TriggerScheduledReport] Report sent successfully to ${emailAddress}`);

    return NextResponse.json({
      success: true,
      message: 'Report sent successfully',
      emailAddress
    });

  } catch (error) {
    console.error('[TriggerScheduledReport] Error:', error);
    
    // Log failed report
    try {
      const body = await request.json() as TriggerReportRequest;
      const reportScheduler = new ReportSchedulerService();
      
      if (body.userId) {
        await reportScheduler.logReportHistory(body.userId, {
          type: 'scheduled',
          email_address: body.emailAddress || '',
          subject: 'Failed Report',
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          sent_at: new Date().toISOString()
        });
      }
    } catch (logError) {
      console.error('[TriggerScheduledReport] Error logging failed report:', logError);
    }

    return NextResponse.json(
      { error: 'Failed to generate and send report' },
      { status: 500 }
    );
  }
} 