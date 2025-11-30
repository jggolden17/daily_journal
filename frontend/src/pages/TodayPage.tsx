import { useState } from 'react';
import { JournalEntryCard } from '../components/editor/JournalEntryCard';
import { MarkdownEditor } from '../components/editor/MarkdownEditor';
import { MarkdownPreview } from '../components/editor/MarkdownPreview';
import { useTodayEntry } from '../hooks/useTodayEntry';
import { useMetrics } from '../hooks/useMetrics';
import { ColoredScaleSelect } from '../components/metrics/ColoredScaleSelect';
import type { DailyMetrics } from '../types/metrics';

export function TodayPage() {
  const today = new Date().toISOString().split('T')[0];
  const { entries, loading, saving, createEntry, updateEntry, deleteEntry } = useTodayEntry();
  const { metrics, loading: metricsLoading, saveMetrics } = useMetrics(today);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newEntryContent, setNewEntryContent] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [metricsExpanded, setMetricsExpanded] = useState(false);

  const handleCreateEntry = async () => {
    if (!newEntryContent.trim() || saving) {
      if (!newEntryContent.trim()) {
        setIsCreatingNew(false);
      }
      return;
    }
    try {
      await createEntry(newEntryContent);
      setNewEntryContent('');
      setIsCreatingNew(false);
      setShowPreview(false);
    } catch (error) {
      console.error('Failed to create entry:', error);
    }
  };

  const handleCancelNew = () => {
    setIsCreatingNew(false);
    setNewEntryContent('');
    setShowPreview(false);
  };

  const handleMetricsChange = async (
    field: keyof DailyMetrics,
    value: number | string | null | Record<string, unknown>
  ) => {
    const updated: DailyMetrics = {
      ...(metrics || {}),
      date: today,
      [field]: value,
    };
    try {
      await saveMetrics(updated);
    } catch (error) {
      console.error('Failed to save metrics:', error);
    }
  };

  const handleDateTimeChange = async (
    field: 'asleep_by' | 'awoke_at',
    value: string
  ) => {
    // Convert date string to ISO datetime string
    const dateTime = value ? new Date(value).toISOString() : null;
    await handleMetricsChange(field, dateTime);
  };

  const handleUpdateEntry = async (id: string, content: string): Promise<void> => {
    await updateEntry(id, content);
  };

  if (loading) {
    return <div className="text-center p-8">Loading today's entries...</div>;
  }

  return (
    <div className="px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Today's Journal</h1>

      {/* Metrics Section */}
      <div className="mb-6 bg-white rounded-lg border border-gray-200">
        <button
          onClick={() => setMetricsExpanded(!metricsExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <h2 className="text-lg font-semibold">Today's Metrics</h2>
          <svg
            className={`w-5 h-5 transform transition-transform ${
              metricsExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
        {metricsExpanded && (
          <div className="px-4 pb-4">
            {metricsLoading ? (
              <div className="py-4">Loading metrics...</div>
            ) : (
              <div className="space-y-6 pt-2">
                {/* Sleep Section */}
                <div>
                  <h3 className="text-md font-medium text-gray-800 mb-3">Sleep</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Asleep By
                      </label>
                      <input
                        type="datetime-local"
                        value={
                          metrics?.asleep_by
                            ? new Date(metrics.asleep_by).toISOString().slice(0, 16)
                            : ''
                        }
                        onChange={(e) => handleDateTimeChange('asleep_by', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Awoke At
                      </label>
                      <input
                        type="datetime-local"
                        value={
                          metrics?.awoke_at
                            ? new Date(metrics.awoke_at).toISOString().slice(0, 16)
                            : ''
                        }
                        onChange={(e) => handleDateTimeChange('awoke_at', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <ColoredScaleSelect
                      value={metrics?.sleep_quality}
                      onChange={(value) => handleMetricsChange('sleep_quality', value)}
                      label="Sleep Quality"
                    />
                  </div>
                </div>

                {/* Activity & Mood Section */}
                <div>
                  <h3 className="text-md font-medium text-gray-800 mb-3">Activity & Mood</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ColoredScaleSelect
                      value={metrics?.physical_activity}
                      onChange={(value) => handleMetricsChange('physical_activity', value)}
                      label="Physical Activity"
                    />
                    <ColoredScaleSelect
                      value={metrics?.overall_mood}
                      onChange={(value) => handleMetricsChange('overall_mood', value)}
                      label="Overall Mood"
                    />
                  </div>
                </div>

                {/* Work Section */}
                <div>
                  <h3 className="text-md font-medium text-gray-800 mb-3">Work</h3>
                  <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Hours Paid Work
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={metrics?.hours_paid_work ?? ''}
                        onChange={(e) =>
                          handleMetricsChange(
                            'hours_paid_work',
                            e.target.value ? parseFloat(e.target.value) : null
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Hours Personal Work
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={metrics?.hours_personal_work ?? ''}
                        onChange={(e) =>
                          handleMetricsChange(
                            'hours_personal_work',
                            e.target.value ? parseFloat(e.target.value) : null
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Journal Entries Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Journal Entries</h2>
          {!isCreatingNew && (
            <button
              onClick={() => setIsCreatingNew(true)}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              + New Entry
            </button>
          )}
        </div>

        {/* Existing Entries */}
        {entries.length > 0 && (
          <div className="space-y-4">
            {entries
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((entry) => (
                <JournalEntryCard
                  key={entry.id}
                  entry={entry}
                  onUpdate={handleUpdateEntry}
                  onDelete={deleteEntry}
                  saving={saving}
                />
              ))}
          </div>
        )}

        {/* New Entry Editor */}
        {isCreatingNew && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">New Entry</h3>
              <div className="flex items-center space-x-2">
                {saving && <span className="text-sm text-gray-500">Saving...</span>}
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  {showPreview ? 'Edit' : 'Preview'}
                </button>
                <button
                  onClick={handleCreateEntry}
                  disabled={saving || !newEntryContent.trim()}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save
                </button>
                <button
                  onClick={handleCancelNew}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2" style={{ minHeight: '400px' }}>
              <div className={showPreview ? 'hidden' : 'block'}>
                <MarkdownEditor
                  value={newEntryContent}
                  onChange={setNewEntryContent}
                  placeholder="Write about your day..."
                />
              </div>
              <div className={`border-l border-gray-200 ${showPreview ? 'block' : 'hidden md:block'}`}>
                <MarkdownPreview content={newEntryContent} />
              </div>
            </div>
          </div>
        )}

        {entries.length === 0 && !isCreatingNew && (
          <div className="text-center p-8 bg-white rounded-lg border border-gray-200 text-gray-500">
            No entries yet. Click "New Entry" to get started.
          </div>
        )}
      </div>
    </div>
  );
}
