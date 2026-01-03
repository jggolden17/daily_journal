// Backend metric schema matching
export interface Metric {
  id: string;
  thread_id: string;
  asleep_by: string | null; // ISO datetime string
  awoke_at: string | null; // ISO datetime string
  out_of_bed_at: string | null; // ISO datetime string
  sleep_quality: number | null;
  physical_activity: number | null; // minutes or intensity score
  overall_mood: number | null;
  paid_productivity: number | null;
  personal_productivity: number | null;
  additional_metrics: Record<string, unknown> | null;
  created_at: string; // ISO datetime string
  updated_at: string; // ISO datetime string
}

// Frontend-friendly metric structure for a specific date
export interface DailyMetrics {
  date: string; // ISO date string (YYYY-MM-DD)
  thread_id?: string;
  asleep_by?: string | null; // ISO datetime string
  awoke_at?: string | null; // ISO datetime string
  out_of_bed_at?: string | null; // ISO datetime string
  sleep_quality?: number | null; // 1-7 scale
  physical_activity?: number | null; // 1-7 scale
  overall_mood?: number | null; // 1-7 scale
  paid_productivity?: number | null;
  personal_productivity?: number | null;
}

export interface MetricsSummary {
  from: string; // ISO date string
  to: string; // ISO date string
  averages: {
    sleep_quality?: number;
    physical_activity?: number;
    overall_mood?: number;
    paid_productivity?: number;
    personal_productivity?: number;
    [key: string]: number | undefined;
  };
  data: DailyMetrics[];
}

