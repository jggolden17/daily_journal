import { getColorForValue } from './ColoredScaleSelect';

interface MetricsSliderProps {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  label: string;
}

export function MetricsSlider({ value, onChange, label }: MetricsSliderProps) {
  const displayValue = value ?? 1;
  const color = getColorForValue(displayValue);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        <div
          className="px-3 py-1 rounded-md text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: color }}
        >
          {value ?? '--'}
        </div>
      </div>
      <input
        type="range"
        min="1"
        max="7"
        step="1"
        value={displayValue}
        onChange={(e) => {
          const newValue = parseInt(e.target.value);
          onChange(newValue);
        }}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color} 0%, ${color} ${((displayValue - 1) / 6) * 100}%, #e5e7eb ${((displayValue - 1) / 6) * 100}%, #e5e7eb 100%)`,
        }}
      />
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>1</span>
        <span>7</span>
      </div>
    </div>
  );
}
