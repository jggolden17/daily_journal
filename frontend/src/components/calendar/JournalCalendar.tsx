import { useState, useEffect } from 'react';
import { journalApi } from '../../api/journal';
import type { CalendarEntry } from '../../types/journal';
import { useNavigate } from 'react-router-dom';

export function JournalCalendar() {
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const navigate = useNavigate();

  useEffect(() => {
    loadCalendar();
  }, [currentMonth]);

  const loadCalendar = async () => {
    setLoading(true);
    try {
      const data = await journalApi.getCalendar();
      setEntries(data);
    } catch (error) {
      console.error('Failed to load calendar:', error);
    } finally {
      setLoading(false);
    }
  };

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
    return date.toISOString().split('T')[0];
  };

  const hasEntry = (date: Date): boolean => {
    const dateStr = formatDate(date);
    return entries.some((e) => e.date === dateStr && e.hasEntry);
  };

  const handleDateClick = (date: Date) => {
    const dateStr = formatDate(date);
    navigate(`/day/${dateStr}`);
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
  const days = getDaysInMonth(currentMonth);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (loading) {
    return <div className="text-center p-8">Loading calendar...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={previousMonth}
          className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
        >
          ← Previous
        </button>
        <h2 className="text-xl font-semibold">{monthName}</h2>
        <button
          onClick={nextMonth}
          className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
        >
          Next →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {dayNames.map((day) => (
          <div key={day} className="text-center font-semibold text-gray-600 py-2">
            {day}
          </div>
        ))}
        {days.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }

          const dateStr = formatDate(date);
          const isToday = dateStr === new Date().toISOString().split('T')[0];
          const entryExists = hasEntry(date);

          return (
            <button
              key={dateStr}
              onClick={() => handleDateClick(date)}
              className={`
                aspect-square border rounded p-2 text-sm
                ${isToday ? 'border-blue-500 bg-blue-50 font-semibold' : 'border-gray-300'}
                ${entryExists ? 'bg-green-50' : 'bg-white'}
                hover:bg-gray-100 transition-colors
              `}
            >
              {date.getDate()}
              {entryExists && (
                <div className="w-2 h-2 bg-green-500 rounded-full mx-auto mt-1" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

