import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';

/**
 * Landing page for Supabase password-recovery links
 * (resetPasswordForEmail redirects here). The Supabase client exchanges the
 * token in the URL for a session automatically (detectSessionInUrl), after
 * which the user can set a new password.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);

  useEffect(() => {
    // The recovery token in the URL becomes a session shortly after load.
    // Wait for it; if nothing arrives, the link is invalid or expired.
    let settled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !settled) { settled = true; setReady(true); }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session && !settled) {
        settled = true;
        setReady(true);
      }
    });

    const timeout = setTimeout(() => {
      if (!settled) { settled = true; setLinkInvalid(true); }
    }, 5000);

    return () => { subscription.unsubscribe(); clearTimeout(timeout); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
      setTimeout(() => navigate('/'), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-board flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-board-light rounded-lg shadow-xl border border-chalk/10 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-primary/20 rounded-full p-2">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-chalk">Set a New Password</h1>
        </div>

        {linkInvalid ? (
          <div className="space-y-4">
            <p className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
            <button
              onClick={() => navigate('/auth')}
              className="w-full px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-md transition-colors"
            >
              Back to Sign In
            </button>
          </div>
        ) : success ? (
          <p className="text-green-500 text-sm bg-green-500/10 p-3 rounded-lg">
            Password updated! You are signed in — taking you to the homepage…
          </p>
        ) : !ready ? (
          <p className="text-chalk/70 text-sm">Verifying your reset link…</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-chalk mb-1">
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full px-3 py-2 bg-board border border-chalk/20 rounded-md text-chalk placeholder-chalk/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-chalk mb-1">
                Confirm New Password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                className="w-full px-3 py-2 bg-board border border-chalk/20 rounded-md text-chalk placeholder-chalk/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Re-enter your new password"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
