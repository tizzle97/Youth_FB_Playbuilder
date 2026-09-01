import React from 'react';

type StatDigitProps = {
  value: string;
  label: string;
  tone?: 'light' | 'dark';
};

/**
 * A number treated like a jersey/scoreboard digit: oversized Anton numeral
 * with a thin outline, a mono caption underneath, and a yard-line rule.
 * Reserved for numbers that matter to the reader's decision (price, limits,
 * time-to-value) — not a general-purpose stat/kpi tile.
 */
export function StatDigit({ value, label, tone = 'light' }: StatDigitProps) {
  const isDark = tone === 'dark';
  return (
    <div className="flex flex-col items-center lg:items-start">
      <span
        className={`font-display text-4xl sm:text-5xl tabular-nums leading-none ${
          isDark ? 'text-chalk' : 'text-board'
        }`}
        style={{ WebkitTextStroke: isDark ? '1px rgba(31,167,93,0.6)' : '1px rgba(16,29,46,0.15)' }}
      >
        {value}
      </span>
      <span className="mt-2 h-0.5 w-8 bg-primary" aria-hidden="true" />
      <span
        className={`mt-2 font-label text-xs uppercase tracking-widest ${
          isDark ? 'text-chalk/50' : 'text-board/50'
        }`}
      >
        {label}
      </span>
    </div>
  );
}
