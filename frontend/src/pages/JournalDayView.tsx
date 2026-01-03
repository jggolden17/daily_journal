import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { EntryBlock } from '../components/editor/EntryBlock';
import { useTodayEntry } from '../hooks/useTodayEntry';
import { DateHeader } from '../components/layout/DateHeader';
import { MetricsIconButton } from '../components/metrics/MetricsIconButton';
import { MetricsPopup } from '../components/metrics/MetricsPopup';
import { MetricsCompletionPrompt } from '../components/metrics/MetricsCompletionPrompt';
import { useMetrics } from '../hooks/useMetrics';
import { getDateRange } from '../utils/dateFormatting';
import { getDatesWithIncompleteMetrics } from '../utils/metricsHelpers';
import type { DailyMetrics } from '../types/metrics';

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
  const navigate = useNavigate();
  const { entries, loading, saving, createEntry, updateEntry, deleteEntry, refresh } = useTodayEntry(targetDate);
  const { metrics, loading: metricsLoading, saving: metricsSaving, saveMetrics } = useMetrics(targetDate);
  
  const [isMetricsPopupOpen, setIsMetricsPopupOpen] = useState(false);
  const typingEditorsRef = useRef<Set<string>>(new Set());
  const [isTyping, setIsTyping] = useState(false);
  
  // State for metrics completion prompt
  const [isCompletionPromptOpen, setIsCompletionPromptOpen] = useState(false);
  const [pendingIncompleteDates, setPendingIncompleteDates] = useState<string[]>([]);
  const [lastSavedDate, setLastSavedDate] = useState<string | null>(null);
  const [shouldOpenMetricsPopup, setShouldOpenMetricsPopup] = useState(false);
  const isProcessingMetricsCompletionRef = useRef(false);
  

  const [entryContents, setEntryContents] = useState<Record<string, string>>({});
  const [editedEntryIds, setEditedEntryIds] = useState<Set<string>>(new Set());
  const [draftEntryId, setDraftEntryId] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState('');
  const [draftTimestamp, setDraftTimestamp] = useState(() => new Date().toISOString());
  const [hasInitialized, setHasInitialized] = useState(false);
  const isSavingDraftRef = useRef(false);
  const isInitialLoadRef = useRef(true);
  const pendingDraftEntryIdRef = useRef<string | null>(null);

  // Reset draft when date changes
  useEffect(() => {
    const nextDraftTimestamp = new Date().toISOString();
    setDraftEntryId(null);
    setDraftContent('');
    setDraftTimestamp(nextDraftTimestamp);
    isInitialLoadRef.current = true;
    setHasInitialized(false);
    pendingDraftEntryIdRef.current = null;
    
    // If we should open metrics popup (from completion flow), open it
    if (shouldOpenMetricsPopup) {
      setShouldOpenMetricsPopup(false);
      // Small delay to ensure the page has loaded
      setTimeout(() => {
        setIsMetricsPopupOpen(true);
      }, 100);
    }
  }, [targetDate, shouldOpenMetricsPopup]);

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
    async (id: string, content: string, _isManualSave = false, writtenAt?: string) => {
      const trimmed = content.trim();
      const isEdited = editedEntryIds.has(id) || writtenAt !== undefined;

      if (!isEdited) {
        return;
      }

      try {
        if (!trimmed) {
          await deleteEntry(id);
          await refresh();
          return;
        }

        await updateEntry(id, trimmed, writtenAt);

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
  
  const handleTypingChange = useCallback((entryId: string, isTypingNow: boolean) => {
    if (isTypingNow) {
      typingEditorsRef.current.add(entryId);
    } else {
      typingEditorsRef.current.delete(entryId);
    }
    setIsTyping(typingEditorsRef.current.size > 0);
  }, []);

  const handleDraftSave = useCallback(
    async (content: string, _isManualSave = false, writtenAt?: string) => {
      const trimmed = content.trim();

      if (!trimmed || isSavingDraftRef.current) {
        return;
      }

      try {
        isSavingDraftRef.current = true;

        if (!draftEntryId) {
          // Store the content we're about to save so we can identify the entry when it's created
          // This allows us to set pendingDraftEntryIdRef before the entry appears in otherEntries
          const contentToSave = trimmed;
          const saved = await createEntry(contentToSave);
          if (saved) {
            // Set pending ref and draftEntryId synchronously to prevent duplicate rendering
            // The ref must be set before React processes the entries state update
            pendingDraftEntryIdRef.current = saved.id;
            setDraftEntryId(saved.id);
            setDraftContent(saved.content || contentToSave);
            // If writtenAt was provided, update it immediately after creation
            if (writtenAt) {
              await updateEntry(saved.id, contentToSave, writtenAt);
            }
            // Clear pending ref after a short delay to ensure all renders have completed
            // We keep it set until draftEntryId state is fully propagated
            setTimeout(() => {
              // Only clear if draftEntryId matches (to avoid clearing if state changed)
              if (pendingDraftEntryIdRef.current === saved.id) {
                pendingDraftEntryIdRef.current = null;
              }
            }, 100);
            // No refresh needed - createEntry already updates the entries array via setEntries
          }
        } else {
          await updateEntry(draftEntryId, trimmed, writtenAt);
          setDraftContent(trimmed);
          // No refresh needed - updateEntry already updates the entries array via setEntries
        }
      } catch (error) {
        console.error('Failed to save entry', error);
        // Clear pending ref on error
        pendingDraftEntryIdRef.current = null;
      } finally {
        isSavingDraftRef.current = false;
      }
    },
    [createEntry, draftEntryId, updateEntry]
  );

  const handleDeleteEntry = useCallback(
    async (id: string) => {
      try {
        await deleteEntry(id);
        // If the deleted entry was the draft entry, clear draft state
        if (draftEntryId === id) {
          const nextDraftTimestamp = new Date().toISOString();
          setDraftEntryId(null);
          setDraftContent('');
          setDraftTimestamp(nextDraftTimestamp);
        }
        // Refresh to ensure UI is in sync
        await refresh();
      } catch (error) {
        console.error('Failed to delete entry:', error);
        throw error;
      }
    },
    [deleteEntry, draftEntryId, refresh]
  );

  const draftEntry = draftEntryId ? entries.find((e) => e.id === draftEntryId) : null;
  const otherEntries = useMemo(
    () => {
      // Use pendingDraftEntryIdRef to prevent entry from appearing in otherEntries before draftEntryId is set
      const effectiveDraftEntryId = draftEntryId || pendingDraftEntryIdRef.current;
      // Also filter out any entry that matches the draft content if we're saving (to handle race condition)
      const filtered = entries.filter((entry) => {
        if (entry.id === effectiveDraftEntryId) {
          return false;
        }
        // If we're currently saving a draft and this entry matches the draft content, exclude it
        // This handles the race condition where createEntry updates entries before draftEntryId is set
        if (!draftEntryId && isSavingDraftRef.current && draftContent.trim() && entry.content.trim() === draftContent.trim()) {
          return false;
        }
        return true;
      });
      const sorted = filtered.sort((a, b) => new Date(a.writtenAt).getTime() - new Date(b.writtenAt).getTime());
      return sorted;
    },
    [entries, draftEntryId, draftContent]
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

  // Handle metrics save completion - check for incomplete metrics in last 7 days
  const handleMetricsSaveComplete = useCallback(async (savedMetrics: DailyMetrics) => {
    // Prevent multiple simultaneous checks
    if (isProcessingMetricsCompletionRef.current) {
      return;
    }
    
    isProcessingMetricsCompletionRef.current = true;
    
    try {
      const savedDate = savedMetrics.date;
      setLastSavedDate(savedDate);
      
      // Calculate date range for last 7 days (including the saved date)
      const { start, end } = getDateRange(savedDate, 7);
      
      // Get dates with incomplete metrics
      const incompleteDates = await getDatesWithIncompleteMetrics(start, end);
      
      // Filter out the date we just saved
      const otherIncompleteDates = incompleteDates.filter((d) => d !== savedDate);
      
      if (otherIncompleteDates.length > 0) {
        // Store pending dates and show prompt
        setPendingIncompleteDates(otherIncompleteDates);
        setIsCompletionPromptOpen(true);
      }
    } catch (error) {
      console.error('Failed to check for incomplete metrics:', error);
    } finally {
      isProcessingMetricsCompletionRef.current = false;
    }
  }, []);

  // Handle confirmation to add metrics for missing dates
  const handleCompletionPromptConfirm = useCallback(() => {
    setIsCompletionPromptOpen(false);
    
    if (pendingIncompleteDates.length > 0) {
      // Navigate to the most recent date with incomplete metrics
      const nextDate = pendingIncompleteDates[0];
      setShouldOpenMetricsPopup(true);
      navigate(`/day/${nextDate}`);
      // The metrics popup will be opened by the useEffect when targetDate changes
    }
  }, [pendingIncompleteDates, navigate]);

  // Handle completion prompt close
  const handleCompletionPromptClose = useCallback(() => {
    setIsCompletionPromptOpen(false);
    setPendingIncompleteDates([]);
  }, []);

  // Handle metrics save - handles both normal saves and completion flow saves
  const handleMetricsSave = useCallback(async (updatedMetrics: DailyMetrics) => {
    const saved = await saveMetrics(updatedMetrics);
    
    // If we're in the completion flow, remove the current date from pending list
    if (pendingIncompleteDates.length > 0 && pendingIncompleteDates[0] === targetDate) {
      const remainingDates = pendingIncompleteDates.slice(1);
      setPendingIncompleteDates(remainingDates);
      
      if (remainingDates.length > 0) {
        // More dates to process - show prompt again
        setIsCompletionPromptOpen(true);
        setIsMetricsPopupOpen(false);
      } else {
        // All done - close popup
        setIsMetricsPopupOpen(false);
      }
    }
    // For normal saves, handleMetricsSaveComplete will be called via onSaveComplete
    
    return saved;
  }, [saveMetrics, pendingIncompleteDates, targetDate]);

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
            onDelete={handleDeleteEntry}
            onTypingChange={(isTypingNow) => handleTypingChange(entry.id, isTypingNow)}
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
          onDelete={draftEntry ? handleDeleteEntry : undefined}
          onTypingChange={(isTypingNow) => handleTypingChange('draft', isTypingNow)}
          placeholder="Start writing..."
          showSeparator={false}
          showSeparatorAbove={otherEntries.length > 0}
          timestampOverride={draftEntry ? draftEntry.writtenAt : draftTimestamp}
          autoSaveDelay={1500}
        />
      </div>
      
      {/* Metrics Icon Button - Hide when typing */}
      {!(isTyping) && (
        <MetricsIconButton onClick={() => setIsMetricsPopupOpen(true)} />
      )}
      
      {/* Metrics Popup */}
      <MetricsPopup
        isOpen={isMetricsPopupOpen}
        onClose={() => setIsMetricsPopupOpen(false)}
        date={targetDate}
        metrics={metrics}
        loading={metricsLoading}
        saving={metricsSaving}
        onSave={handleMetricsSave}
        onSaveComplete={pendingIncompleteDates.length === 0 ? handleMetricsSaveComplete : undefined}
      />
      
      {/* Metrics Completion Prompt */}
      <MetricsCompletionPrompt
        isOpen={isCompletionPromptOpen}
        onClose={handleCompletionPromptClose}
        savedDate={lastSavedDate || targetDate}
        missingCount={pendingIncompleteDates.length}
        onConfirm={handleCompletionPromptConfirm}
      />
    </div>
  );
}
