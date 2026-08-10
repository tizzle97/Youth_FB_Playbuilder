import React, { useCallback, useEffect, useState } from 'react';
import { MessageSquare, X, LogIn } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getSafeErrorMessage } from '../lib/errors';

type FeedbackType = 'bug' | 'feature' | 'general';

/** Matches the `feedback_content_len` CHECK in supabase/feedback_capture.sql
 *  and MAX_CONTENT_CHARS in the feedback-triage Edge Function. */
const MAX_CONTENT = 4000;

/** Where a half-written submission is parked across the sign-in detour.
 *  sessionStorage, not localStorage: a draft is worth surviving a redirect,
 *  not resurfacing a week later in a different tab. */
const DRAFT_KEY = 'pbp:feedback-draft';

interface Draft {
  type: FeedbackType;
  content: string;
  page_path: string;
}

function readDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.content !== 'string') return null;
    return {
      type: (['bug', 'feature', 'general'] as const).includes(parsed.type) ? parsed.type : 'general',
      content: parsed.content.slice(0, MAX_CONTENT),
      page_path: typeof parsed.page_path === 'string' ? parsed.page_path : '/',
    };
  } catch {
    // Private-mode Safari throws on sessionStorage; a lost draft must never
    // take the whole widget down with it.
    return null;
  }
}

function writeDraft(draft: Draft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* best effort */
  }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* best effort */
  }
}

export function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>('general');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  // null while unresolved — the panel shows nothing auth-dependent until we know.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // The Play Designer covers the full screen; the floating button would
  // overlap the mobile toolbar's player icons and route action buttons.
  const hidden = location.pathname === '/designer';

  // getSession() reads the locally stored session — no network round trip on
  // every page load for signed-out visitors. The authoritative getUser() check
  // still happens at submit time, where being wrong actually costs something.
  const refreshAuth = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setSignedIn(!!data.session);
    return !!data.session;
  }, []);

  // Restore a draft parked before a sign-in detour. Only once the user is
  // actually signed in — otherwise we'd pop the panel open on the auth page.
  useEffect(() => {
    if (hidden) return;
    let cancelled = false;
    (async () => {
      const isIn = await refreshAuth();
      if (cancelled || !isIn) return;
      const draft = readDraft();
      if (!draft) return;
      setType(draft.type);
      setContent(draft.content);
      setIsOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [hidden, refreshAuth]);

  const openPanel = () => {
    setIsOpen(true);
    void refreshAuth();
  };

  const closePanel = () => {
    setIsOpen(false);
    setError('');
    // Closing deliberately is the user discarding it; only the auth detour
    // should preserve text.
    clearDraft();
  };

  const goSignIn = () => {
    writeDraft({ type, content, page_path: location.pathname });
    navigate(`/auth?next=${encodeURIComponent(location.pathname + location.search)}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Session expired mid-compose. Don't throw the text away.
        setSignedIn(false);
        goSignIn();
        return;
      }

      const trimmed = content.trim();
      if (!trimmed) {
        throw new Error('Please provide feedback content');
      }
      if (trimmed.length > MAX_CONTENT) {
        throw new Error(`Please keep feedback under ${MAX_CONTENT.toLocaleString()} characters`);
      }

      const { error: submitError } = await supabase
        .from('feedback')
        .insert([
          {
            user_id: user.id,
            type,
            content: trimmed,
            page_path: location.pathname,
          }
        ]);

      if (submitError) throw submitError;

      clearDraft();
      setSuccess('Thank you for your feedback!');
      setContent('');
      setTimeout(() => {
        setIsOpen(false);
        setSuccess('');
      }, 2000);
    } catch (err) {
      setError(getSafeErrorMessage(err, 'Failed to submit feedback'));
    } finally {
      setLoading(false);
    }
  };

  if (hidden) return null;

  if (!isOpen) {
    return (
      <button
        onClick={openPanel}
        className="fixed bottom-4 right-4 z-40 bg-primary hover:bg-primary-dark text-white rounded-full p-3 shadow-lg transition-colors"
        title="Give Feedback"
      >
        <MessageSquare className="h-6 w-6" />
      </button>
    );
  }

  const overLimit = content.length > MAX_CONTENT;

  return (
    <div
      role="dialog"
      aria-label="Give Feedback"
      className="fixed bottom-4 right-4 z-40 w-96 max-w-[calc(100vw-2rem)] bg-board-light rounded-lg shadow-xl border border-chalk/10"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-chalk/10">
        <h3 className="text-lg font-semibold text-chalk">Give Feedback</h3>
        <button
          onClick={closePanel}
          className="text-chalk/70 hover:text-chalk transition-colors"
          aria-label="Close feedback"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {signedIn === false ? (
        // Say this up front rather than after they've typed a paragraph. The
        // old flow accepted the text, then redirected to /auth and lost it.
        <div className="p-4 space-y-3">
          <p className="text-sm text-chalk/80">
            Sign in to send feedback — that way we can follow up with you and you can
            see the status of what you sent.
          </p>
          <button
            onClick={goSignIn}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-md transition-colors"
          >
            <LogIn className="h-4 w-4" />
            Sign in
          </button>
        </div>
      ) : (
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
              {/* Only nag near the ceiling — a counter on a two-word note is noise. */}
              {content.length > MAX_CONTENT * 0.9 && (
                <p className={`mt-1 text-xs text-right ${overLimit ? 'text-red-400' : 'text-chalk/50'}`}>
                  {content.length.toLocaleString()} / {MAX_CONTENT.toLocaleString()}
                </p>
              )}
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
                disabled={loading || overLimit}
                className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
