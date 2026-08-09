import React, { useState } from 'react';
import { X } from 'lucide-react';
import { getSafeErrorMessage } from '../../lib/errors';
import { supabase } from '../../lib/supabase';

interface PostFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Present to edit an existing post in place; absent to create a new one. */
  post?: { id: string; title: string; content: string };
}

export function PostFormModal({ isOpen, onClose, onSaved, post }: PostFormModalProps) {
  const isEditing = !!post;
  const [title, setTitle] = useState(post?.title ?? '');
  const [content, setContent] = useState(post?.content ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(isEditing ? 'You must be signed in to edit a post' : 'You must be signed in to create a post');

      if (isEditing) {
        // RLS (auth.uid() = user_id, unchanged by this update) already scopes
        // this to the caller's own posts — the .eq('id', ...) below is just
        // which row, not the security boundary.
        const { error: updateError } = await supabase
          .from('posts')
          .update({ title, content })
          .eq('id', post.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('posts')
          .insert([
            {
              title,
              content,
              user_id: user.id
            }
          ]);
        if (insertError) throw insertError;
      }

      setTitle('');
      setContent('');
      onSaved();
      onClose();
    } catch (err) {
      setError(getSafeErrorMessage(err, isEditing ? 'Failed to save changes' : 'Failed to create post'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-black bg-opacity-75" onClick={onClose} />

        <div className="inline-block w-full max-w-2xl my-8 overflow-hidden text-left align-middle transition-all transform bg-board-light rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-chalk/10">
            <h3 className="text-2xl font-bold text-chalk">{isEditing ? 'Edit Post' : 'Create Post'}</h3>
            <button
              onClick={onClose}
              className="text-chalk/70 hover:text-chalk transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            <div className="space-y-6">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-chalk">
                  Title
                </label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-chalk/20 bg-board text-chalk shadow-sm px-4 py-2 placeholder-chalk/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="What's on your mind?"
                  required
                />
              </div>

              <div>
                <label htmlFor="content" className="block text-sm font-medium text-chalk">
                  Content
                </label>
                <textarea
                  id="content"
                  rows={6}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-chalk/20 bg-board text-chalk shadow-sm px-4 py-2 placeholder-chalk/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Share your thoughts, strategies, or questions..."
                  required
                />
              </div>

              {error && (
                <div className="text-red-500 text-sm bg-red-500/10 p-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-chalk bg-board border border-chalk/20 rounded-md hover:bg-board-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-chalk/20"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Post')}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
