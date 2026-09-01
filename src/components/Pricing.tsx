import React, { useEffect, useState } from 'react';
import { Check, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { useEntitlement, FREE_LIMITS } from '../lib/entitlements';
import { BILLING_ENABLED, startProCheckout } from '../lib/billing';
import { getSafeErrorMessage } from '../lib/errors';
import { supabase } from '../lib/supabase';
import { UpgradeConsentModal } from './billing/UpgradeConsentModal';
import { StatDigit } from './StatDigit';

const freeFeatures = [
  'All Play Designer tools',
  'Single-play PDF export',
  'Browse & publish community plays',
];

const proFeatures = [
  'Everything in Free',
  'Unlimited plays',
  'Unlimited playbooks',
  'Full playbook PDFs (detailed + grid)',
  'Wristband export',
  'Clean output (no footer credit)',
];

export function Pricing() {
  const { isFoundingMember, isPro } = useEntitlement();
  const [user, setUser] = useState<User | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [showConsent, setShowConsent] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleUpgrade = async () => {
    try {
      setCheckoutError(null);
      setCheckoutBusy(true);
      await startProCheckout(); // redirects away on success
    } catch (err) {
      setCheckoutError(getSafeErrorMessage(err, 'Could not start checkout. Please try again.'));
      setCheckoutBusy(false);
    }
  };

  return (
    <div className="py-16 bg-board-light border-t border-chalk/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="font-display text-3xl text-chalk">Simple Pricing</h2>
          <p className="mt-4 text-lg text-chalk/70 max-w-2xl mx-auto">
            Playbuilder Pro is free for youth coaches. Create a free account to save your
            plays and playbooks — no credit card required.
          </p>
        </div>

        {isFoundingMember && (
          <div className="mt-8 max-w-2xl mx-auto flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 px-5 py-4">
            <Trophy className="h-6 w-6 text-primary shrink-0" />
            <p className="text-sm text-chalk">
              <span className="font-semibold text-primary">You're a Founding Member.</span>{' '}
              Thanks for being here early — Pro will be free for your account, for life.
            </p>
          </div>
        )}

        <div className="mt-12 grid gap-8 lg:grid-cols-2 max-w-4xl mx-auto">
          {/* Free */}
          <div className="relative bg-board rounded-2xl shadow-xl border border-chalk/10 p-8">
            <h3 className="text-xl font-bold text-chalk">Free</h3>
            <div className="mt-4">
              <StatDigit value="$0" label="Always" tone="dark" />
            </div>
            <p className="mt-6 text-chalk/70">Everything you need to design and share plays.</p>
            <div className="mt-6 flex gap-8">
              <StatDigit value={String(FREE_LIMITS.plays)} label="Saved Plays" tone="dark" />
              <StatDigit value={String(FREE_LIMITS.playbooks)} label="Playbooks" tone="dark" />
            </div>
            <ul className="mt-6 space-y-4">
              {freeFeatures.map((f) => (
                <li key={f} className="flex text-chalk/90">
                  <Check className="h-6 w-6 text-primary shrink-0" />
                  <span className="ml-3">{f}</span>
                </li>
              ))}
            </ul>
            {user ? (
              <div className="mt-8 w-full rounded-lg px-4 py-2 text-center font-medium bg-board-light border border-chalk/20 text-chalk/70">
                {isPro ? 'Included in your plan' : 'Your current plan'}
              </div>
            ) : (
              <>
                <button
                  onClick={() => navigate('/auth?mode=signup')}
                  className="mt-8 w-full rounded-lg px-4 py-2 text-center font-medium bg-board-light border border-chalk/20 text-chalk hover:border-primary/50 hover:text-primary transition-colors"
                >
                  Sign up free
                </button>
                <p className="mt-3 text-xs text-chalk/50 text-center">
                  A free account is required to save plays and playbooks.
                </p>
              </>
            )}
          </div>

          {/* Pro — live checkout once billing is enabled (B-3), otherwise coming soon */}
          <div className="relative bg-board rounded-2xl shadow-xl border border-primary p-8">
            {!BILLING_ENABLED && (
              <div className="absolute -top-4 inset-x-0 flex justify-center">
                <div className="inline-block bg-primary px-4 py-1 rounded-full text-sm font-semibold text-white">
                  Coming soon
                </div>
              </div>
            )}
            <h3 className="text-xl font-bold text-chalk">Pro</h3>
            <div className="mt-4">
              <StatDigit value="$39" label="Per Year" tone="dark" />
            </div>
            <p className="mt-6 text-chalk/70">For coaches running a full team and game-day printing.</p>
            <ul className="mt-6 space-y-4">
              {proFeatures.map((f) => (
                <li key={f} className="flex text-chalk/90">
                  <Check className="h-6 w-6 text-primary shrink-0" />
                  <span className="ml-3">{f}</span>
                </li>
              ))}
            </ul>
            {isPro ? (
              <div className="mt-8 w-full rounded-lg px-4 py-2 text-center font-medium bg-primary/15 border border-primary/40 text-primary">
                {isFoundingMember ? 'Yours free for life' : 'Your current plan'}
              </div>
            ) : BILLING_ENABLED ? (
              <>
                <button
                  onClick={() => setShowConsent(true)}
                  disabled={checkoutBusy}
                  className="mt-8 w-full rounded-lg px-4 py-2 text-center font-medium bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-wait"
                >
                  {checkoutBusy ? 'Redirecting to checkout…' : 'Upgrade to Pro — $39/yr'}
                </button>
                {checkoutError && (
                  <p className="mt-3 text-sm text-red-400 text-center">{checkoutError}</p>
                )}
              </>
            ) : (
              <button
                disabled
                className="tap-target mt-8 w-full rounded-lg px-4 py-2 text-center font-medium bg-primary/40 text-white/80 cursor-not-allowed"
              >
                Coming soon
              </button>
            )}
          </div>
        </div>
      </div>

      {showConsent && (
        <UpgradeConsentModal
          busy={checkoutBusy}
          error={checkoutError}
          onCancel={() => setShowConsent(false)}
          onConfirm={handleUpgrade}
        />
      )}
    </div>
  );
}
