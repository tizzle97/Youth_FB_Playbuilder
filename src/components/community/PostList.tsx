import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, ArrowUp, ArrowDown, Pencil, Trash2 } from 'lucide-react';
import type { TimeRange } from '../../types/community';
import { supabase } from '../../lib/supabase';
import { getSafeErrorMessage } from '../../lib/errors';
import { sanitizePostContent } from '../../lib/sanitizeHtml';
import { PostFormModal } from './PostFormModal';
import { CommentThread } from './CommentThread';

interface PostListProps {
  posts: any[];
  loading: boolean;
  timeRange: TimeRange;
  searchQuery: string;
  /** The signed-in viewer's id, or null if signed out — decides which posts
   *  show Edit/Delete. RLS already scopes the actual writes to the owner;
   *  this only controls whether the buttons render. */
  currentUserId: string | null;
  /** Re-fetches the post list — called after a successful edit or delete. */
  onChanged: () => void;
}

/** A post has been edited if its updated_at moved past created_at. Compared
 *  as Date values, not strings — Postgres may format an unchanged timestamp
 *  with different trailing precision than the value it was inserted with. */
function wasEdited(post: { created_at: string; updated_at?: string }): boolean {
  if (!post.updated_at) return false;
  return new Date(post.updated_at).getTime() > new Date(post.created_at).getTime();
}

export function PostList({ posts, loading, timeRange: _timeRange, searchQuery, currentUserId, onChanged }: PostListProps) {
  const [editingPost, setEditingPost] = useState<{ id: string; title: string; content: string } | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);

  const handleVote = async (postId: string, voteType: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('votes')
        .insert([
          {
            post_id: postId,
            user_id: user.id,
            vote_type: voteType
          }
        ]);

      if (error) throw error;
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      return;
    }
    setDeleteError('');
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);
      if (error) throw error;
      onChanged();
    } catch (err) {
      console.error('Error deleting post:', err);
      setDeleteError(getSafeErrorMessage(err, 'Failed to delete post'));
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-board-light rounded-lg p-6 border border-chalk/10 animate-pulse">
            <div className="h-4 bg-chalk/10 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-chalk/10 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="h-12 w-12 text-chalk/30 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-chalk mb-2">No posts found</h3>
        <p className="text-chalk/70">
          {searchQuery
            ? "No posts match your search criteria"
            : "Be the first to start a discussion!"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {deleteError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-500">{deleteError}</p>
        </div>
      )}

      {posts.map((post) => {
        const isOwnPost = currentUserId !== null && post.user_id === currentUserId;
        return (
          <article key={post.id} className="bg-board-light rounded-lg p-6 border border-chalk/10">
            <div className="flex gap-4">
              {/* Voting */}
              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={() => handleVote(post.id, true)}
                  className="p-1 text-chalk/70 hover:text-primary transition-colors"
                >
                  <ArrowUp className="h-6 w-6" />
                </button>
                <span className="text-chalk font-bold">{post.upvotes - post.downvotes}</span>
                <button
                  onClick={() => handleVote(post.id, false)}
                  className="p-1 text-chalk/70 hover:text-primary transition-colors"
                >
                  <ArrowDown className="h-6 w-6" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden shrink-0">
                      {post.author?.avatar_url ? (
                        <img src={post.author.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                      ) : (
                        <span className="text-primary text-sm">
                          {post.author?.username?.[0]?.toUpperCase() || 'U'}
                        </span>
                      )}
                    </div>
                    <span className="text-chalk/70 shrink-0">Posted by</span>
                    <span className="text-primary font-medium shrink-0">
                      {post.author?.username || 'Anonymous'}
                    </span>
                    <span className="text-chalk/50 shrink-0">•</span>
                    <span className="text-chalk/70 truncate">
                      {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                      {wasEdited(post) && <span className="text-chalk/50"> · edited</span>}
                    </span>
                  </div>

                  {isOwnPost && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setEditingPost({ id: post.id, title: post.title, content: post.content })}
                        title="Edit Post"
                        className="p-1.5 text-chalk/60 hover:text-chalk rounded-lg hover:bg-white/10 transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(post.id)}
                        title="Delete Post"
                        className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                <h3 className="text-xl font-bold text-chalk mb-2">{post.title}</h3>
                {/* The one line in this file that renders untrusted content
                    as HTML — must never lose the sanitizePostContent() call.
                    posts RLS only checks auth.uid() = user_id, not content
                    shape, so this is the actual security boundary regardless
                    of what PostFormModal already sanitized on write. */}
                <div
                  className="community-post-content text-chalk/70 mb-4"
                  dangerouslySetInnerHTML={{ __html: sanitizePostContent(post.content) }}
                />

                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setExpandedPostId((cur) => (cur === post.id ? null : post.id))}
                    className="flex items-center gap-2 text-chalk/70 hover:text-chalk transition-colors"
                  >
                    <MessageSquare className="h-5 w-5" />
                    <span>{post.comment_count || 0} Comments</span>
                  </button>
                </div>

                {expandedPostId === post.id && (
                  <CommentThread
                    postId={post.id}
                    currentUserId={currentUserId}
                    onCommentsChanged={onChanged}
                  />
                )}
              </div>
            </div>
          </article>
        );
      })}

      {editingPost && (
        <PostFormModal
          isOpen={true}
          onClose={() => setEditingPost(null)}
          onSaved={onChanged}
          post={editingPost}
        />
      )}
    </div>
  );
}