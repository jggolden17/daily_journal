interface SyncIconProps {
  isSaving: boolean;
  hasUnsavedChanges: boolean;
}

export function SyncIcon({ isSaving, hasUnsavedChanges }: SyncIconProps) {
  // Determine color based on state
  let colorClass = 'text-gray-200'; // Default: synced (no changes)
  
  if (hasUnsavedChanges && !isSaving) {
    colorClass = 'text-red-300'; // Light red when there are unsaved changes
  } else if (isSaving) {
    colorClass = 'text-gray-200'; // Gray when saving (will spin)
  }

  return (
    <svg
      className={`w-5 h-5 ${colorClass} ${isSaving ? 'sync-icon-spin' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}
