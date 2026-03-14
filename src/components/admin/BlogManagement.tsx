import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, Calendar, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';

interface BlogPost {
  id: string;
  title: string;
  content: string;
  author_id: string;
  published_at: string;
  created_at: string;
  updated_at: string;
}

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (post: { title: string; content: string }) => void;
  editingPost?: BlogPost | null;
}

function CreatePostModal({ isOpen, onClose, onSave, editingPost }: CreatePostModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingPost) {
      setTitle(editingPost.title);
      setContent(editingPost.content);
    } else {
      setTitle('');
      setContent('');
    }
  }, [editingPost, isOpen]);

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return;
    
    setSaving(true);
    try {
      await onSave({ title: title.trim(), content: content.trim() });
      setTitle('');
      setContent('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
        <div className="fixed inset-0 transition-opacity bg-black bg-opacity-75" onClick={onClose} />

        <div className="inline-block w-full max-w-4xl overflow-hidden text-left align-middle transition-all transform bg-board-light rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-chalk/10">
            <h3 className="text-2xl font-bold text-chalk">
              {editingPost ? 'Edit Blog Post' : 'Create New Blog Post'}
            </h3>
            <button
              onClick={onClose}
              className="text-chalk/70 hover:text-chalk transition-colors"
            >
              ×
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-chalk mb-2">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter blog post title..."
                className="w-full px-3 py-2 bg-board border border-chalk/20 rounded-lg text-chalk focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-chalk mb-2">
                Content
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your blog post content here..."
                rows={15}
                className="w-full px-3 py-2 bg-board border border-chalk/20 rounded-lg text-chalk focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-chalk/10">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-chalk bg-board border border-chalk/20 rounded-md hover:bg-board-light"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !title.trim() || !content.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : editingPost ? 'Update Post' : 'Publish Post'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BlogManagement() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('blog_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setPosts(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load blog posts');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async (postData: { title: string; content: string }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('blog_posts')
        .insert([
          {
            title: postData.title,
            content: postData.content,
            author_id: user.id
          }
        ]);

      if (error) throw error;
      await fetchPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create blog post');
    }
  };

  const handleUpdatePost = async (postData: { title: string; content: string }) => {
    if (!editingPost) return;

    try {
      const { error } = await supabase
        .from('blog_posts')
        .update({
          title: postData.title,
          content: postData.content,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingPost.id);

      if (error) throw error;
      await fetchPosts();
      setEditingPost(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update blog post');
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this blog post? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('blog_posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;
      setPosts(posts.filter(post => post.id !== postId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete blog post');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-chalk">Blog Management</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Post
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 bg-board rounded-lg border border-chalk/10 animate-pulse">
              <div className="h-6 bg-chalk/10 rounded w-2/3 mb-2"></div>
              <div className="h-4 bg-chalk/10 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12">
          <Eye className="h-12 w-12 text-chalk/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-chalk mb-2">No blog posts yet</h3>
          <p className="text-chalk/70">Create your first blog post to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} className="p-4 bg-board rounded-lg border border-chalk/10">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-chalk mb-2">{post.title}</h3>
                  <div className="flex items-center gap-4 text-sm text-chalk/70 mb-3">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>Published {format(new Date(post.published_at), 'MMM d, yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      <span>Admin</span>
                    </div>
                  </div>
                  <p className="text-chalk/70 line-clamp-3">
                    {post.content.substring(0, 200)}...
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => {
                      setEditingPost(post);
                      setShowCreateModal(true);
                    }}
                    className="p-2 text-chalk/70 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    title="Edit Post"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="p-2 text-chalk/70 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete Post"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreatePostModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingPost(null);
        }}
        onSave={editingPost ? handleUpdatePost : handleCreatePost}
        editingPost={editingPost}
      />
    </div>
  );
}