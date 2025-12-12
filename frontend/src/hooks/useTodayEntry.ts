import { useState, useEffect, useCallback, useRef } from 'react';
import { journalApi } from '../api/journal';
import { useAuth } from './useAuth';
import type { JournalEntry } from '../types/journal';

function getIsoDateOrToday(date?: string) {
  if (date && !Number.isNaN(new Date(date).getTime())) {
    return new Date(date).toISOString().split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
}

export function useTodayEntry(date?: string) {
  const targetDate = getIsoDateOrToday(date);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isSavingRef = useRef(false);
  const { user } = useAuth();
  const currentUserId = user?.id || null;
  const previousUserIdRef = useRef<string | null>(null);
  const hasInitializedRef = useRef(false);
  const previousDateRef = useRef<string | null>(null);

  const loadEntries = useCallback(async () => {
    if (!currentUserId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const dayEntries = await journalApi.getByDate(targetDate);
      setEntries(dayEntries);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('not authenticated')) {
        console.error('Failed to load entries:', error);
      }
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, targetDate]);

  useEffect(() => {
    const previousUserId = previousUserIdRef.current;
    const hasInitialized = hasInitializedRef.current;
    const dateChanged = previousDateRef.current !== targetDate;

    if (currentUserId !== previousUserId || !hasInitialized || dateChanged) {
      previousUserIdRef.current = currentUserId;
      previousDateRef.current = targetDate;
      hasInitializedRef.current = true;
      loadEntries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, targetDate]);

  const createEntry = useCallback(
    async (content: string) => {
      if (isSavingRef.current) {
        return;
      }
      isSavingRef.current = true;
      setSaving(true);
      try {
        const saved = await journalApi.createEntry(targetDate, content);
        setEntries((prev) => {
          if (prev.some((e) => e.id === saved.id)) {
            return prev;
          }
          return [...prev, saved];
        });
        return saved;
      } catch (error) {
        console.error('Failed to create entry:', error);
        throw error;
      } finally {
        setSaving(false);
        isSavingRef.current = false;
      }
    },
    [targetDate]
  );

  const updateEntry = useCallback(async (id: string, content: string) => {
    setSaving(true);
    try {
      const updated = await journalApi.updateEntry(id, content);
      setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)));
      return updated;
    } catch (error) {
      console.error('Failed to update entry:', error);
      throw error;
    } finally {
      setSaving(false);
    }
  }, []);

  const deleteEntry = useCallback(async (id: string) => {
    try {
      await journalApi.deleteEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (error) {
      console.error('Failed to delete entry:', error);
      throw error;
    }
  }, []);

  return {
    entries,
    loading,
    saving,
    createEntry,
    updateEntry,
    deleteEntry,
    refresh: loadEntries,
  };
}

