import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

interface UsageWarningBannerProps {
  used: number;
  limit: number;
  /** Plural label for what's being counted, e.g. "plays" or "playbooks". */
  label: string;
}

/** Early nudge shown to free users approaching a FREE_LIMITS cap, before the
 *  server-side trigger (PBP01/PBP02) rejects the save outright (B-22). */
export function UsageWarningBanner({ used, limit, label }: UsageWarningBannerProps) {
  const navigate = useNavigate();
  const atLimit = used >= limit;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-primary/10 border border-primary/40 rounded-lg text-sm">
      <div className="flex items-center gap-2 text-chalk">
        <AlertTriangle className="h-4 w-4 text-primary shrink-0" />
        <span>
          {atLimit
            ? `You've used all ${limit} of your free ${label}.`
            : `${used} of ${limit} free ${label} used.`}
        </span>
      </div>
      <button
        type="button"
        onClick={() => navigate('/')}
        className="shrink-0 px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
      >
        Upgrade to Pro
      </button>
    </div>
  );
}
