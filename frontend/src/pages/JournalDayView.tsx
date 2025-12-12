import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { EntryBlock } from '../components/editor/EntryBlock';
import { Toast } from '../components/ui/Toast';
import { useTodayEntry } from '../hooks/useTodayEntry';

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
  const { entries, loading, createEntry, updateEntry, deleteEntry, refresh } = useTodayEntry(targetDate);

  const [entryContents, setEntryContents] = useState<Record<string, string>>({});
  const [editedEntryIds, setEditedEntryIds] = useState<Set<string>>(new Set());
  const [draftEntryId, setDraftEntryId] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState('');
  const [draftTimestamp, setDraftTimestamp] = useState(() => new Date(`${targetDate}T00:00:00.000Z`).toISOString());
  const [showToast, setShowToast] = useState(false);
  const isSavingDraftRef = useRef(false);
  const isInitialLoadRef = useRef(true);

  // Reset draft when date changes
  useEffect(() => {
    setDraftEntryId(null);
    setDraftContent('');
    setDraftTimestamp(new Date(`${targetDate}T00:00:00.000Z`).toISOString());
    isInitialLoadRef.current = true;
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
        setDraftEntryId(null);
        setDraftContent('');
        setDraftTimestamp(new Date(`${targetDate}T00:00:00.000Z`).toISOString());
      }
    }

    isInitialLoadRef.current = false;
  }, [entries, draftEntryId, targetDate]);

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
      markEdited(id);
    },
    [markEdited]
  );

  const handleEntrySave = useCallback(
    async (id: string, content: string, isManualSave = false) => {
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

        if (isManualSave) {
          setShowToast(true);
        }
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
    async (content: string, isManualSave = false) => {
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

        if (isManualSave) {
          setShowToast(true);
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

  if (loading) {
    return (
      <div className={fullScreen ? 'fixed inset-0 flex items-center justify-center bg-white' : 'flex items-center justify-center'}>
        <div className="text-gray-500">{loadingMessage}</div>
      </div>
    );
  }

  const containerClass = fullScreen ? 'fixed inset-0 bg-white' : 'min-h-screen bg-white';
  const innerClass = fullScreen
    ? 'w-full max-w-3xl mx-auto px-4 pt-20 pb-8 h-full overflow-auto'
    : 'w-full max-w-3xl mx-auto px-4 pt-20 pb-8';

  return (
    <div className={containerClass}>
      <div className={innerClass}>
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
      <Toast
        message="Saved"
        show={showToast}
        onHide={() => setShowToast(false)}
        duration={2000}
      />
    </div>
  );
}
