import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { authApi } from '../../api/auth';
import type { CalendarEntry } from '../../types/journal';

interface CalendarPopupProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string; // YYYY-MM-DD format
}

export function CalendarPopup({ isOpen, onClose, selectedDate }: CalendarPopupProps) {
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    // Parse selectedDate as local date (YYYY-MM-DD)
    const [year, month] = selectedDate.split('-').map(Number);
    return new Date(year, month - 1, 1);
  });
  const navigate = useNavigate();
  const popupRef = useRef<HTMLDivElement>(null);

  // Update current month when selectedDate changes
  useEffect(() => {
    if (isOpen && selectedDate) {
      // Parse selectedDate as local date (YYYY-MM-DD)
      const [year, month] = selectedDate.split('-').map(Number);
      setCurrentMonth(new Date(year, month - 1, 1));
    }
  }, [isOpen, selectedDate]);

  const loadCalendar = async () => {
    setLoading(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      const user_id = await getUserId();
      const response = await apiClient.get<
        SingleItemResponse<CalendarEntryResponse[]>
      >(
        `/latest/entries/calendar?user_id=${user_id}&start_date=${startDateStr}&end_date=${endDateStr}`
      );

      if (response.data) {
        setEntries(
          response.data.map((entry) => ({
            date: entry.date,
            hasEntry: entry.hasEntry,
            hasMetrics: entry.hasMetrics ?? false,
            hasSleepMetrics: entry.hasSleepMetrics ?? false,
            hasCompleteMetrics: entry.hasCompleteMetrics ?? false,
          }))
        );
      } else {
        setEntries([]);
      }
    } catch (error) {
      console.error('Failed to load calendar:', error);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  // Load calendar data when month changes
  useEffect(() => {
    if (isOpen) {
      loadCalendar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth, isOpen]);

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

    // Use setTimeout to avoid immediate close when opening
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const formatDate = (date: Date): string => {
    // Format as local date to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getEntryData = (date: Date): CalendarEntry | undefined => {
    const dateStr = formatDate(date);
    return entries.find((e) => e.date === dateStr);
  };

  const handleDateClick = (date: Date) => {
    const dateStr = formatDate(date);
    navigate(`/day/${dateStr}`);
    onClose();
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  if (!isOpen) return null;

  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
  const days = getDaysInMonth(currentMonth);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  // Get today as local date string
  const todayDate = new Date();
  const today = formatDate(todayDate);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-25 z-40" />
      
      {/* Popup */}
      <div
        ref={popupRef}
        className="fixed z-50 bg-white rounded-lg shadow-lg p-4 max-w-sm w-full mx-auto"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={previousMonth}
            className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 text-sm"
            type="button"
          >
            ←
          </button>
          <h3 className="text-lg font-semibold">{monthName}</h3>
          <button
            onClick={nextMonth}
            className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 text-sm"
            type="button"
          >
            →
          </button>
        </div>

        {loading ? (
          <div className="text-center p-4 text-gray-500">Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map((day) => (
                <div key={day} className="text-center font-semibold text-gray-600 py-1 text-xs">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((date, index) => {
                if (!date) {
                  return <div key={`empty-${index}`} className="aspect-square" />;
                }

                const dateStr = formatDate(date);
                const isToday = dateStr === today;
                const isSelected = dateStr === selectedDate;
                const entryData = getEntryData(date);
                const hasEntry = entryData?.hasEntry ?? false;
                const hasMetrics = entryData?.hasMetrics ?? false;
                const hasSleepMetrics = entryData?.hasSleepMetrics ?? false;
                const hasCompleteMetrics = entryData?.hasCompleteMetrics ?? false;

                // Determine background color (priority: selected > complete > incomplete > default)
                let bgColor = '';
                if (isSelected) {
                  bgColor = 'bg-blue-100 border-blue-600';
                } else if (hasEntry && hasCompleteMetrics) {
                  bgColor = 'bg-green-50';
                } else if (hasEntry) {
                  bgColor = 'bg-amber-50';
                } else {
                  bgColor = 'bg-white';
                }

                // Determine dot colors and display
                // Entry dot: always green if hasEntry
                const showEntryDot = hasEntry;
                const entryDotColor = 'bg-green-500';
                
                // Dark gray dot: show if hasEntry but no metrics
                const showNoMetricsDot = hasEntry && !hasMetrics;
                
                // Metrics dot: show if has sleep metrics (amber) or complete metrics (green)
                const showMetricsDot = hasSleepMetrics || hasCompleteMetrics;
                const metricsDotColor = hasCompleteMetrics ? 'bg-green-500' : 'bg-amber-500';

                return (
                  <button
                    key={dateStr}
                    onClick={() => handleDateClick(date)}
                    className={`
                      aspect-square border rounded text-sm font-medium
                      transition-colors flex flex-col items-center justify-center
                      ${isToday ? 'border-blue-500' : 'border-gray-300'}
                      ${bgColor}
                      hover:bg-gray-100
                    `}
                    type="button"
                  >
                    {date.getDate()}
                    {(showEntryDot || showNoMetricsDot || showMetricsDot) && (
                      <div className="flex gap-0.5 mt-0.5">
                        {showEntryDot && (
                          <div className={`w-1.5 h-1.5 ${entryDotColor} rounded-full`} />
                        )}
                        {showNoMetricsDot && (
                          <div className="w-1.5 h-1.5 bg-gray-600 rounded-full" />
                        )}
                        {showMetricsDot && (
                          <div className={`w-1.5 h-1.5 ${metricsDotColor} rounded-full`} />
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}

interface SingleItemResponse<T> {
  data: T | null;
}

interface CalendarEntryResponse {
  date: string;
  hasEntry: boolean;
  hasMetrics?: boolean;
  hasSleepMetrics?: boolean;
  hasCompleteMetrics?: boolean;
}

async function getUserId(): Promise<string> {
  const user = await authApi.getMe();
  if (!user || !user.id) {
    throw new Error('User not authenticated. Please log in.');
  }
  return user.id;
}
