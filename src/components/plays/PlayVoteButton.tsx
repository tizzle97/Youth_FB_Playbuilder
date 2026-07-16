import React, { useState } from 'react';
import { ThumbsUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getSafeErrorMessage } from '../../lib/errors';

type PlayVoteButtonProps = {
  playId: string;
  upvotes: number;
  /** Whether the current user has already voted for this play. */
  voted: boolean;
  /** Signed-in user id; omit for signed-out viewers (count only, no voting). */
  userId?: string;
  onError?: (message: string) => void;
};

/** Upvote toggle + count for a public play (B-10). Optimistic update with
 *  rollback; the DB enforces one vote per user per play (UNIQUE + RLS). */
export function PlayVoteButton({ playId, upvotes, voted, userId, onError }: PlayVoteButtonProps) {
  const [count, setCount] = useState(upvotes);
  const [hasVoted, setHasVoted] = useState(voted);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (!userId || busy) return;
    setBusy(true);
    const next = !hasVoted;
    setHasVoted(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      if (next) {
        const { error } = await supabase
          .from('play_votes')
          .insert({ play_id: playId, user_id: userId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('play_votes')
          .delete()
          .eq('play_id', playId)
          .eq('user_id', userId);
        if (error) throw error;
      }
    } catch (err) {
      // Roll back the optimistic update
      setHasVoted(!next);
      setCount((c) => Math.max(0, c + (next ? -1 : 1)));
      onError?.(getSafeErrorMessage(err, 'Failed to save your vote'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!userId || busy}
      title={!userId ? 'Sign in to vote' : hasVoted ? 'Remove your upvote' : 'Upvote this play'}
      className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors ${
        hasVoted
          ? 'bg-primary/10 text-primary'
          : 'bg-board text-chalk/70 hover:text-chalk hover:bg-board-light'
      } ${!userId ? 'cursor-default' : ''}`}
    >
      <ThumbsUp className={`h-4 w-4 ${hasVoted ? 'fill-current' : ''}`} />
      {count}
    </button>
  );
}
