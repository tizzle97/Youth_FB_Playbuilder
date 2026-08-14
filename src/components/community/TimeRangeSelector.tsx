import React from 'react';
import { Clock } from 'lucide-react';
import type { TimeRange } from '../../types/community';

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

const timeRanges: { value: TimeRange; label: string }[] = [
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
];

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 bg-board rounded-lg border border-chalk/20 p-1">
      <Clock className="h-4 w-4 text-chalk/50 ml-2 shrink-0" />
      {timeRanges.map((range) => (
        <button
          key={range.value}
          onClick={() => onChange(range.value)}
          className={`tap-target px-3 py-1 rounded-md text-sm transition-colors ${
            value === range.value
              ? 'bg-primary text-white'
              : 'text-chalk/70 hover:text-chalk hover:bg-board-light'
          }`}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}