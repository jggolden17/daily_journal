interface ColoredScaleSelectProps {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  label: string;
}

// Color gradient from black (1) to orange/amber (3-4) to green (7)
// Using neutral, muted tones
export const getColorForValue = (value: number): string => {
  if (value === 1) return '#2d2d2d'; // Dark gray/black
  if (value === 2) return '#525252'; // Medium dark gray
  if (value === 3) return '#c9730a'; // Muted amber/orange
  if (value === 4) return '#d97706'; // Amber
  if (value === 5) return '#84a31a'; // Muted yellow-green
  if (value === 6) return '#5a8a0a'; // Muted green
  if (value === 7) return '#15803d'; // Muted bright green
  return '#ffffff'; // White for empty
};

const getTextColorForValue = (value: number | null): string => {
  if (!value) return '#374151'; // Gray text for empty
  if (value <= 2) return '#ffffff'; // White text for dark backgrounds
  if (value <= 4) return '#ffffff'; // White text for orange backgrounds
  return '#ffffff'; // White text for green backgrounds
};

export function ColoredScaleSelect({ value, onChange, label }: ColoredScaleSelectProps) {
  const options = [
    { val: null, label: 'Select...' },
    { val: 1, label: '1' },
    { val: 2, label: '2' },
    { val: 3, label: '3' },
    { val: 4, label: '4' },
    { val: 5, label: '5' },
    { val: 6, label: '6' },
    { val: 7, label: '7' },
  ];

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : null)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        style={{
          backgroundColor: value ? getColorForValue(value) : 'white',
          color: getTextColorForValue(value ?? null),
        }}
      >
        {options.map((option) => (
          <option
            key={option.val ?? 'empty'}
            value={option.val ?? ''}
            style={{
              backgroundColor: option.val ? getColorForValue(option.val) : 'white',
              color: getTextColorForValue(option.val),
            }}
          >
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

