import React, { useState } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<'bug' | 'feature' | 'general'>('general');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      if (!content.trim()) {
        throw new Error('Please provide feedback content');
      }

      const { error: submitError } = await supabase
        .from('feedback')
        .insert([
          {
            user_id: user.id,
            type,
            content
          }
        ]);

      if (submitError) throw submitError;

      setSuccess('Thank you for your feedback!');
      setContent('');
      setTimeout(() => {
        setIsOpen(false);
        setSuccess('');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-primary hover:bg-primary-dark text-white rounded-full p-3 shadow-lg transition-colors"
        title="Give Feedback"
      >
        <MessageSquare className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-board-light rounded-lg shadow-xl border border-chalk/10">
      <div className="flex items-center justify-between px-4 py-3 border-b border-chalk/10">
        <h3 className="text-lg font-semibold text-chalk">Give Feedback</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-chalk/70 hover:text-chalk transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-4">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-chalk mb-1">
              Feedback Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['bug', 'feature', 'general'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`px-3 py-2 text-sm rounded-md capitalize ${
                    type === t
                      ? 'bg-primary text-white'
                      : 'bg-board text-chalk/70 hover:text-chalk border border-chalk/20'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-medium text-chalk mb-1">
              Your Feedback
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 bg-board border border-chalk/20 rounded-md text-chalk placeholder-chalk/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Share your thoughts, suggestions, or report issues..."
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm bg-red-500/10 p-3 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="text-green-500 text-sm bg-green-500/10 p-3 rounded-lg">
              {success}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}