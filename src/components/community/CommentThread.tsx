import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getSafeErrorMessage } from '../../lib/errors';

interface CommentRow {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author?: { username: string; avatar_url: string | null };
}

interface CommentThreadProps {
  postId: string;
  /** The signed-in viewer's id, or null if signed out — decides which
   *  comments show a Delete button. RLS (auth.uid() = user_id) is the real
   *  boundary; this only controls whether the button renders. */
  currentUserId: string | null;
  /** Re-fetches the post list (same callback PostList already gets from
   *  CommunityPage for post edit/delete) — called after a comment is added
   *  or removed so the collapsed "N Comments" count stays accurate. Local
   *  `comments` state below refreshes independently via fetchComments(), so
   *  this doesn't collapse the open thread. */
  onCommentsChanged: () => void;
}

/**
 * Flat (no nested replies, despite `comments.parent_id` existing in the
 * schema for that) comment thread for one post — expanded inline under it.
 * `comments` RLS lets any authenticated user comment on any post, including
 * their own; this is a UI-only gate (sign-in required to post), not an
 * ownership restriction, matching the RLS it's built on.
 */
export function CommentThread({ postId, currentUserId, onCommentsChanged }: CommentThreadProps) {
  const navigate = useNavigate();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: fetchError } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      if (fetchError) throw fetchError;

      const rows = data || [];
      const authorIds = Array.from(new Set(rows.map((c) => c.user_id)));
      let authorsById: Record<string, { username: string; avatar_url: string | null }> = {};
      if (authorIds.length > 0) {
        const { data: authors, error: authorsError } = await supabase.rpc('get_community_authors', {
          target_ids: authorIds,
        });
        if (authorsError) {
          console.error('Error fetching comment authors:', authorsError);
        } else {
          authorsById = Object.fromEntries((authors || []).map((a: any) => [a.id, a]));
        }
      }

      setComments(rows.map((c) => ({ ...c, author: authorsById[c.user_id] })));
    } catch (err) {
      console.error('Error fetching comments:', err);
      setError(getSafeErrorMessage(err, 'Failed to load comments'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setError('');
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }
      const { error: insertError } = await supabase
        .from('comments')
        .insert([{ post_id: postId, content: draft.trim(), user_id: user.id }]);
      if (insertError) throw insertError;

      setDraft('');
      onCommentsChanged();
      await fetchComments();
    } catch (err) {
      console.error('Error posting comment:', err);
      setError(getSafeErrorMessage(err, 'Failed to post comment'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('Delete this comment? This action cannot be undone.')) return;
    setError('');
    try {
      const { error: deleteError } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);
      if (deleteError) throw deleteError;
      onCommentsChanged();
      await fetchComments();
    } catch (err) {
      console.error('Error deleting comment:', err);
      setError(getSafeErrorMessage(err, 'Failed to delete comment'));
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-chalk/10 space-y-3">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-chalk/50">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-chalk/50">No comments yet — be the first to reply.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((comment) => {
            const isOwnComment = currentUserId !== null && comment.user_id === currentUserId;
            return (
              <li key={comment.id} className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden shrink-0 mt-0.5">
                  {comment.author?.avatar_url ? (
                    <img src={comment.author.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                  ) : (
                    <span className="text-primary text-xs">
                      {comment.author?.username?.[0]?.toUpperCase() || 'U'}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-primary font-medium text-sm">
                      {comment.author?.username || 'Anonymous'}
                    </span>
                    <span className="text-chalk/50 text-xs">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </span>
                    {isOwnComment && (
                      <button
                        onClick={() => handleDelete(comment.id)}
                        title="Delete Comment"
                        className="tap-target ml-auto flex items-center justify-center p-1 text-chalk/40 hover:text-red-400 rounded transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {/* Comments are plain text — never HTML-rendered, so this
                      needs no sanitization the way post content does. */}
                  <p className="text-chalk/80 text-sm whitespace-pre-wrap break-words">{comment.content}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex items-start gap-2 pt-1">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a comment…"
          rows={2}
          className="flex-1 rounded-md border border-chalk/20 bg-board text-chalk text-sm shadow-sm px-3 py-2 placeholder-chalk/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
        />
        <button
          type="submit"
          disabled={submitting || !draft.trim()}
          className="px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          {submitting ? 'Posting…' : 'Comment'}
        </button>
      </form>
    </div>
  );
}
