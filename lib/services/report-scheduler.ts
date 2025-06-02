/**
 * Report Scheduler Service
 * 
 * Manages scheduled email reports through A1Cron integration
 * Uses user metadata to store report preferences
 */

import { A1CronService } from '../a1cron/service';
import { CreateCronJobRequest } from '../a1cron/types';
import { getInitializedAdapter } from '../supabase/config';

export interface ScheduledReport {
  id: string;
  a1cron_job_id?: string;
  email_address: string;
  report_type: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  scheduled_time?: string;
  timezone: string;
  last_sent_at?: string;
  is_active: boolean;
  created_at: string;
}

export interface CreateScheduledReportParams {
  userId: string;
  emailAddress: string;
  reportType?: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  scheduledTime?: string; // Format: "HH:MM"
  timezone?: string;
}

export class ReportSchedulerService {
  private cronService: A1CronService;
  
  constructor() {
    const apiKey = process.env.A1BASE_API_KEY;
    const apiSecret = process.env.A1BASE_API_SECRET;
    const accountId = process.env.A1BASE_ACCOUNT_ID;

    if (!apiKey || !apiSecret || !accountId) {
      throw new Error('A1Cron requires A1BASE_API_KEY, A1BASE_API_SECRET, and A1BASE_ACCOUNT_ID environment variables');
    }

    this.cronService = new A1CronService({
      apiKey,
      apiSecret,
      accountId,
    });
  }

  /**
   * Create a new scheduled email report
   */
  async createScheduledReport(params: CreateScheduledReportParams): Promise<ScheduledReport | null> {
    try {
      const adapter = await getInitializedAdapter();
      if (!adapter) {
        throw new Error('Database adapter not initialized');
      }

      // Default values
      const reportType = params.reportType || 'project_status';
      const timezone = params.timezone || 'UTC';
      const scheduledTime = params.scheduledTime || '09:00'; // Default to 9 AM

      // Generate a unique ID for this report
      const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create the report object
      const report: ScheduledReport = {
        id: reportId,
        email_address: params.emailAddress,
        report_type: reportType,
        frequency: params.frequency,
        scheduled_time: scheduledTime,
        timezone: timezone,
        is_active: true,
        created_at: new Date().toISOString()
      };

      // Create the A1Cron job
      try {
        const cronJobRequest = this.buildCronJobRequest(report, params.userId);
        const response = await this.cronService.createCronJob(cronJobRequest);

        if (response && response.data && response.data.id) {
          report.a1cron_job_id = response.data.id;
        }
      } catch (cronError) {
        console.error('[ReportSchedulerService] Error creating A1Cron job:', cronError);
        throw cronError;
      }

      // Store the report in user metadata
      const { data: user } = await adapter.supabase
        .from('conversation_users')
        .select('metadata')
        .eq('id', params.userId)
        .single();

      const currentMetadata = user?.metadata || {};
      const emailReports = currentMetadata.email_reports || {};
      
      // Store the scheduled report
      emailReports.scheduled = emailReports.scheduled || {};
      emailReports.scheduled[reportId] = report;
      
      // Update user metadata
      const { error: updateError } = await adapter.supabase
        .from('conversation_users')
        .update({
          metadata: {
            ...currentMetadata,
            email: params.emailAddress, // Also store email at top level
            email_reports: emailReports
          }
        })
        .eq('id', params.userId);

      if (updateError) {
        console.error('[ReportSchedulerService] Error updating user metadata:', updateError);
        // Try to delete the cron job since we couldn't save it
        if (report.a1cron_job_id) {
          await this.cronService.deleteCronJob(report.a1cron_job_id);
        }
        throw updateError;
      }

      console.log('[ReportSchedulerService] Successfully created scheduled report:', report.id);
      return report;
    } catch (error) {
      console.error('[ReportSchedulerService] Error in createScheduledReport:', error);
      return null;
    }
  }

  /**
   * Cancel a scheduled email report
   */
  async cancelScheduledReport(reportId: string, userId: string): Promise<boolean> {
    try {
      const adapter = await getInitializedAdapter();
      if (!adapter) {
        throw new Error('Database adapter not initialized');
      }

      // Get user metadata
      const { data: user } = await adapter.supabase
        .from('conversation_users')
        .select('metadata')
        .eq('id', userId)
        .single();

      const metadata = user?.metadata || {};
      const scheduledReports = metadata.email_reports?.scheduled || {};
      const report = scheduledReports[reportId];

      if (!report) {
        console.error('[ReportSchedulerService] Report not found:', reportId);
        return false;
      }

      // Delete the A1Cron job if it exists
      if (report.a1cron_job_id) {
        try {
          await this.cronService.deleteCronJob(report.a1cron_job_id);
        } catch (cronError) {
          console.error('[ReportSchedulerService] Error deleting A1Cron job:', cronError);
          // Continue with deactivating the report even if cron deletion fails
        }
      }

      // Mark as inactive in metadata
      report.is_active = false;
      scheduledReports[reportId] = report;

      // Update user metadata
      const { error: updateError } = await adapter.supabase
        .from('conversation_users')
        .update({
          metadata: {
            ...metadata,
            email_reports: {
              ...metadata.email_reports,
              scheduled: scheduledReports
            }
          }
        })
        .eq('id', userId);

      if (updateError) {
        console.error('[ReportSchedulerService] Error updating user metadata:', updateError);
        return false;
      }

      console.log('[ReportSchedulerService] Successfully cancelled scheduled report:', reportId);
      return true;
    } catch (error) {
      console.error('[ReportSchedulerService] Error in cancelScheduledReport:', error);
      return false;
    }
  }

  /**
   * Get all scheduled reports for a user
   */
  async getUserScheduledReports(userId: string): Promise<ScheduledReport[]> {
    try {
      const adapter = await getInitializedAdapter();
      if (!adapter) {
        throw new Error('Database adapter not initialized');
      }

      const { data: user } = await adapter.supabase
        .from('conversation_users')
        .select('metadata')
        .eq('id', userId)
        .single();

      const scheduledReports = user?.metadata?.email_reports?.scheduled || {};
      
      // Return only active reports
      return Object.values(scheduledReports)
        .filter((report: any) => report.is_active)
        .map((report: any) => report as ScheduledReport);
    } catch (error) {
      console.error('[ReportSchedulerService] Error in getUserScheduledReports:', error);
      return [];
    }
  }

  /**
   * Update the last sent timestamp for a report
   */
  async updateLastSent(reportId: string, userId: string): Promise<void> {
    try {
      const adapter = await getInitializedAdapter();
      if (!adapter) {
        throw new Error('Database adapter not initialized');
      }

      // Get user metadata
      const { data: user } = await adapter.supabase
        .from('conversation_users')
        .select('metadata')
        .eq('id', userId)
        .single();

      const metadata = user?.metadata || {};
      const scheduledReports = metadata.email_reports?.scheduled || {};
      
      if (scheduledReports[reportId]) {
        scheduledReports[reportId].last_sent_at = new Date().toISOString();

        // Update user metadata
        await adapter.supabase
          .from('conversation_users')
          .update({
            metadata: {
              ...metadata,
              email_reports: {
                ...metadata.email_reports,
                scheduled: scheduledReports
              }
            }
          })
          .eq('id', userId);
      }
    } catch (error) {
      console.error('[ReportSchedulerService] Error in updateLastSent:', error);
    }
  }

  /**
   * Log report history in metadata
   */
  async logReportHistory(userId: string, report: {
    type: 'scheduled' | 'on_demand';
    email_address: string;
    subject: string;
    status: 'sent' | 'failed';
    error?: string;
    sent_at: string;
  }): Promise<void> {
    try {
      const adapter = await getInitializedAdapter();
      if (!adapter) return;

      const { data: user } = await adapter.supabase
        .from('conversation_users')
        .select('metadata')
        .eq('id', userId)
        .single();

      const metadata = user?.metadata || {};
      const emailReports = metadata.email_reports || {};
      const history = emailReports.history || [];

      // Keep only last 20 entries
      history.unshift(report);
      if (history.length > 20) {
        history.pop();
      }

      // Update metadata
      await adapter.supabase
        .from('conversation_users')
        .update({
          metadata: {
            ...metadata,
            email_reports: {
              ...emailReports,
              history
            }
          }
        })
        .eq('id', userId);
    } catch (error) {
      console.error('[ReportSchedulerService] Error logging report history:', error);
    }
  }

  /**
   * Build the A1Cron job request for a scheduled report
   */
  private buildCronJobRequest(report: ScheduledReport, userId: string): CreateCronJobRequest {
    const appDomain = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const endpointUrl = `${appDomain}/api/reports/trigger-scheduled-report`;

    // Build schedule config based on frequency
    const scheduleConfig = this.buildScheduleConfig(
      report.frequency,
      report.scheduled_time || '09:00'
    );

    return {
      name: `User ${userId} - ${report.frequency} ${report.report_type} report`,
      description: `Automated ${report.frequency} email report for user ${userId}`,
      endpoint_url: endpointUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': process.env.INTERNAL_API_SECRET || 'development-secret'
      },
      body: JSON.stringify({
        reportId: report.id,
        userId: userId,
        reportType: report.report_type,
        emailAddress: report.email_address
      }),
      timezone: report.timezone,
      schedule_config: scheduleConfig,
      callbacks: {
        success_url: `${appDomain}/api/a1base/cron-webhook`,
        failure_url: `${appDomain}/api/a1base/cron-webhook`
      },
      tags: ['email_report', `user_${userId}`, report.report_type],
      is_active: true
    };
  }

  /**
   * Build schedule configuration based on frequency
   */
  private buildScheduleConfig(frequency: string, time: string) {
    const [hours, minutes] = time.split(':');
    
    switch (frequency) {
      case 'daily':
        return {
          repeat_type: 'days' as const,
          repeat_every: 1,
          time: time,
          end_type: 'never' as const
        };
      
      case 'weekly':
        return {
          repeat_type: 'weeks' as const,
          repeat_every: 1,
          time: time,
          days_of_week: ['1'], // Monday by default
          end_type: 'never' as const
        };
      
      case 'monthly':
        return {
          repeat_type: 'months' as const,
          repeat_every: 1,
          time: time,
          end_type: 'never' as const
        };
      
      default:
        // Default to daily
        return {
          repeat_type: 'days' as const,
          repeat_every: 1,
          time: time,
          end_type: 'never' as const
        };
    }
  }
} 