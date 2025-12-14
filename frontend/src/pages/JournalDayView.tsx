import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { EntryBlock } from '../components/editor/EntryBlock';
import { useTodayEntry } from '../hooks/useTodayEntry';
import { DateHeader } from '../components/layout/DateHeader';
import { MetricsIconButton } from '../components/metrics/MetricsIconButton';
import { MetricsPopup } from '../components/metrics/MetricsPopup';
import { useMetrics } from '../hooks/useMetrics';

interface JournalDayViewProps {
  date: string;
  loadingMessage?: string;
  fullScreen?: boolean;
}

function normalizeDate(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().split('T')[0];
  }
  return parsed.toISOString().split('T')[0];
}

export function JournalDayView({ date, loadingMessage = 'Loading entries...', fullScreen = true }: JournalDayViewProps) {
  const targetDate = useMemo(() => normalizeDate(date), [date]);
  const { entries, loading, saving, createEntry, updateEntry, deleteEntry, refresh } = useTodayEntry(targetDate);
  const { metrics, loading: metricsLoading, saving: metricsSaving, saveMetrics } = useMetrics(targetDate);
  
  const [isMetricsPopupOpen, setIsMetricsPopupOpen] = useState(false);

  const [entryContents, setEntryContents] = useState<Record<string, string>>({});
  const [editedEntryIds, setEditedEntryIds] = useState<Set<string>>(new Set());
  const [draftEntryId, setDraftEntryId] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState('');
  const [draftTimestamp, setDraftTimestamp] = useState(() => new Date().toISOString());
  const [hasInitialized, setHasInitialized] = useState(false);
  const isSavingDraftRef = useRef(false);
  const isInitialLoadRef = useRef(true);

  // Reset draft when date changes
  useEffect(() => {
    const nextDraftTimestamp = new Date().toISOString();
    setDraftEntryId(null);
    setDraftContent('');
    setDraftTimestamp(nextDraftTimestamp);
    isInitialLoadRef.current = true;
    setHasInitialized(false);
  }, [targetDate]);

  // Keep local entry content in sync with loaded entries and manage the draft editor
  useEffect(() => {
    const nextContents: Record<string, string> = {};
    entries.forEach((entry) => {
      nextContents[entry.id] = entry.content || '';
    });
    setEntryContents(nextContents);
    setEditedEntryIds(new Set());

    if (draftEntryId) {
      const matching = entries.find((e) => e.id === draftEntryId);
      if (matching) {
        const serverContent = matching.content || '';
        setDraftContent((prev) => (prev === serverContent ? prev : serverContent));
      } else if (!isSavingDraftRef.current) {
        const nextDraftTimestamp = new Date().toISOString();
        setDraftEntryId(null);
        setDraftContent('');
        setDraftTimestamp(nextDraftTimestamp);
      }
    }

    isInitialLoadRef.current = false;
    if (!hasInitialized && entries.length >= 0) {
      setHasInitialized(true);
    }
  }, [entries, draftEntryId, targetDate, hasInitialized]);

  const markEdited = useCallback((id: string) => {
    setEditedEntryIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const handleEntryChange = useCallback(
    (id: string, content: string) => {
      setEntryContents((prev) => ({ ...prev, [id]: content }));
      // Only mark as edited if content differs from server content
      const serverEntry = entries.find((e) => e.id === id);
      if (serverEntry) {
        const serverContent = serverEntry.content || '';
        if (content.trim() !== serverContent.trim()) {
          markEdited(id);
        } else {
          // Content matches server, remove from edited set if present
          setEditedEntryIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }
      } else {
        // No server entry yet, mark as edited
        markEdited(id);
      }
    },
    [markEdited, entries]
  );

  const handleEntrySave = useCallback(
    async (id: string, content: string, _isManualSave = false) => {
      const trimmed = content.trim();
      const isEdited = editedEntryIds.has(id);

      if (!isEdited) {
        return;
      }

      try {
        if (!trimmed) {
          await deleteEntry(id);
          await refresh();
          return;
        }

        await updateEntry(id, trimmed);

        setEditedEntryIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } catch (error) {
        console.error('Failed to save entry', error);
      }
    },
    [deleteEntry, editedEntryIds, refresh, updateEntry]
  );

  const handleDraftChange = useCallback((content: string) => {
    setDraftContent(content);
  }, []);

  const handleDraftSave = useCallback(
    async (content: string, _isManualSave = false) => {
      const trimmed = content.trim();

      if (!trimmed || isSavingDraftRef.current) {
        return;
      }

      try {
        isSavingDraftRef.current = true;

        if (!draftEntryId) {
          const saved = await createEntry(trimmed);
          if (saved) {
            setDraftEntryId(saved.id);
            setDraftContent(saved.content || trimmed);
          }
        } else {
          await updateEntry(draftEntryId, trimmed);
          setDraftContent(trimmed);
        }
      } catch (error) {
        console.error('Failed to save entry', error);
      } finally {
        isSavingDraftRef.current = false;
      }
    },
    [createEntry, draftEntryId, updateEntry]
  );

  const draftEntry = draftEntryId ? entries.find((e) => e.id === draftEntryId) : null;
  const otherEntries = useMemo(
    () =>
      entries
        .filter((entry) => entry.id !== draftEntryId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [entries, draftEntryId]
  );

  // Calculate if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    // Don't show unsaved changes during initial load or before entries are synced
    if (loading || !hasInitialized) {
      return false;
    }

    // Check if any existing entries have unsaved changes
    if (editedEntryIds.size > 0) {
      return true;
    }

    // Check draft content
    if (draftEntryId) {
      // If draft has an entry ID, compare with server content
      const serverEntry = entries.find((e) => e.id === draftEntryId);
      if (serverEntry) {
        const serverContent = serverEntry.content || '';
        return draftContent.trim() !== serverContent.trim();
      }
    } else {
      // If no draft entry ID, check if draft has content
      return draftContent.trim() !== '';
    }

    return false;
  }, [loading, hasInitialized, editedEntryIds, draftEntryId, draftContent, entries]);

  if (loading) {
    return (
      <div className={fullScreen ? 'fixed inset-0 flex items-center justify-center bg-white' : 'flex items-center justify-center'}>
        <div className="text-gray-500">{loadingMessage}</div>
      </div>
    );
  }

  const containerClass = fullScreen ? 'fixed inset-0 bg-white' : 'min-h-screen bg-white';
  const innerClass = fullScreen
    ? 'w-full max-w-3xl mx-auto px-4 pt-5 pb-8 h-full overflow-auto'
    : 'w-full max-w-3xl mx-auto px-4 pt-5 pb-8';

  return (
    <div className={containerClass}>
      <div className={innerClass}>
        <DateHeader currentDate={targetDate} isSaving={saving} hasUnsavedChanges={hasUnsavedChanges} />
        {otherEntries.map((entry, index) => (
          <EntryBlock
            key={entry.id}
            entry={entry}
            value={entryContents[entry.id] ?? ''}
            onChange={(val) => handleEntryChange(entry.id, val)}
            onSave={(val, isManual) => handleEntrySave(entry.id, val, isManual)}
            placeholder="Start writing..."
            showSeparator={index < otherEntries.length - 1}
            autoSaveDelay={1500}
          />
        ))}

        <EntryBlock
          key="draft-entry-block"
          entry={draftEntry ?? null}
          value={draftContent}
          onChange={handleDraftChange}
          onSave={handleDraftSave}
          placeholder="Start writing..."
          showSeparator={false}
          showSeparatorAbove={otherEntries.length > 0}
          timestampOverride={draftEntry ? draftEntry.createdAt : draftTimestamp}
          autoSaveDelay={1500}
        />
      </div>
      
      {/* Metrics Icon Button */}
      <MetricsIconButton onClick={() => setIsMetricsPopupOpen(true)} />
      
      {/* Metrics Popup */}
      <MetricsPopup
        isOpen={isMetricsPopupOpen}
        onClose={() => setIsMetricsPopupOpen(false)}
        date={targetDate}
        metrics={metrics}
        loading={metricsLoading}
        saving={metricsSaving}
        onSave={saveMetrics}
      />
    </div>
  );
}
