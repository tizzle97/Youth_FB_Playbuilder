import React, { useState } from 'react';

interface UpgradeConsentModalProps {
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Point-of-sale renewal disclosure + consent, shown right before Stripe
 * Checkout opens. ToS §4 and the Pricing page describe these terms, but
 * California's Automatic Renewal Law / ROSCA want the disclosure adjacent
 * to the payment step itself, with an affirmative consent action — a link
 * to the Terms page isn't enough on its own. The same checkbox also covers
 * the EU 14-day digital-goods withdrawal-right waiver, since we can't
 * reliably detect EEA location client-side and showing it to everyone is
 * simpler and safer than trying to.
 */
export function UpgradeConsentModal({ busy, error, onCancel, onConfirm }: UpgradeConsentModalProps) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 py-8 text-center">
        <div className="fixed inset-0 bg-black bg-opacity-75" onClick={busy ? undefined : onCancel} />
        <div className="relative inline-block w-full max-w-md text-left align-middle bg-board-light rounded-lg shadow-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-chalk/10">
            <h3 className="text-lg font-bold text-chalk">Confirm your Pro subscription</h3>
          </div>

          <div className="px-6 py-5 space-y-4 text-sm text-chalk/80 leading-relaxed">
            <p>
              You&rsquo;re subscribing to <strong className="text-chalk">Playbuilder Pro — $39.00 USD /
              year</strong>. Your payment method will be charged <strong className="text-chalk">$39.00
              today</strong>, then automatically every 12 months on the same date, until you cancel.
            </p>
            <p>
              Cancel anytime from Account Settings → <em>Manage billing</em>; you keep Pro access
              through the end of the period you already paid for. Except where required by law,
              payments are non-refundable.
            </p>
            <p className="text-xs text-chalk/60">
              If you are located in the European Economic Area: starting your subscription now means
              service begins immediately, and by agreeing below you expressly waive your 14-day right
              of withdrawal for this digital subscription.
            </p>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-chalk/30 bg-board text-primary focus:ring-primary"
              />
              <span className="text-chalk/90">
                I agree to be charged $39.00/year, renewing automatically until I cancel. If I&rsquo;m in
                the EU/EEA, I acknowledge immediate access and waive my 14-day withdrawal right.
              </span>
            </label>

            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>

          <div className="px-6 py-4 border-t border-chalk/10 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="px-4 py-2 text-sm font-medium text-chalk bg-board border border-chalk/20 rounded-md hover:bg-board-light disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!agreed || busy}
              className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? 'Redirecting to checkout…' : 'Continue to secure checkout'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
