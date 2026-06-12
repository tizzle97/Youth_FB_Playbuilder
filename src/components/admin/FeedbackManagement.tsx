import React, { useEffect, useState } from 'react';
import { Bug, Lightbulb, MessageCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface FeedbackItem {
  id: string;
  user_id: string | null;
  email: string | null;
  type: 'bug' | 'feature' | 'general';
  content: string;
  status: 'pending' | 'reviewed' | 'resolved';
  created_at: string;
}

const TYPE_META = {
  bug: { icon: Bug, label: 'Bug', classes: 'bg-red-500/15 text-red-400' },
  feature: { icon: Lightbulb, label: 'Feature', classes: 'bg-yellow-500/15 text-yellow-400' },
  general: { icon: MessageCircle, label: 'General', classes: 'bg-blue-500/15 text-blue-400' },
} as const;

const STATUS_CLASSES: Record<FeedbackItem['status'], string> = {
  pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  reviewed: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  resolved: 'bg-green-500/15 text-green-400 border-green-500/30',
};

export function FeedbackManagement() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | FeedbackItem['type']>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | FeedbackItem['status']>('all');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data, error: rpcError } = await supabase.rpc('admin_list_feedback');
        if (rpcError) throw rpcError;
        setItems(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load feedback');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateStatus = async (id: string, status: FeedbackItem['status']) => {
    const previous = items;
    setItems((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
    const { error: updateError } = await supabase.from('feedback').update({ status }).eq('id', id);
    if (updateError) {
      setItems(previous);
      setError(`Failed to update status: ${updateError.message}`);
    }
  };

  const filtered = items.filter(
    (f) => (typeFilter === 'all' || f.type === typeFilter) && (statusFilter === 'all' || f.status === statusFilter),
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-chalk/10 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          className="px-3 py-1.5 bg-board border border-chalk/20 rounded-lg text-sm text-chalk focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All types</option>
          <option value="bug">Bugs</option>
          <option value="feature">Feature requests</option>
          <option value="general">General</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="px-3 py-1.5 bg-board border border-chalk/20 rounded-lg text-sm text-chalk focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="reviewed">Reviewed</option>
          <option value="resolved">Resolved</option>
        </select>
        <span className="ml-auto self-center text-sm text-chalk/50">
          {filtered.length} of {items.length} message{items.length === 1 ? '' : 's'}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-chalk/60 text-sm py-8 text-center">
          {items.length === 0 ? 'No feedback has been submitted yet.' : 'No feedback matches the selected filters.'}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((f) => {
            const meta = TYPE_META[f.type] ?? TYPE_META.general;
            const TypeIcon = meta.icon;
            return (
              <div key={f.id} className="bg-board rounded-lg border border-chalk/10 p-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.classes}`}>
                    <TypeIcon className="h-3 w-3" />
                    {meta.label}
                  </span>
                  <span className="text-xs text-chalk/50">
                    {f.email || 'Unknown user'} · {new Date(f.created_at).toLocaleString()}
                  </span>
                  <select
                    value={f.status}
                    onChange={(e) => updateStatus(f.id, e.target.value as FeedbackItem['status'])}
                    className={`ml-auto px-2 py-1 rounded-lg border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary ${STATUS_CLASSES[f.status]} bg-board`}
                  >
                    <option value="pending">Pending</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
                <p className="text-sm text-chalk whitespace-pre-wrap">{f.content}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
