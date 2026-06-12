import React, { useState, useEffect } from 'react';
import { Shield, Users, BookOpen, MessageSquare, Trash2, Inbox } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { BlogManagement } from './BlogManagement';
import { FeedbackManagement } from './FeedbackManagement';

interface User {
  id: string;
  email: string;
  created_at: string;
  user_metadata: {
    username?: string;
  };
}

export function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
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
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser?.user_metadata?.is_admin) {
        throw new Error('Unauthorized access');
      }

      const { data: users, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setUsers(users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase.rpc('delete_user', { user_id: userId });
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
                            {user.user_metadata?.username || 'Anonymous'}
                          </td>
                          <td className="px-4 py-2 text-chalk">{user.email}</td>
                          <td className="px-4 py-2 text-chalk">
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Delete User"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
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