import { useCallback, useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import type { JournalEntry } from '../../types/journal';
import { TipTapEditor, type TipTapEditorHandle } from './TipTapEditor';

export interface EntryBlockHandle {
  focus: () => void;
}

interface EntryBlockProps {
  entry: JournalEntry | null;
  value: string;
  onChange: (content: string) => void;
  onSave: (content: string, isManualSave?: boolean, writtenAt?: string) => void;
  onDelete?: (id: string) => Promise<void>;
  onTypingChange?: (isTyping: boolean) => void;
  placeholder?: string;
  showSeparator?: boolean;
  showSeparatorAbove?: boolean;
  timestampOverride?: string | null;
  autoSaveDelay?: number;
}

function formatTime(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export const EntryBlock = forwardRef<EntryBlockHandle, EntryBlockProps>(({
  entry,
  value,
  onChange,
  onSave,
  onDelete,
  onTypingChange,
  placeholder = 'Start writing...',
  showSeparator = false,
  showSeparatorAbove = false,
  timestampOverride = null,
  autoSaveDelay = 2000,
}, ref) => {
  const [localValue, setLocalValue] = useState(value);
  const [isEditingTimestamp, setIsEditingTimestamp] = useState(false);
  const [timeValue, setTimeValue] = useState(() => {
    const timestamp = entry?.writtenAt || timestampOverride;
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  });
  const originalDateRef = useRef<Date | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const lastPropValueRef = useRef(value);
  const editorRef = useRef<TipTapEditorHandle>(null);

  // Expose focus method via ref
  useImperativeHandle(ref, () => ({
    focus: () => {
      editorRef.current?.focus();
    },
  }), []);

  // Keep local value in sync with prop when it changes externally (e.g., refresh)
  useEffect(() => {
    if (value !== lastPropValueRef.current) {
      setLocalValue(value);
      lastPropValueRef.current = value;
    }
  }, [value]);

  // Sync timestamp when entry changes (but not when editing timestamp)
  // Use a ref to track if we're actively editing to prevent reset during async updates
  const isActivelyEditingRef = useRef(false);
  
  useEffect(() => {
    if (!isEditingTimestamp && !isActivelyEditingRef.current) {
      const timestamp = entry?.writtenAt || timestampOverride;
      if (timestamp) {
        const date = new Date(timestamp);
        originalDateRef.current = date;
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        setTimeValue(`${hours}:${minutes}`);
      }
    }
  }, [entry?.writtenAt, timestampOverride, isEditingTimestamp]);

  const handleChange = useCallback(
    (content: string) => {
      setLocalValue(content);
      onChange(content);

      // Debounced save per block (autosave, not manual)
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (content.trim()) {
        saveTimeoutRef.current = window.setTimeout(() => {
          // Include timestamp if it was edited
          let writtenAt: string | undefined;
          if (isEditingTimestamp && timeValue && originalDateRef.current) {
            const [hours, minutes] = timeValue.split(':').map(Number);
            if (!isNaN(hours) && !isNaN(minutes)) {
              const newDate = new Date(originalDateRef.current);
              newDate.setHours(hours, minutes, 0, 0);
              writtenAt = newDate.toISOString();
            }
          }
          onSave(content, false, writtenAt);
        }, autoSaveDelay);
      }
    },
    [autoSaveDelay, onChange, onSave, isEditingTimestamp, timeValue]
  );

  const handleSaveNow = useCallback(
    async (content: string) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      // Include timestamp if it was edited - combine original date with new time
      let writtenAt: string | undefined;
      if (isEditingTimestamp && timeValue && originalDateRef.current) {
        const [hours, minutes] = timeValue.split(':').map(Number);
        if (!isNaN(hours) && !isNaN(minutes)) {
          const newDate = new Date(originalDateRef.current);
          newDate.setHours(hours, minutes, 0, 0);
          writtenAt = newDate.toISOString();
        }
      }
      // This is a manual save (cmd-enter)
      // Keep editing state active during save to prevent reset from useEffect
      try {
        await onSave(content, true, writtenAt);
      } finally {
        // Reset editing state after save completes
        isActivelyEditingRef.current = false;
        setIsEditingTimestamp(false);
      }
    },
    [onSave, isEditingTimestamp, timeValue]
  );

  const handleDelete = useCallback(async () => {
    if (!entry || !onDelete) return;
    if (window.confirm('Are you sure you want to delete this entry?')) {
      try {
        await onDelete(entry.id);
      } catch (error) {
        console.error('Failed to delete entry:', error);
      }
    }
  }, [entry, onDelete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="w-full">
      {showSeparatorAbove && (
        <hr className="border-0 border-t-2 border-gray-200 mt-3 mb-3" aria-hidden="true" />
      )}
      {(entry || timestampOverride) && (
        <div className="text-xs font-semibold text-gray-400 mb-1 flex items-center gap-2">
          {isEditingTimestamp ? (
            <>
              <input
                type="time"
                value={timeValue}
                onChange={(e) => setTimeValue(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-xs"
                autoFocus
                onBlur={() => {
                  // Save when losing focus if there's content
                  if (localValue.trim() && entry && timeValue && originalDateRef.current) {
                    const [hours, minutes] = timeValue.split(':').map(Number);
                    if (!isNaN(hours) && !isNaN(minutes)) {
                      handleSaveNow(localValue);
                    } else {
                      isActivelyEditingRef.current = false;
                      setIsEditingTimestamp(false);
                    }
                  } else {
                    isActivelyEditingRef.current = false;
                    setIsEditingTimestamp(false);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (localValue.trim() && entry) {
                      handleSaveNow(localValue);
                    } else {
                      isActivelyEditingRef.current = false;
                      setIsEditingTimestamp(false);
                    }
                  } else if (e.key === 'Escape') {
                    isActivelyEditingRef.current = false;
                    setIsEditingTimestamp(false);
                  }
                }}
              />
              <span className="text-xs text-gray-500">Press Enter to save</span>
              {entry && onDelete && (
                <button
                  onMouseDown={(e) => {
                    // Prevent blur on the input when clicking delete button
                    e.preventDefault();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete();
                  }}
                  className="px-2 py-1 text-xs text-red-600 hover:text-red-800 border border-red-600 rounded hover:bg-red-50"
                >
                  Delete
                </button>
              )}
            </>
          ) : (
            <>
              <span 
                className="cursor-pointer hover:text-gray-600" 
                onClick={() => {
                  if (entry || timestampOverride) {
                    const timestamp = entry?.writtenAt || timestampOverride;
                    if (timestamp) {
                      originalDateRef.current = new Date(timestamp);
                    }
                    isActivelyEditingRef.current = true;
                    setIsEditingTimestamp(true);
                  }
                }}
              >
                {entry ? formatTime(entry.writtenAt) : timestampOverride ? formatTime(timestampOverride) : ''}
              </span>
              {entry && (
                <span 
                  className="text-gray-300 text-[10px] cursor-pointer hover:text-gray-500" 
                  onClick={() => {
                    const timestamp = entry?.writtenAt || timestampOverride;
                    if (timestamp) {
                      originalDateRef.current = new Date(timestamp);
                    }
                    isActivelyEditingRef.current = true;
                    setIsEditingTimestamp(true);
                  }}
                >
                  (edit)
                </span>
              )}
            </>
          )}
        </div>
      )}
      <TipTapEditor
        ref={editorRef}
        value={localValue}
        onChange={handleChange}
        onSave={handleSaveNow}
        onTypingChange={onTypingChange}
        placeholder={placeholder}
        autoSaveDelay={autoSaveDelay}
        fullScreen={false}
        noBorder={true}
      />
      {showSeparator && (
        <hr className="border-0 border-t-[1.75px] border-gray-300 mt-3 mb-3" aria-hidden="true" />
      )}
    </div>
  );
});
