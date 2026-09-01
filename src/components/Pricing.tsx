import React, { useEffect, useState } from 'react';
import { Check, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { useEntitlement, FREE_LIMITS } from '../lib/entitlements';
import { BILLING_ENABLED, startProCheckout } from '../lib/billing';
import { getSafeErrorMessage } from '../lib/errors';
import { supabase } from '../lib/supabase';
import { UpgradeConsentModal } from './billing/UpgradeConsentModal';

const freeFeatures = [
  'All Play Designer tools',
  `Up to ${FREE_LIMITS.plays} saved plays`,
  `${FREE_LIMITS.playbooks} playbooks`,
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

        {/* Pro sits larger and elevated — the plan this page wants chosen —
            Free sits smaller and quieter beside it, not an equal A/B pair. */}
        <div className="mt-12 flex flex-col-reverse gap-8 max-w-4xl mx-auto lg:flex-row lg:items-center">
          {/* Free */}
          <div className="lg:w-[38%] shrink-0 p-6">
            <h3 className="font-label text-xs tracking-widest text-chalk/50 uppercase">Free</h3>
            <div className="mt-2 flex items-baseline gap-2 text-chalk">
              <span className="font-display text-3xl">$0</span>
              <span className="text-chalk/50 text-sm">always</span>
            </div>
            <p className="mt-4 text-sm text-chalk/60">Everything you need to design and share plays.</p>
            <ul className="mt-5 space-y-3">
              {freeFeatures.map((f) => (
                <li key={f} className="flex text-sm text-chalk/70">
                  <Check className="h-4 w-4 text-chalk/40 shrink-0 mt-0.5" />
                  <span className="ml-2">{f}</span>
                </li>
              ))}
            </ul>
            {user ? (
              <div className="mt-6 text-sm text-chalk/50">
                {isPro ? 'Included in your plan' : 'Your current plan'}
              </div>
            ) : (
              <>
                <button
                  onClick={() => navigate('/auth?mode=signup')}
                  className="mt-6 text-sm font-medium text-chalk/70 underline decoration-chalk/30 underline-offset-4 hover:text-chalk hover:decoration-chalk transition-colors"
                >
                  Sign up free →
                </button>
                <p className="mt-3 text-xs text-chalk/40">
                  A free account is required to save plays and playbooks.
                </p>
              </>
            )}
          </div>

          {/* Pro — live checkout once billing is enabled (B-3), otherwise coming soon */}
          <div className="relative flex-1 bg-board rounded-2xl shadow-2xl border border-primary p-8 lg:p-10 lg:scale-105">
            {!BILLING_ENABLED && (
              <div className="absolute -top-4 inset-x-0 flex justify-center">
                <div className="inline-block bg-primary px-4 py-1 rounded-full text-sm font-semibold text-white">
                  Coming soon
                </div>
              </div>
            )}
            <h3 className="font-label text-xs tracking-widest text-primary uppercase">Pro</h3>
            <div className="mt-2 flex items-baseline gap-2 text-chalk">
              <span className="font-display text-5xl">$39</span>
              <span className="text-chalk/60">/ year</span>
            </div>
            <p className="mt-4 text-chalk/70">For coaches running a full team and game-day printing.</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {proFeatures.map((f) => (
                <li key={f} className="flex text-chalk/90">
                  <Check className="h-5 w-5 text-primary shrink-0" />
                  <span className="ml-2.5">{f}</span>
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
