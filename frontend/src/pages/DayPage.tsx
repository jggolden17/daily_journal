import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { JournalDayView } from './JournalDayView';

export function DayPage() {
  const { date } = useParams<{ date: string }>();
  const normalizedDate = useMemo(() => {
    if (!date) return new Date().toISOString().split('T')[0];
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString().split('T')[0] : parsed.toISOString().split('T')[0];
  }, [date]);

  return <JournalDayView date={normalizedDate} loadingMessage="Loading entries..." />;
}
