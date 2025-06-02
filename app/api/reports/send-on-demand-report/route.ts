/**
 * API Endpoint: Send On-Demand Report
 * 
 * This endpoint handles immediate/on-demand email report requests
 */

import { NextResponse } from 'next/server';
import { ReportGeneratorService } from '@/lib/services/report-generator';
import { ReportSchedulerService } from '@/lib/services/report-scheduler';
import { SendEmailFromAgent } from '@/lib/workflows/email_workflow';

interface OnDemandReportRequest {
  userId: string;
  emailAddress: string;
  reportType?: string;
  dateRange?: 'daily' | 'weekly' | 'monthly';
}

export async function POST(request: Request) {
  try {
    // Parse request body
    const body = await request.json() as OnDemandReportRequest;
    const { userId, emailAddress, reportType = 'project_status', dateRange = 'weekly' } = body;

    if (!userId || !emailAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    console.log(`[SendOnDemandReport] Generating on-demand report for user ${userId}`);

    // Initialize services
    const reportGenerator = new ReportGeneratorService();
    const reportScheduler = new ReportSchedulerService();

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
      subject: `Your Project Status Report - ${new Date().toLocaleDateString()}`,
      body: htmlContent,
      recipient_address: emailAddress
    };

    // Send the email
    await SendEmailFromAgent(emailDetails);

    // Log report history
    await reportScheduler.logReportHistory(userId, {
      type: 'on_demand',
      email_address: emailAddress,
      subject: emailDetails.subject,
      status: 'sent',
      sent_at: new Date().toISOString()
    });

    console.log(`[SendOnDemandReport] On-demand report sent successfully to ${emailAddress}`);

    return NextResponse.json({
      success: true,
      message: 'On-demand report sent successfully',
      emailAddress
    });

  } catch (error) {
    console.error('[SendOnDemandReport] Error:', error);
    
    // Log failed report
    try {
      const body = await request.json() as OnDemandReportRequest;
      const reportScheduler = new ReportSchedulerService();
      
      if (body.userId) {
        await reportScheduler.logReportHistory(body.userId, {
          type: 'on_demand',
          email_address: body.emailAddress || '',
          subject: 'Failed On-Demand Report',
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          sent_at: new Date().toISOString()
        });
      }
    } catch (logError) {
      console.error('[SendOnDemandReport] Error logging failed report:', logError);
    }

    return NextResponse.json(
      { error: 'Failed to generate and send on-demand report' },
      { status: 500 }
    );
  }
} 