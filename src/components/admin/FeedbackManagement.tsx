import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Bot, ExternalLink, RefreshCw, Reply } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getSafeErrorMessage } from '../../lib/errors';
import {
  STATUS_CLASSES,
  TYPE_META,
  type FeedbackStatus,
  type FeedbackType,
  type TriageClass,
  type TriageState,
} from '../feedback/meta';

interface FeedbackItem {
  id: string;
  user_id: string | null;
  email: string | null;
  type: FeedbackType;
  content: string;
  page_path: string | null;
  status: FeedbackStatus;
  admin_reply: string | null;
  replied_at: string | null;
  triage_class: TriageClass | null;
  triage_state: TriageState | null;
  triage_ref: string | null;
  triage_notes: string | null;
  triaged_at: string | null;
  created_at: string;
}

const TRIAGE_STATE_CLASSES: Record<TriageState, string> = {
  untriaged: 'text-chalk/40',
  triaged: 'text-chalk/60',
  skipped: 'text-chalk/40',
  // The one triage outcome that exists specifically to summon a human.
  flagged: 'text-red-400',
};

export function FeedbackManagement() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | FeedbackType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | FeedbackStatus>('all');
  const [triageFilter, setTriageFilter] = useState<'all' | TriageState>('all');
  // id of the row whose reply box is open → the draft text in it.
  const [replyDraft, setReplyDraft] = useState<{ id: string; text: string } | null>(null);
  const [savingReply, setSavingReply] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { data, error: rpcError } = await supabase.rpc('admin_list_feedback');
      if (rpcError) throw rpcError;
      setItems(data || []);
    } catch (err) {
      setError(getSafeErrorMessage(err, 'Failed to load feedback'));
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const updateStatus = async (id: string, status: FeedbackStatus) => {
    const previous = items;
    setItems((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
    const { error: updateError } = await supabase.from('feedback').update({ status }).eq('id', id);
    if (updateError) {
      setItems(previous);
      setError(`Failed to update status: ${updateError.message}`);
    }
  };

  const saveReply = async (id: string, text: string) => {
    const trimmed = text.trim();
    const previous = items;
    // Clearing the box removes the reply rather than saving an empty string —
    // otherwise the submitter sees a blank "we replied" block.
    const reply = trimmed || null;
    const replied_at = reply ? new Date().toISOString() : null;

    setSavingReply(true);
    setItems((prev) => prev.map((f) => (f.id === id ? { ...f, admin_reply: reply, replied_at } : f)));
    const { error: updateError } = await supabase
      .from('feedback')
      .update({ admin_reply: reply, replied_at })
      .eq('id', id);
    setSavingReply(false);

    if (updateError) {
      setItems(previous);
      setError(`Failed to save reply: ${updateError.message}`);
      return;
    }
    setReplyDraft(null);
  };

  const filtered = items.filter(
    (f) =>
      (typeFilter === 'all' || f.type === typeFilter) &&
      (statusFilter === 'all' || f.status === statusFilter) &&
      (triageFilter === 'all' || (f.triage_state ?? 'untriaged') === triageFilter),
  );

  const flaggedCount = items.filter((f) => f.triage_state === 'flagged').length;

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

      {flaggedCount > 0 && (
        // Not a filter hint — a flagged item is one the triage agent refused to
        // act on because the text tried to issue it instructions.
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            {flaggedCount} item{flaggedCount === 1 ? '' : 's'} flagged by triage as a possible
            prompt-injection attempt. No automated action was taken on {flaggedCount === 1 ? 'it' : 'them'}.
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          aria-label="Filter by type"
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
          aria-label="Filter by status"
          className="px-3 py-1.5 bg-board border border-chalk/20 rounded-lg text-sm text-chalk focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="reviewed">Reviewed</option>
          <option value="resolved">Resolved</option>
        </select>
        <select
          value={triageFilter}
          onChange={(e) => setTriageFilter(e.target.value as typeof triageFilter)}
          aria-label="Filter by triage state"
          className="px-3 py-1.5 bg-board border border-chalk/20 rounded-lg text-sm text-chalk focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All triage states</option>
          <option value="untriaged">Untriaged</option>
          <option value="triaged">Triaged</option>
          <option value="skipped">Skipped</option>
          <option value="flagged">Flagged</option>
        </select>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-board border border-chalk/20 rounded-lg text-sm text-chalk/70 hover:text-chalk transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
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
            const triageState = f.triage_state ?? 'untriaged';
            const replying = replyDraft?.id === f.id;
            return (
              <div
                key={f.id}
                className={`bg-board rounded-lg border p-4 ${
                  triageState === 'flagged' ? 'border-red-500/40' : 'border-chalk/10'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.classes}`}>
                    <TypeIcon className="h-3 w-3" />
                    {meta.label}
                  </span>
                  <span className="text-xs text-chalk/50">
                    {f.email || 'Unknown user'} · {new Date(f.created_at).toLocaleString()}
                    {f.page_path && ` · on ${f.page_path}`}
                  </span>
                  <select
                    value={f.status}
                    onChange={(e) => updateStatus(f.id, e.target.value as FeedbackStatus)}
                    aria-label="Status"
                    className={`ml-auto px-2 py-1 rounded-lg border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary ${STATUS_CLASSES[f.status]} bg-board`}
                  >
                    <option value="pending">Pending</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>

                <p className="text-sm text-chalk whitespace-pre-wrap">{f.content}</p>

                {/* The agent's lane, deliberately subordinate to `status`
                    above — see the note in supabase/feedback_triage.sql. */}
                <div className={`mt-3 pt-2 border-t border-chalk/10 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs ${TRIAGE_STATE_CLASSES[triageState]}`}>
                  <Bot className="h-3.5 w-3.5" />
                  <span className="font-medium">triage: {triageState}</span>
                  {f.triage_class && <span>· classed {f.triage_class}</span>}
                  {f.triage_ref &&
                    (/^https?:\/\//.test(f.triage_ref) ? (
                      <a
                        href={f.triage_ref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        · {f.triage_ref.replace(/^https?:\/\/(www\.)?github\.com\//, '')}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span>· {f.triage_ref}</span>
                    ))}
                  {f.triage_notes && <span className="basis-full text-chalk/50">{f.triage_notes}</span>}
                </div>

                {/* Reply */}
                <div className="mt-3">
                  {replying ? (
                    <div className="space-y-2">
                      <textarea
                        value={replyDraft.text}
                        onChange={(e) => setReplyDraft({ id: f.id, text: e.target.value })}
                        rows={3}
                        aria-label="Reply to submitter"
                        placeholder="This is shown to the person who sent the feedback."
                        className="w-full px-3 py-2 bg-board-light border border-chalk/20 rounded-md text-sm text-chalk placeholder-chalk/40 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveReply(f.id, replyDraft.text)}
                          disabled={savingReply}
                          className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-md text-xs transition-colors disabled:opacity-50"
                        >
                          {savingReply ? 'Saving…' : 'Save reply'}
                        </button>
                        <button
                          onClick={() => setReplyDraft(null)}
                          className="px-3 py-1.5 text-chalk/60 hover:text-chalk text-xs transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : f.admin_reply ? (
                    <div className="bg-board-light rounded-md p-3">
                      <p className="text-xs text-chalk/50 mb-1">
                        Your reply{f.replied_at && ` · ${new Date(f.replied_at).toLocaleDateString()}`}
                      </p>
                      <p className="text-sm text-chalk whitespace-pre-wrap">{f.admin_reply}</p>
                      <button
                        onClick={() => setReplyDraft({ id: f.id, text: f.admin_reply ?? '' })}
                        className="mt-2 text-xs text-primary hover:underline"
                      >
                        Edit
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setReplyDraft({ id: f.id, text: '' })}
                      className="inline-flex items-center gap-1.5 text-xs text-chalk/60 hover:text-chalk transition-colors"
                    >
                      <Reply className="h-3.5 w-3.5" />
                      Reply
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
