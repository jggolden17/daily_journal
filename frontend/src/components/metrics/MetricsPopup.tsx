import { useState, useEffect, useRef } from 'react';
import { MetricsSlider } from './MetricsSlider';
import { getPreviousDay } from '../../utils/dateFormatting';
import type { DailyMetrics } from '../../types/metrics';

interface MetricsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  date: string; // YYYY-MM-DD format - the date of the page
  metrics: DailyMetrics | null;
  loading: boolean;
  saving: boolean;
  onSave: (metrics: DailyMetrics) => Promise<void>;
}

type Page = 1 | 2 | 3;

// Parse local date string (YYYY-MM-DD) to Date object
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Format Date to YYYY-MM-DD string
function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Convert ISO datetime string to datetime-local format (YYYY-MM-DDTHH:mm)
function isoToDateTimeLocal(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  // Get local date/time components
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Convert datetime-local format to ISO string
function dateTimeLocalToIso(dateTimeLocal: string): string | null {
  if (!dateTimeLocal) return null;
  const date = new Date(dateTimeLocal);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

// Calculate sleep duration in hours
function calculateSleepDuration(asleepBy: string | null, awokeAt: string | null): number | null {
  if (!asleepBy || !awokeAt) return null;
  const asleep = new Date(asleepBy);
  const awoke = new Date(awokeAt);
  if (Number.isNaN(asleep.getTime()) || Number.isNaN(awoke.getTime())) return null;
  const diffMs = awoke.getTime() - asleep.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours;
}

export function MetricsPopup({ isOpen, onClose, date, metrics, loading, saving, onSave }: MetricsPopupProps) {
  const [currentPage, setCurrentPage] = useState<Page>(1);
  const popupRef = useRef<HTMLDivElement>(null);

  // Form state
  const [asleepByDate, setAsleepByDate] = useState<string>('');
  const [asleepByTime, setAsleepByTime] = useState<string>('');
  const [awokeAtDate, setAwokeAtDate] = useState<string>('');
  const [awokeAtTime, setAwokeAtTime] = useState<string>('');
  const [sleepQuality, setSleepQuality] = useState<number | null>(null);
  const [paidProductivity, setPaidProductivity] = useState<number | null>(null);
  const [personalProductivity, setPersonalProductivity] = useState<number | null>(null);
  const [physicalActivity, setPhysicalActivity] = useState<number | null>(null);
  const [overallMood, setOverallMood] = useState<number | null>(null);

  // Initialize form from metrics when popup opens or metrics change
  useEffect(() => {
    if (!isOpen) return;

    // Set defaults
    const previousDay = getPreviousDay(date);
    const pageDate = date; // Use the date of the current day-page
    
    // Initialize asleep_by: default to previous day, or use existing value
    if (metrics?.asleep_by) {
      const asleepBy = new Date(metrics.asleep_by);
      setAsleepByDate(formatDateString(asleepBy));
      setAsleepByTime(`${String(asleepBy.getHours()).padStart(2, '0')}:${String(asleepBy.getMinutes()).padStart(2, '0')}`);
    } else {
      setAsleepByDate(previousDay);
      setAsleepByTime('');
    }

    // Initialize awoke_at: default to page date, or use existing value
    if (metrics?.awoke_at) {
      const awokeAt = new Date(metrics.awoke_at);
      setAwokeAtDate(formatDateString(awokeAt));
      setAwokeAtTime(`${String(awokeAt.getHours()).padStart(2, '0')}:${String(awokeAt.getMinutes()).padStart(2, '0')}`);
    } else {
      setAwokeAtDate(pageDate);
      setAwokeAtTime('');
    }

    setSleepQuality(metrics?.sleep_quality ?? null);
    setPaidProductivity(metrics?.paid_productivity ?? null);
    setPersonalProductivity(metrics?.personal_productivity ?? null);
    setPhysicalActivity(metrics?.physical_activity ?? null);
    setOverallMood(metrics?.overall_mood ?? null);
    setCurrentPage(1);
  }, [isOpen, date, metrics]);

  // Auto-adjust asleep_by date if time is between midnight and 10am
  useEffect(() => {
    if (!asleepByTime) return;
    const [hours] = asleepByTime.split(':').map(Number);
    if (hours >= 0 && hours < 10) {
      // If time is between midnight and 10am, update date to page date
      const pageDate = formatDateString(parseLocalDate(date));
      if (asleepByDate !== pageDate) {
        setAsleepByDate(pageDate);
      }
    }
  }, [asleepByTime, asleepByDate, date]);

  // Calculate sleep duration
  const asleepByIso = dateTimeLocalToIso(asleepByDate && asleepByTime ? `${asleepByDate}T${asleepByTime}` : '');
  const awokeAtIso = dateTimeLocalToIso(awokeAtDate && awokeAtTime ? `${awokeAtDate}T${awokeAtTime}` : '');
  const sleepDuration = calculateSleepDuration(asleepByIso, awokeAtIso);

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

  const handleSave = async () => {
    const updatedMetrics: DailyMetrics = {
      date,
      thread_id: metrics?.thread_id,
      asleep_by: asleepByIso,
      awoke_at: awokeAtIso,
      sleep_quality: sleepQuality,
      paid_productivity: paidProductivity,
      personal_productivity: personalProductivity,
      physical_activity: physicalActivity,
      overall_mood: overallMood,
    };

    try {
      await onSave(updatedMetrics);
      onClose();
    } catch (error) {
      console.error('Failed to save metrics:', error);
    }
  };

  const handleNext = () => {
    if (currentPage < 3) {
      setCurrentPage((currentPage + 1) as Page);
    }
  };

  const handleBack = () => {
    if (currentPage > 1) {
      setCurrentPage((currentPage - 1) as Page);
    }
  };

  if (!isOpen) return null;

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
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {loading ? (
          <div className="text-center p-8 text-gray-500">Loading metrics...</div>
        ) : (
          <>
            {/* Page 1: Sleep */}
            {currentPage === 1 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold mb-4">Sleep</h2>
                
                {/* Asleep By */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Asleep By
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={asleepByDate}
                      onChange={(e) => setAsleepByDate(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <input
                      type="time"
                      value={asleepByTime}
                      onChange={(e) => setAsleepByTime(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                {/* Awake At */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Awake At
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={awokeAtDate}
                      onChange={(e) => setAwokeAtDate(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <input
                      type="time"
                      value={awokeAtTime}
                      onChange={(e) => setAwokeAtTime(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                {/* Sleep Duration */}
                <div className="text-center py-2">
                  <span className="text-gray-700">
                    Slept for: <span className="font-semibold">{sleepDuration !== null ? `${sleepDuration.toFixed(1)}` : '--'} hrs</span>
                  </span>
                </div>

                {/* Sleep Quality */}
                <MetricsSlider
                  value={sleepQuality}
                  onChange={setSleepQuality}
                  label="Sleep Quality"
                />

                <div className="flex justify-end pt-4">
                  <button
                    onClick={handleNext}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    type="button"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* Page 2: Productivity */}
            {currentPage === 2 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold mb-4">Productivity</h2>
                
                <MetricsSlider
                  value={paidProductivity}
                  onChange={setPaidProductivity}
                  label="Paid"
                />

                <MetricsSlider
                  value={personalProductivity}
                  onChange={setPersonalProductivity}
                  label="Personal"
                />

                <div className="flex justify-between pt-4">
                  <button
                    onClick={handleBack}
                    className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
                    type="button"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleNext}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    type="button"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* Page 3: Activity & Mood */}
            {currentPage === 3 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold mb-4">Activity & Mood</h2>
                
                <MetricsSlider
                  value={physicalActivity}
                  onChange={setPhysicalActivity}
                  label="Physical Activity"
                />

                <MetricsSlider
                  value={overallMood}
                  onChange={setOverallMood}
                  label="Overall Mood"
                />

                <div className="flex justify-between pt-4">
                  <button
                    onClick={handleBack}
                    className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
                    type="button"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    type="button"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
