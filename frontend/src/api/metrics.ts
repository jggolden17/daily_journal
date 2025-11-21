import { apiClient } from './client';
import { threadsApi } from './threads';
import type { DailyMetrics, MetricsSummary, Metric } from '../types/metrics';

// Backend response types
interface SingleItemResponse<T> {
  data: T | null;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface MetricResponse {
  id: string;
  thread_id: string;
  asleep_by: string | null;
  awoke_at: string | null;
  sleep_quality: number | null;
  physical_activity: number | null;
  overall_mood: number | null;
  hours_paid_work: number | null;
  hours_personal_work: number | null;
  additional_metrics: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// Helper to convert backend metric to frontend format
function metricToDailyMetrics(metric: MetricResponse, date: string): DailyMetrics {
  return {
    date,
    thread_id: metric.thread_id,
    asleep_by: metric.asleep_by,
    awoke_at: metric.awoke_at,
    sleep_quality: metric.sleep_quality,
    physical_activity: metric.physical_activity,
    overall_mood: metric.overall_mood,
    hours_paid_work: metric.hours_paid_work,
    hours_personal_work: metric.hours_personal_work,
  };
}

// Helper to convert frontend metrics to backend format
function dailyMetricsToMetricCreate(
  metrics: DailyMetrics,
  thread_id: string
): Omit<MetricResponse, 'id' | 'created_at' | 'updated_at'> {
  return {
    thread_id,
    asleep_by: metrics.asleep_by || null,
    awoke_at: metrics.awoke_at || null,
    sleep_quality: metrics.sleep_quality ?? null,
    physical_activity: metrics.physical_activity ?? null,
    overall_mood: metrics.overall_mood ?? null,
    hours_paid_work: metrics.hours_paid_work ?? null,
    hours_personal_work: metrics.hours_personal_work ?? null,
    additional_metrics: null,
  };
}

export const metricsApi = {
  /**
   * Get metrics for a specific date
   */
  async getDaily(date: string): Promise<DailyMetrics | null> {
    // First, get or create the thread for this date
    const thread = await threadsApi.getOrCreateThread(date);
    
    // Get all metrics and filter by thread_id
    // Note: In a production app, you'd want a dedicated endpoint like /metrics/thread/{thread_id}
    const response = await apiClient.get<PaginatedResponse<MetricResponse>>(
      `/latest/metrics?page=1&page_size=100`
    );
    
    const metric = response.data.find((m) => m.thread_id === thread.id);
    
    if (!metric) {
      return null;
    }
    
    return metricToDailyMetrics(metric, date);
  },

  /**
   * Save metrics for a specific date (uses upsert)
   */
  async saveDaily(date: string, metrics: DailyMetrics): Promise<DailyMetrics> {
    // Get or create the thread for this date
    const thread = await threadsApi.getOrCreateThread(date);
    
    // Use upsert to create or update the metric
    const metricData = dailyMetricsToMetricCreate(metrics, thread.id);
    
    const response = await apiClient.post<SingleItemResponse<MetricResponse[]>>(
      '/latest/metrics/upsert',
      [metricData]
    );
    
    if (!response.data || response.data.length === 0) {
      throw new Error('Failed to save metrics: no data returned');
    }
    
    return metricToDailyMetrics(response.data[0], date);
  },

  /**
   * Get metrics summary for a date range
   */
  async getSummary(from: string, to: string): Promise<MetricsSummary> {
    // Get all metrics (in production, you'd want date filtering on the backend)
    const response = await apiClient.get<PaginatedResponse<MetricResponse>>(
      `/latest/metrics?page=1&page_size=1000`
    );
    
    // Get all threads to map thread_id to date
    const threadsResponse = await apiClient.get<PaginatedResponse<{ id: string; date: string }>>(
      `/latest/threads?page=1&page_size=1000`
    );
    
    const threadDateMap = new Map(
      threadsResponse.data.map((t) => [t.id, t.date])
    );
    
    // Filter metrics by date range and convert to DailyMetrics
    const data: DailyMetrics[] = response.data
      .map((metric) => {
        const date = threadDateMap.get(metric.thread_id);
        if (!date || date < from || date > to) {
          return null;
        }
        return metricToDailyMetrics(metric, date);
      })
      .filter((m): m is DailyMetrics => m !== null);
    
    // Calculate averages
    const averages: MetricsSummary['averages'] = {};
    if (data.length > 0) {
      const numericFields = [
        'sleep_quality',
        'physical_activity',
        'overall_mood',
        'hours_paid_work',
        'hours_personal_work',
      ] as const;
      
      numericFields.forEach((field) => {
        const values = data
          .map((d) => d[field])
          .filter((v): v is number => typeof v === 'number' && v !== null);
        if (values.length > 0) {
          averages[field] = values.reduce((a, b) => a + b, 0) / values.length;
        }
      });
    }

    return {
      from,
      to,
      averages,
      data,
    };
  },
};

