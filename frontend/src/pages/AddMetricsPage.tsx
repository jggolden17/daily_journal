import { useMetrics } from '../hooks/useMetrics';
import { ColoredScaleSelect } from '../components/metrics/ColoredScaleSelect';
import type { DailyMetrics } from '../types/metrics';

export function AddMetricsPage() {
  const today = new Date().toISOString().split('T')[0];
  const { metrics, loading: metricsLoading, saveMetrics } = useMetrics(today);

  const handleMetricsChange = async (
    field: keyof DailyMetrics,
    value: number | string | null | Record<string, unknown>
  ) => {
    const updated: DailyMetrics = {
      ...(metrics || {}),
      date: today,
      [field]: value,
    };
    try {
      await saveMetrics(updated);
    } catch (error) {
      console.error('Failed to save metrics:', error);
    }
  };

  const handleDateTimeChange = async (
    field: 'asleep_by' | 'awoke_at',
    value: string
  ) => {
    // Convert date string to ISO datetime string
    const dateTime = value ? new Date(value).toISOString() : null;
    await handleMetricsChange(field, dateTime);
  };

  return (
    <div className="px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Add Metrics</h1>

      {metricsLoading ? (
        <div className="py-4">Loading metrics...</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="space-y-6">
            {/* Sleep Section */}
            <div>
              <h3 className="text-md font-medium text-gray-800 mb-3">Sleep</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Asleep By
                  </label>
                  <input
                    type="datetime-local"
                    value={
                      metrics?.asleep_by
                        ? new Date(metrics.asleep_by).toISOString().slice(0, 16)
                        : ''
                    }
                    onChange={(e) => handleDateTimeChange('asleep_by', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Awoke At
                  </label>
                  <input
                    type="datetime-local"
                    value={
                      metrics?.awoke_at
                        ? new Date(metrics.awoke_at).toISOString().slice(0, 16)
                        : ''
                    }
                    onChange={(e) => handleDateTimeChange('awoke_at', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <ColoredScaleSelect
                  value={metrics?.sleep_quality}
                  onChange={(value) => handleMetricsChange('sleep_quality', value)}
                  label="Sleep Quality"
                />
              </div>
            </div>

            {/* Activity & Mood Section */}
            <div>
              <h3 className="text-md font-medium text-gray-800 mb-3">Activity & Mood</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ColoredScaleSelect
                  value={metrics?.physical_activity}
                  onChange={(value) => handleMetricsChange('physical_activity', value)}
                  label="Physical Activity"
                />
                <ColoredScaleSelect
                  value={metrics?.overall_mood}
                  onChange={(value) => handleMetricsChange('overall_mood', value)}
                  label="Overall Mood"
                />
              </div>
            </div>

            {/* Work Section */}
            <div>
              <h3 className="text-md font-medium text-gray-800 mb-3">Work</h3>
              <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hours Paid Work
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={metrics?.hours_paid_work ?? ''}
                    onChange={(e) =>
                      handleMetricsChange(
                        'hours_paid_work',
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hours Personal Work
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={metrics?.hours_personal_work ?? ''}
                    onChange={(e) =>
                      handleMetricsChange(
                        'hours_personal_work',
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

