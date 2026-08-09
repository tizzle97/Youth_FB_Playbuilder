import React, { useEffect, useState } from 'react';
import { Inbox, MessageSquareReply } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getSafeErrorMessage } from '../../lib/errors';
import {
  STATUS_BLURB,
  STATUS_CLASSES,
  TYPE_META,
  type FeedbackStatus,
  type FeedbackType,
} from './meta';

interface MyFeedbackRow {
  id: string;
  type: FeedbackType;
  content: string;
  status: FeedbackStatus;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
}

/**
 * A coach's own submissions and whatever came back.
 *
 * The "Users can view their own feedback" RLS policy has existed since the
 * original migration and never had a consumer — until now, sending feedback
 * was strictly fire-and-forget, with a two-second toast as the entire
 * acknowledgement. No new policy is needed: this reads exactly what that
 * policy already permits.
 */
export function MyFeedback({ userId }: { userId: string }) {
  const [rows, setRows] = useState<MyFeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error: selectError } = await supabase
          .from('feedback')
          .select('id, type, content, status, admin_reply, replied_at, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (selectError) throw selectError;
        if (!cancelled) setRows(data || []);
      } catch (err) {
        if (!cancelled) setError(getSafeErrorMessage(err, 'Failed to load your feedback'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Nothing sent yet is the common case — don't hand every coach an empty
  // panel explaining a feature they've never used.
  if (loading || (!error && rows.length === 0)) return null;

  return (
    <div className="p-4 bg-board rounded-lg border border-chalk/10 space-y-4">
      <div className="flex items-center gap-2">
        <Inbox className="h-5 w-5 text-primary" />
        <h3 className="text-chalk font-medium">Your Feedback</h3>
        <span className="text-chalk/50 text-sm">
          {rows.length} submission{rows.length === 1 ? '' : 's'}
        </span>
      </div>

      {error ? (
        <p className="text-red-500 text-sm">{error}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const meta = TYPE_META[row.type] ?? TYPE_META.general;
            const TypeIcon = meta.icon;
            return (
              <li key={row.id} className="bg-board-light rounded-lg border border-chalk/10 p-3">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.classes}`}>
                    <TypeIcon className="h-3 w-3" />
                    {meta.label}
                  </span>
                  <span className="text-xs text-chalk/50">
                    {new Date(row.created_at).toLocaleDateString()}
                  </span>
                  {/* Titled, because "reviewed" and "resolved" mean nothing
                      on their own to the person who sent the message. */}
                  <span
                    title={STATUS_BLURB[row.status]}
                    className={`ml-auto px-2 py-0.5 rounded-lg border text-xs font-medium capitalize ${STATUS_CLASSES[row.status]}`}
                  >
                    {row.status}
                  </span>
                </div>

                <p className="text-sm text-chalk/80 whitespace-pre-wrap">{row.content}</p>

                {row.admin_reply && (
                  <div className="mt-3 pl-3 border-l-2 border-primary/50">
                    <p className="text-xs text-primary flex items-center gap-1.5 mb-1">
                      <MessageSquareReply className="h-3.5 w-3.5" />
                      Playbuilder Pro
                      {row.replied_at && ` · ${new Date(row.replied_at).toLocaleDateString()}`}
                    </p>
                    <p className="text-sm text-chalk whitespace-pre-wrap">{row.admin_reply}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
