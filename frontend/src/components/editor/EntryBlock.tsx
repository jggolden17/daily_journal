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
  onSave: (content: string, isManualSave?: boolean) => void;
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
  placeholder = 'Start writing...',
  showSeparator = false,
  showSeparatorAbove = false,
  timestampOverride = null,
  autoSaveDelay = 2000,
}, ref) => {
  const [localValue, setLocalValue] = useState(value);
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
          onSave(content, false);
        }, autoSaveDelay);
      }
    },
    [autoSaveDelay, onChange, onSave]
  );

  const handleSaveNow = useCallback(
    (content: string) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      // This is a manual save (cmd-enter)
      onSave(content, true);
    },
    [onSave]
  );

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
        <div className="text-xs font-semibold text-gray-400 mb-1">
          {entry ? formatTime(entry.createdAt) : timestampOverride ? formatTime(timestampOverride) : ''}
        </div>
      )}
      <TipTapEditor
        ref={editorRef}
        value={localValue}
        onChange={handleChange}
        onSave={handleSaveNow}
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
