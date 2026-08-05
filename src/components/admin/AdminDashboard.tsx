import React, { useState, useEffect } from 'react';
import { Shield, Users, BookOpen, MessageSquare, Trash2, Inbox } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { BlogManagement } from './BlogManagement';
import { FeedbackManagement } from './FeedbackManagement';
import { getSafeErrorMessage } from '../../lib/errors';
import { usePageMeta } from '../../lib/seo';
import type { Plan } from '../../lib/entitlements';

interface AdminUserRow {
  id: string;
  email: string;
  username: string | null;
  created_at: string;
  is_admin_user: boolean;
  plan: Plan;
  current_period_end: string | null;
  is_stripe_backed: boolean;
}

/** Plans an admin may set by hand. 'pro' is owned by the Stripe webhook and is
 *  deliberately absent — `admin_set_user_plan` rejects it (PBP06). Comping
 *  someone is what 'founding' is for. */
const ASSIGNABLE_PLANS: { value: Plan; label: string }[] = [
  { value: 'free', label: 'Free' },
  { value: 'founding', label: 'Founding' },
];

const PLAN_BADGE: Record<Plan, string> = {
  free: 'bg-chalk/10 text-chalk/70',
  founding: 'bg-primary/15 text-primary',
  pro: 'bg-primary/15 text-primary',
};

const PLAN_LABEL: Record<Plan, string> = {
  free: 'Free',
  founding: 'Founding',
  pro: 'Pro (Stripe)',
};

export function AdminDashboard() {
  usePageMeta({ title: 'Admin', path: '/admin' });
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'blog' | 'feedback' | 'moderation'>('users');
  const [search, setSearch] = useState('');
  const [savingPlanFor, setSavingPlanFor] = useState<string | null>(null);

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
      setError(getSafeErrorMessage(err, 'Failed to load users'));
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
      setError(getSafeErrorMessage(err, 'Failed to delete user'));
    }
  };

  const handleSetPlan = async (user: AdminUserRow, newPlan: Plan) => {
    if (newPlan === user.plan) return;

    // Only confirm on the destructive direction; granting access is cheap to undo.
    if (
      newPlan === 'free' &&
      !confirm(`Remove Pro access from ${user.email}? They'll be dropped to the free plan limits.`)
    ) {
      return;
    }

    // Optimistic, with a snapshot to roll back to — same pattern as
    // FeedbackManagement.updateStatus(), plus a pending flag so the select
    // can't be driven again mid-write.
    const previous = users;
    setError(null);
    setSavingPlanFor(user.id);
    setUsers(prev =>
      prev.map(u =>
        u.id === user.id ? { ...u, plan: newPlan, current_period_end: null } : u,
      ),
    );

    try {
      const { error: rpcError } = await supabase.rpc('admin_set_user_plan', {
        target_user_id: user.id,
        new_plan: newPlan,
      });
      if (rpcError) throw rpcError;
    } catch (err) {
      setUsers(previous);
      setError(getSafeErrorMessage(err, 'Failed to update plan'));
    } finally {
      setSavingPlanFor(null);
    }
  };

  const visibleUsers = users.filter(u => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      u.email?.toLowerCase().includes(q) || (u.username?.toLowerCase().includes(q) ?? false)
    );
  });

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
                <div className="mb-4 flex items-center gap-3">
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by email or username…"
                    aria-label="Search users"
                    className="w-72 max-w-full px-3 py-1.5 bg-board border border-chalk/20 rounded-lg text-sm text-chalk placeholder:text-chalk/40 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span className="ml-auto text-sm text-chalk/50">
                    {visibleUsers.length} of {users.length} user{users.length === 1 ? '' : 's'}
                  </span>
                </div>
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
                        <th className="px-4 py-2 text-left text-chalk">Plan</th>
                        <th className="px-4 py-2 text-left text-chalk">Joined</th>
                        <th className="px-4 py-2 text-right text-chalk">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleUsers.map((user) => (
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
                          <td className="px-4 py-2">
                            {user.is_stripe_backed ? (
                              // Paying subscriber — the server refuses to change these
                              // (PBP06), so don't offer a control that can only fail.
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_BADGE[user.plan]}`}
                                title="Managed by Stripe — cancel the subscription in Stripe to change this"
                              >
                                {PLAN_LABEL[user.plan]}
                              </span>
                            ) : (
                              <select
                                aria-label={`Plan for ${user.email}`}
                                value={user.plan}
                                disabled={savingPlanFor === user.id}
                                onChange={(e) => handleSetPlan(user, e.target.value as Plan)}
                                className={`px-2 py-1 rounded-lg border border-chalk/20 bg-board text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 ${PLAN_BADGE[user.plan]}`}
                              >
                                {ASSIGNABLE_PLANS.map(({ value, label }) => (
                                  <option key={value} value={value}>{label}</option>
                                ))}
                              </select>
                            )}
                          </td>
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
                {!loading && visibleUsers.length === 0 && (
                  <p className="py-8 text-center text-sm text-chalk/50">
                    {users.length === 0
                      ? 'No users yet.'
                      : `No users match “${search}”.`}
                  </p>
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