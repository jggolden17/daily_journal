import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { DailyMetrics } from '../../types/metrics';

interface MetricsChartProps {
  data: DailyMetrics[];
  metricKey: keyof DailyMetrics;
  label: string;
  color?: string;
}

export function MetricsChart({ data, metricKey, label, color = '#8884d8' }: MetricsChartProps) {
  const chartData = data
    .filter(
      (d) =>
        d[metricKey] !== undefined &&
        d[metricKey] !== null &&
        typeof d[metricKey] === 'number'
    )
    .map((d) => ({
      date: d.date,
      value: d[metricKey] as number,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (chartData.length === 0) {
    return (
      <div className="text-center p-8 text-gray-400">
        No data available for {label}
      </div>
    );
  }

  return (
    <div className="w-full h-64">
      <h3 className="text-lg font-semibold mb-2">{label}</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          />
          <YAxis />
          <Tooltip 
            labelFormatter={(value) => new Date(value).toLocaleDateString()}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke={color} 
            name={label}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

