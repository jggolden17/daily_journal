import { useState, useEffect, useCallback, useRef } from 'react';
import { journalApi } from '../api/journal';
import { useAuth } from './useAuth';
import type { JournalEntry } from '../types/journal';

export function useTodayEntry() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isSavingRef = useRef(false);
  const { user } = useAuth();
  const currentUserId = user?.id || null;
  const previousUserIdRef = useRef<string | null>(null);
  const hasInitializedRef = useRef(false);

  const loadEntries = useCallback(async () => {
    // Don't try to load if not authenticated
    if (!currentUserId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const todayEntries = await journalApi.getToday();
      setEntries(todayEntries);
    } catch (error) {
      // Only log if it's not an auth error
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('not authenticated')) {
        console.error('Failed to load today entries:', error);
      }
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  // Load entries when user changes (login/logout) or on initial load
  useEffect(() => {
    const previousUserId = previousUserIdRef.current;
    const hasInitialized = hasInitializedRef.current;
    
    // If user changed (login/logout) or this is the first time we've determined the user state
    if (currentUserId !== previousUserId || !hasInitialized) {
      previousUserIdRef.current = currentUserId;
      hasInitializedRef.current = true;
      loadEntries();
    }
  }, [currentUserId, loadEntries]);

  const createEntry = useCallback(async (content: string) => {
    if (isSavingRef.current) {
      return; // Prevent duplicate saves
    }
    isSavingRef.current = true;
    setSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const saved = await journalApi.createEntry(today, content);
      setEntries((prev) => {
        // Check if entry already exists to prevent duplicates
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
  }, []);

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

