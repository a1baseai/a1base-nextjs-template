/**
 * A1Cron Service
 * 
 * Service for managing cron jobs through A1Base's A1Cron API
 */

import {
  CronJob,
  CreateCronJobRequest,
  UpdateCronJobRequest,
  ListCronJobsParams,
  GetExecutionLogsParams,
  ListCronJobsResponse,
  TriggerExecutionResponse,
  ExecutionLog,
  A1CronResponse
} from './types';

// Base configuration
const A1CRON_BASE_URL = 'https://api.a1base.com/v1/cron-jobs';

export class A1CronService {
  private apiKey: string;
  private apiSecret: string;
  private accountId: string;

  constructor(config: {
    apiKey: string;
    apiSecret: string;
    accountId: string;
  }) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.accountId = config.accountId;
  }

  /**
   * Helper method to make authenticated requests to A1Cron API
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${A1CRON_BASE_URL}/${this.accountId}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'X-API-Key': this.apiKey,
        'X-API-Secret': this.apiSecret,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`A1Cron API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * List all cron jobs
   * GET /v1/cron-jobs/{accountId}/list
   */
  async listCronJobs(params?: ListCronJobsParams): Promise<ListCronJobsResponse> {
    const queryParams = new URLSearchParams();
    
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.is_active !== undefined) queryParams.append('is_active', params.is_active.toString());
    if (params?.tags?.length) queryParams.append('tags', params.tags.join(','));
    if (params?.search) queryParams.append('search', params.search);

    const endpoint = `/list${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    
    return this.makeRequest<ListCronJobsResponse>(endpoint, {
      method: 'GET',
    });
  }

  /**
   * Get details of a specific cron job
   * GET /v1/cron-jobs/{accountId}/details/{cron_job_id}
   */
  async getCronJobDetails(cronJobId: string): Promise<A1CronResponse<CronJob>> {
    return this.makeRequest<A1CronResponse<CronJob>>(`/details/${cronJobId}`, {
      method: 'GET',
    });
  }

  /**
   * Create a new cron job
   * POST /v1/cron-jobs/{accountId}/create
   */
  async createCronJob(data: CreateCronJobRequest): Promise<A1CronResponse<CronJob>> {
    // Set default values
    const defaultScheduleConfig = {
      end_type: 'never' as const,
    };
    
    const requestData = {
      is_active: true,
      ...data,
      schedule_config: {
        ...defaultScheduleConfig,
        ...data.schedule_config,
      },
    };

    return this.makeRequest<A1CronResponse<CronJob>>('/create', {
      method: 'POST',
      body: JSON.stringify(requestData),
    });
  }

  /**
   * Update an existing cron job
   * PATCH /v1/cron-jobs/{accountId}/update/{cron_job_id}
   */
  async updateCronJob(
    cronJobId: string,
    data: UpdateCronJobRequest
  ): Promise<A1CronResponse<CronJob>> {
    return this.makeRequest<A1CronResponse<CronJob>>(`/update/${cronJobId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a cron job
   * DELETE /v1/cron-jobs/{accountId}/delete/{cron_job_id}
   */
  async deleteCronJob(cronJobId: string): Promise<A1CronResponse<{ message: string }>> {
    return this.makeRequest<A1CronResponse<{ message: string }>>(`/delete/${cronJobId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Manually trigger a cron job
   * POST /v1/cron-jobs/{accountId}/trigger/{cron_job_id}
   */
  async triggerCronJob(cronJobId: string): Promise<TriggerExecutionResponse> {
    return this.makeRequest<TriggerExecutionResponse>(`/trigger/${cronJobId}`, {
      method: 'POST',
    });
  }

  /**
   * Get execution logs for a cron job
   * GET /v1/cron-jobs/{accountId}/logs/{cron_job_id}
   */
  async getExecutionLogs(
    cronJobId: string,
    params?: GetExecutionLogsParams
  ): Promise<A1CronResponse<ExecutionLog[]>> {
    const queryParams = new URLSearchParams();
    
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);

    const endpoint = `/logs/${cronJobId}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    
    return this.makeRequest<A1CronResponse<ExecutionLog[]>>(endpoint, {
      method: 'GET',
    });
  }

  /**
   * Helper method to create a daily cron job
   */
  async createDailyCronJob(config: {
    name: string;
    description?: string;
    endpoint_url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    headers?: Record<string, string>;
    body?: string;
    time: string; // "HH:MM"
    timezone: string;
    retry_config?: {
      max_retries?: number;
      retry_delay_seconds?: number;
      timeout_seconds?: number;
    };
    callbacks?: {
      success_url?: string;
      failure_url?: string;
    };
    tags?: string[];
  }): Promise<A1CronResponse<CronJob>> {
    return this.createCronJob({
      name: config.name,
      description: config.description,
      endpoint_url: config.endpoint_url,
      method: config.method || 'POST',
      headers: config.headers,
      body: config.body,
      timezone: config.timezone,
      schedule_config: {
        repeat_type: 'days',
        repeat_every: 1,
        time: config.time,
        end_type: 'never',
      },
      retry_config: {
        max_retries: config.retry_config?.max_retries || 3,
        retry_delay_seconds: config.retry_config?.retry_delay_seconds || 300,
        timeout_seconds: config.retry_config?.timeout_seconds || 30,
      },
      callbacks: config.callbacks,
      tags: config.tags,
      is_active: true,
    });
  }

  /**
   * Helper method to create an hourly cron job
   */
  async createHourlyCronJob(config: {
    name: string;
    description?: string;
    endpoint_url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    headers?: Record<string, string>;
    body?: string;
    repeat_every: number; // Run every N hours
    time: string; // Minutes past the hour "MM:SS"
    timezone: string;
    retry_config?: {
      max_retries?: number;
      retry_delay_seconds?: number;
      timeout_seconds?: number;
    };
    callbacks?: {
      success_url?: string;
      failure_url?: string;
    };
    tags?: string[];
  }): Promise<A1CronResponse<CronJob>> {
    return this.createCronJob({
      name: config.name,
      description: config.description,
      endpoint_url: config.endpoint_url,
      method: config.method || 'POST',
      headers: config.headers,
      body: config.body,
      timezone: config.timezone,
      schedule_config: {
        repeat_type: 'hourly',
        repeat_every: config.repeat_every,
        time: config.time,
        end_type: 'never',
      },
      retry_config: {
        max_retries: config.retry_config?.max_retries || 3,
        retry_delay_seconds: config.retry_config?.retry_delay_seconds || 60,
        timeout_seconds: config.retry_config?.timeout_seconds || 30,
      },
      callbacks: config.callbacks,
      tags: config.tags,
      is_active: true,
    });
  }

  /**
   * Helper method to pause/unpause a cron job
   */
  async toggleCronJob(cronJobId: string, isActive: boolean): Promise<A1CronResponse<CronJob>> {
    return this.updateCronJob(cronJobId, { is_active: isActive });
  }
}

// Singleton instance for easy access
let a1CronInstance: A1CronService | null = null;

/**
 * Get or create the A1Cron service instance
 */
export function getA1Cron(): A1CronService {
  if (!a1CronInstance) {
    const apiKey = process.env.A1BASE_API_KEY;
    const apiSecret = process.env.A1BASE_API_SECRET;
    const accountId = process.env.A1BASE_ACCOUNT_ID;

    if (!apiKey || !apiSecret || !accountId) {
      throw new Error('A1Cron requires A1BASE_API_KEY, A1BASE_API_SECRET, and A1BASE_ACCOUNT_ID environment variables');
    }

    a1CronInstance = new A1CronService({
      apiKey,
      apiSecret,
      accountId,
    });
  }

  return a1CronInstance;
} 