import { useState } from 'react';
import { MetricsChart } from '../components/metrics/MetricsChart';
import { useMetricsSummary } from '../hooks/useMetrics';

export function MetricsPage() {
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    to: new Date().toISOString().split('T')[0], // today
  });

  const { summary, loading } = useMetricsSummary(dateRange.from, dateRange.to);

  const handleDateChange = (field: 'from' | 'to', value: string) => {
    setDateRange((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return <div className="text-center p-8">Loading metrics...</div>;
  }

  if (!summary || summary.data.length === 0) {
    return (
      <div className="px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Metrics</h1>
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          No metrics data available for the selected date range.
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Metrics</h1>

      {/* Date Range Selector */}
      <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
        <div className="flex items-center space-x-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From
            </label>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => handleDateChange('from', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To
            </label>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => handleDateChange('to', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
      </div>

      {/* Averages Summary */}
      {summary.averages && Object.keys(summary.averages).length > 0 && (
        <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Averages</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {summary.averages.sleep_quality !== undefined && (
              <div>
                <div className="text-sm text-gray-600">Sleep Quality</div>
                <div className="text-2xl font-bold">{summary.averages.sleep_quality.toFixed(1)}</div>
              </div>
            )}
            {summary.averages.physical_activity !== undefined && (
              <div>
                <div className="text-sm text-gray-600">Physical Activity</div>
                <div className="text-2xl font-bold">{summary.averages.physical_activity.toFixed(1)}</div>
              </div>
            )}
            {summary.averages.overall_mood !== undefined && (
              <div>
                <div className="text-sm text-gray-600">Mood</div>
                <div className="text-2xl font-bold">{summary.averages.overall_mood.toFixed(1)}</div>
              </div>
            )}
            {summary.averages.hours_paid_work !== undefined && (
              <div>
                <div className="text-sm text-gray-600">Paid Work (hrs)</div>
                <div className="text-2xl font-bold">{summary.averages.hours_paid_work.toFixed(1)}</div>
              </div>
            )}
            {summary.averages.hours_personal_work !== undefined && (
              <div>
                <div className="text-sm text-gray-600">Personal Work (hrs)</div>
                <div className="text-2xl font-bold">{summary.averages.hours_personal_work.toFixed(1)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="space-y-6">
        {summary.data.some((d) => d.sleep_quality !== undefined && d.sleep_quality !== null) && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <MetricsChart
              data={summary.data}
              metricKey="sleep_quality"
              label="Sleep Quality"
              color="#8884d8"
            />
          </div>
        )}

        {summary.data.some((d) => d.physical_activity !== undefined && d.physical_activity !== null) && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <MetricsChart
              data={summary.data}
              metricKey="physical_activity"
              label="Physical Activity"
              color="#82ca9d"
            />
          </div>
        )}

        {summary.data.some((d) => d.overall_mood !== undefined && d.overall_mood !== null) && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <MetricsChart
              data={summary.data}
              metricKey="overall_mood"
              label="Overall Mood"
              color="#ff7300"
            />
          </div>
        )}

        {summary.data.some((d) => d.hours_paid_work !== undefined && d.hours_paid_work !== null) && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <MetricsChart
              data={summary.data}
              metricKey="hours_paid_work"
              label="Hours Paid Work"
              color="#ffc658"
            />
          </div>
        )}

        {summary.data.some((d) => d.hours_personal_work !== undefined && d.hours_personal_work !== null) && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <MetricsChart
              data={summary.data}
              metricKey="hours_personal_work"
              label="Hours Personal Work"
              color="#00ff00"
            />
          </div>
        )}
      </div>
    </div>
  );
}

