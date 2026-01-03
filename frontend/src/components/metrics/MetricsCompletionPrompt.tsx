import { useEffect, useRef } from 'react';
import { formatDisplayDate } from '../../utils/dateFormatting';

interface MetricsCompletionPromptProps {
  isOpen: boolean;
  onClose: () => void;
  savedDate: string; // YYYY-MM-DD format
  missingCount: number;
  onConfirm: () => void;
}

export function MetricsCompletionPrompt({
  isOpen,
  onClose,
  savedDate,
  missingCount,
  onConfirm,
}: MetricsCompletionPromptProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Handle outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formattedDate = formatDisplayDate(savedDate);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-25 z-40" />
      
      {/* Popup */}
      <div
        ref={popupRef}
        className="fixed z-50 bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-auto"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      >
        <h2 className="text-xl font-semibold mb-4">Metrics Saved</h2>
        
        <p className="text-gray-700 mb-6">
          Metrics saved for {formattedDate}. {missingCount === 1 
            ? `There is 1 day from the previous week missing metrics.` 
            : `There are ${missingCount} days from the previous week missing metrics.`} Would you like to add {missingCount === 1 ? 'it' : 'them'}?
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
            type="button"
          >
            No
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            type="button"
          >
            Yes
          </button>
        </div>
      </div>
    </>
  );
}

