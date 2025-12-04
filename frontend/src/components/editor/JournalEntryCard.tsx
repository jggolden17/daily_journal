import { useState, useEffect } from 'react';
import { TipTapEditor } from './TipTapEditor';
import { MarkdownPreview } from './MarkdownPreview';
import type { JournalEntry } from '../../types/journal';

interface JournalEntryCardProps {
  entry: JournalEntry;
  onUpdate: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  saving?: boolean;
}

export function JournalEntryCard({ entry, onUpdate, onDelete, saving = false }: JournalEntryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(entry.content);

  // Sync content when entry changes (but not when editing)
  useEffect(() => {
    if (!isEditing) {
      setContent(entry.content);
    }
  }, [entry.content, isEditing]);

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleSave = async () => {
    try {
      await onUpdate(entry.id, content);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save entry:', error);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this entry?')) {
      try {
        await onDelete(entry.id);
      } catch (error) {
        console.error('Failed to delete entry:', error);
      }
    }
  };

  // Use entry content for preview when collapsed, local content when editing
  const previewContent = (!isExpanded && !isEditing ? entry.content : content).substring(0, 200);
  const hasMoreContent = (!isExpanded && !isEditing ? entry.content : content).length > 200;

  return (
    <div className="bg-white border border-gray-200 rounded-lg mb-4 overflow-hidden">
      {/* Header - Always visible */}
      <div
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => !isEditing && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-sm font-medium text-gray-900">
                {formatTime(entry.createdAt)}
              </span>
              {entry.updatedAt !== entry.createdAt && (
                <span className="text-xs text-gray-500">
                  (updated {formatTime(entry.updatedAt)})
                </span>
              )}
            </div>
            {!isExpanded && !isEditing && (
              <div className="text-sm text-gray-600 line-clamp-2">
                {previewContent}
                {hasMoreContent && '...'}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2 ml-4">
            {isExpanded && !isEditing && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(true);
                  }}
                  className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 border border-blue-600 rounded hover:bg-blue-50"
                >
                  Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete();
                  }}
                  className="px-3 py-1 text-sm text-red-600 hover:text-red-800 border border-red-600 rounded hover:bg-red-50"
                >
                  Delete
                </button>
              </>
            )}
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'transform rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-200">
          {isEditing ? (
            <div>
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="text-sm text-gray-600">
                  Created: {formatDateTime(entry.createdAt)}
                  {entry.updatedAt !== entry.createdAt && (
                    <> • Last updated: {formatDateTime(entry.updatedAt)}</>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {saving && <span className="text-sm text-gray-500">Saving...</span>}
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setContent(entry.content);
                    }}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
              <div style={{ minHeight: '400px' }}>
                <TipTapEditor
                  value={content}
                  onChange={setContent}
                  onSave={handleSave}
                  placeholder="Write about your day..."
                />
              </div>
            </div>
          ) : (
            <div className="p-4">
              <div className="text-sm text-gray-600 mb-4">
                Created: {formatDateTime(entry.createdAt)}
                {entry.updatedAt !== entry.createdAt && (
                  <> • Last updated: {formatDateTime(entry.updatedAt)}</>
                )}
              </div>
              <MarkdownPreview content={entry.content} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

