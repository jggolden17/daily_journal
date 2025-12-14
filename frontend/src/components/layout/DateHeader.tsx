import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDisplayDate, getPreviousDay, getNextDay } from '../../utils/dateFormatting';
import { CalendarPopup } from '../calendar/CalendarPopup';
import { SyncIcon } from '../ui/SyncIcon';

interface DateHeaderProps {
  currentDate: string; // YYYY-MM-DD format
  isSaving?: boolean;
  hasUnsavedChanges?: boolean;
}

export function DateHeader({ currentDate, isSaving = false, hasUnsavedChanges = false }: DateHeaderProps) {
  const navigate = useNavigate();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const dateButtonRef = useRef<HTMLButtonElement>(null);

  const formattedDate = formatDisplayDate(currentDate);

  const handlePreviousDay = () => {
    const previous = getPreviousDay(currentDate);
    navigate(`/day/${previous}`);
  };

  const handleNextDay = () => {
    const next = getNextDay(currentDate);
    navigate(`/day/${next}`);
  };

  const handleDateClick = () => {
    setIsCalendarOpen(true);
  };

  const handleCloseCalendar = () => {
    setIsCalendarOpen(false);
  };

  return (
    <>
      <div className="flex items-start gap-3 mb-6 pb-1 border-b border-gray-200">
        {/* Date and arrows section */}
        <div className="flex flex-col items-start gap-1">
          {/* Date display - clickable */}
          <button
            ref={dateButtonRef}
            onClick={handleDateClick}
            className="text-xl font-semibold text-gray-900 hover:text-blue-600 transition-colors cursor-pointer"
            type="button"
            aria-label="Select date"
          >
            {formattedDate}
          </button>

          {/* Navigation arrows */}
          <div className="flex items-center gap-1">
            <button
              onClick={handlePreviousDay}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors"
              type="button"
              aria-label="Previous day"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3.5 w-3.5 text-gray-700"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={handleNextDay}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors"
              type="button"
              aria-label="Next day"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3.5 w-3.5 text-gray-700"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Sync icon */}
        <div className="ml-auto flex items-center">
          <SyncIcon isSaving={isSaving} hasUnsavedChanges={hasUnsavedChanges} />
        </div>
      </div>

      {/* Calendar popup */}
      <CalendarPopup
        isOpen={isCalendarOpen}
        onClose={handleCloseCalendar}
        selectedDate={currentDate}
        triggerElement={dateButtonRef.current}
      />
    </>
  );
}
