import { useMemo } from 'react';
import { JournalDayView } from './JournalDayView';

export function TodayPage() {
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  return <JournalDayView date={today} loadingMessage="Loading today's entries..." />;
}
