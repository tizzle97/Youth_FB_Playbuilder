import React, { useState, useEffect } from 'react';
import { Shield, Users, BookOpen, MessageSquare, Trash2, Inbox } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { BlogManagement } from './BlogManagement';
import { FeedbackManagement } from './FeedbackManagement';

interface AdminUserRow {
  id: string;
  email: string;
  username: string | null;
  created_at: string;
  is_admin_user: boolean;
}

export function AdminDashboard() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'blog' | 'feedback' | 'moderation'>('users');

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      // Admin access is enforced server-side: admin_list_users() raises
      // unless the caller is in the admin_users table
      const { data, error: fetchError } = await supabase.rpc('admin_list_users');
      if (fetchError) throw fetchError;
      setUsers(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? Their account and all of their data will be permanently removed.')) {
      return;
    }

    try {
      const { error } = await supabase.rpc('delete_user', { target_user_id: userId });
      if (error) throw error;

      setUsers(users.filter(user => user.id !== userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  return (
    <div className="min-h-screen bg-board py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-board-light rounded-xl border border-chalk/10 overflow-hidden">
          <div className="px-6 py-4 border-b border-chalk/10">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold text-chalk">Admin Dashboard</h1>
            </div>

            <div className="mt-4 flex gap-4">
              <button
                onClick={() => setActiveTab('users')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  activeTab === 'users'
                    ? 'bg-primary text-white'
                    : 'text-chalk/70 hover:text-chalk hover:bg-board'
                }`}
              >
                <Users className="h-4 w-4" />
                Users
              </button>
              <button
                onClick={() => setActiveTab('blog')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  activeTab === 'blog'
                    ? 'bg-primary text-white'
                    : 'text-chalk/70 hover:text-chalk hover:bg-board'
                }`}
              >
                <BookOpen className="h-4 w-4" />
                Blog Posts
              </button>
              <button
                onClick={() => setActiveTab('feedback')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  activeTab === 'feedback'
                    ? 'bg-primary text-white'
                    : 'text-chalk/70 hover:text-chalk hover:bg-board'
                }`}
              >
                <Inbox className="h-4 w-4" />
                Feedback
              </button>
              <button
                onClick={() => setActiveTab('moderation')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  activeTab === 'moderation'
                    ? 'bg-primary text-white'
                    : 'text-chalk/70 hover:text-chalk hover:bg-board'
                }`}
              >
                <MessageSquare className="h-4 w-4" />
                Moderation
              </button>
            </div>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500">
                {error}
              </div>
            )}

            {activeTab === 'users' && (
              <div className="overflow-x-auto">
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 bg-chalk/10 rounded animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-chalk/10">
                        <th className="px-4 py-2 text-left text-chalk">User</th>
                        <th className="px-4 py-2 text-left text-chalk">Email</th>
                        <th className="px-4 py-2 text-left text-chalk">Joined</th>
                        <th className="px-4 py-2 text-right text-chalk">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="border-b border-chalk/10">
                          <td className="px-4 py-2 text-chalk">
                            {user.username || 'Anonymous'}
                            {user.is_admin_user && (
                              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/15 text-primary">
                                Admin
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-chalk">{user.email}</td>
                          <td className="px-4 py-2 text-chalk">
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {!user.is_admin_user && (
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                title="Delete User"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === 'blog' && <BlogManagement />}

            {activeTab === 'feedback' && <FeedbackManagement />}

            {activeTab === 'moderation' && (
              <div className="text-chalk">
                {/* Comment moderation UI will be added here */}
                Coming soon: Comment moderation
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}