/**
 * A1Cron Types
 * 
 * Type definitions for A1Base's cron job scheduling system
 */

// Schedule Configuration Types
export type RepeatType = 'hourly' | 'days' | 'weeks' | 'months';
export type EndType = 'never' | 'on' | 'after';

export interface ScheduleConfig {
  repeat_type: RepeatType;
  repeat_every: number;
  time: string; // Format: "HH:MM"
  days_of_week?: string[]; // ["1", "2", "3", "4", "5"] for weekdays
  end_type: EndType;
  end_date?: string; // ISO date string
  end_occurrences?: number;
}

// Retry Configuration
export interface RetryConfig {
  max_retries: number; // 0-10
  retry_delay_seconds: number;
  timeout_seconds: number;
}

// Callback Configuration
export interface CallbackConfig {
  success_url?: string;
  failure_url?: string;
}

// Cron Job Request/Response Types
export interface CreateCronJobRequest {
  name: string;
  description?: string;
  endpoint_url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  timezone: string; // e.g., "America/New_York", "UTC"
  schedule_config: ScheduleConfig;
  retry_config?: RetryConfig;
  callbacks?: CallbackConfig;
  tags?: string[];
  is_active?: boolean;
}

export interface UpdateCronJobRequest {
  name?: string;
  description?: string;
  endpoint_url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  timezone?: string;
  schedule_config?: ScheduleConfig;
  retry_config?: RetryConfig;
  callbacks?: CallbackConfig;
  tags?: string[];
  is_active?: boolean;
}

export interface CronJob {
  id: string;
  name: string;
  description?: string;
  endpoint_url: string;
  schedule: string; // Cron expression
  method: string;
  headers?: Record<string, string>;
  body?: string;
  timezone: string;
  schedule_config: ScheduleConfig;
  retry_config?: RetryConfig;
  callbacks?: CallbackConfig;
  tags: string[];
  is_active: boolean;
  next_run_at?: string; // ISO date string
  last_run_at?: string; // ISO date string
  created_at: string;
  updated_at: string;
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
}

// Execution Log Types
export type ExecutionStatus = 'success' | 'failure' | 'timeout' | 'retry';

export interface ExecutionLog {
  id: string;
  cron_job_id: string;
  execution_id: string;
  status: ExecutionStatus;
  response_code?: number;
  response_body?: string;
  error_message?: string;
  response_time_ms?: number;
  executed_at: string;
  retry_attempt?: number;
}

// API Response Types
export interface A1CronResponse<T = any> {
  data: T;
  success?: boolean;
  error?: string;
}

export interface ListCronJobsResponse {
  data: CronJob[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

export interface TriggerExecutionResponse {
  data: {
    execution_id: string;
    status: ExecutionStatus;
    response_code?: number;
    response_body?: string;
    executed_at: string;
  };
}

// Webhook Callback Payload
export interface CronWebhookPayload {
  cron_job_id: string;
  execution_id: string;
  status: 'success' | 'failure';
  executed_at: string;
  response_code?: number;
  response_time_ms?: number;
  error_message?: string;
}

// Query Parameters
export interface ListCronJobsParams {
  page?: number;
  limit?: number;
  is_active?: boolean;
  tags?: string[];
  search?: string;
}

export interface GetExecutionLogsParams {
  limit?: number;
  status?: ExecutionStatus;
  start_date?: string;
  end_date?: string;
} 