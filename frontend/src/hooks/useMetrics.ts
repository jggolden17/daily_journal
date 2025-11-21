import { useState, useEffect, useCallback } from 'react';
import { metricsApi } from '../api/metrics';
import type { DailyMetrics, MetricsSummary } from '../types/metrics';

export function useMetrics(date: string) {
  const [metrics, setMetrics] = useState<DailyMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMetrics();
  }, [date]);

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const data = await metricsApi.getDaily(date);
      setMetrics(data || { date });
    } catch (error) {
      console.error('Failed to load metrics:', error);
    } finally {
      setLoading(false);
    }
  }, [date]);

  const saveMetrics = useCallback(async (updatedMetrics: DailyMetrics) => {
    setSaving(true);
    try {
      const saved = await metricsApi.saveDaily(date, updatedMetrics);
      setMetrics(saved);
      return saved;
    } catch (error) {
      console.error('Failed to save metrics:', error);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [date]);

  return {
    metrics,
    loading,
    saving,
    saveMetrics,
    refresh: loadMetrics,
  };
}

export function useMetricsSummary(from: string, to: string) {
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummary();
  }, [from, to]);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const data = await metricsApi.getSummary(from, to);
      setSummary(data);
    } catch (error) {
      console.error('Failed to load metrics summary:', error);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  return {
    summary,
    loading,
    refresh: loadSummary,
  };
}

