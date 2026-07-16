import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getStoredConsent, storeConsent } from '../lib/analytics';

/**
 * Cookie consent banner (BACKLOG B-19). GA only loads once the visitor
 * accepts; declining stores the choice and no analytics cookies are ever set.
 * Hidden on the Play Designer, a full-screen tool (same precedent as
 * Footer/FeedbackButton).
 */
export function ConsentBanner() {
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(getStoredConsent() === null);
  }, []);

  if (pathname.startsWith('/designer') || !visible) return null;

  const choose = (choice: 'granted' | 'denied') => {
    storeConsent(choice);
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-board-light border-t border-chalk/10 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center gap-4">
        <p className="text-sm text-chalk/80 flex-1">
          We use Google Analytics to understand how coaches use Playbuilder Pro. See our{' '}
          <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
        </p>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => choose('denied')}
            className="px-4 py-2 text-sm rounded-md text-chalk/70 hover:text-chalk border border-chalk/20 transition-colors"
          >
            Decline
          </button>
          <button
            onClick={() => choose('granted')}
            className="px-4 py-2 text-sm rounded-md bg-primary hover:bg-primary-dark text-white transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
