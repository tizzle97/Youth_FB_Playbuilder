import React from 'react';
import { Save } from 'lucide-react';

interface SignupToSaveModalProps {
  onSignUp: () => void;
  onSignIn: () => void;
  onCancel: () => void;
}

/**
 * What a signed-out coach sees on Save. This used to be a disabled button
 * whose only explanation was a hover tooltip (invisible on touch), so the
 * designer had no route to sign-up at all — the Oct 2026 GA funnel showed
 * 14 of 15 designer visitors leaving without ever reaching /auth.
 */
export function SignupToSaveModal({ onSignUp, onSignIn, onCancel }: SignupToSaveModalProps) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 py-8 text-center">
        <div className="fixed inset-0 bg-black bg-opacity-75" onClick={onCancel} />
        <div className="relative inline-block w-full max-w-sm text-left align-middle bg-board-light rounded-lg shadow-xl overflow-hidden">
          <div className="px-6 pt-6 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Save className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-chalk">Save this play to your free account</h3>
            <p className="mt-2 text-sm text-chalk/70 leading-relaxed">
              Create an account to keep this play and build playbooks. It&rsquo;s free, no credit card
              needed. We&rsquo;ll hold onto what you&rsquo;ve drawn while you sign up.
            </p>
          </div>

          <div className="px-6 pb-6 space-y-3">
            <button
              type="button"
              onClick={onSignUp}
              className="tap-target w-full px-4 py-2.5 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Create free account
            </button>
            <button
              type="button"
              onClick={onSignIn}
              className="tap-target w-full px-4 py-2.5 text-sm font-medium text-chalk bg-board border border-chalk/20 rounded-lg hover:bg-board/70 transition-colors"
            >
              I already have an account
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="w-full pt-1 text-sm text-chalk/50 hover:text-chalk transition-colors"
            >
              Keep drawing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
