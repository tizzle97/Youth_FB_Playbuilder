import React, { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Link, useNavigate } from 'react-router-dom';
import { UserMenu } from './auth/UserMenu';
import { supabase } from '../lib/supabase';

/** Faint graph-paper grid, like a coach's printed play sheet. */
const gridPaper: React.CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(to right, transparent 0 59px, rgba(16,29,46,0.05) 59px 60px),' +
    'repeating-linear-gradient(to bottom, transparent 0 59px, rgba(16,29,46,0.05) 59px 60px)',
};

export function Hero() {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="relative bg-chalk overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={gridPaper} aria-hidden="true"></div>

      {/* Route doodles, echoing the logo's curl route */}
      <svg
        className="absolute pointer-events-none hidden lg:block"
        style={{ left: '6%', top: '110px' }}
        width="120"
        height="150"
        viewBox="0 0 120 150"
        aria-hidden="true"
      >
        <circle cx="20" cy="130" r="8" fill="none" stroke="#101D2E" strokeOpacity="0.25" strokeWidth="4" />
        <path d="M20 116 V40 Q20 26 34 26 H74" fill="none" stroke="#101D2E" strokeOpacity="0.25" strokeWidth="5" strokeLinecap="round" />
        <path d="M86 26 L70 17 L70 35 Z" fill="#1FA75D" fillOpacity="0.6" />
      </svg>
      <svg
        className="absolute pointer-events-none hidden lg:block"
        style={{ right: '5%', top: '170px' }}
        width="130"
        height="150"
        viewBox="0 0 130 150"
        aria-hidden="true"
      >
        <circle cx="110" cy="130" r="8" fill="none" stroke="#101D2E" strokeOpacity="0.25" strokeWidth="4" />
        <path d="M110 116 V60 L60 25" fill="none" stroke="#101D2E" strokeOpacity="0.25" strokeWidth="5" strokeLinecap="round" />
        <path d="M50 18 L64 20 L56 36 Z" fill="#1FA75D" fillOpacity="0.6" />
      </svg>

      <div className="max-w-7xl mx-auto">
        <div className="relative z-10 pb-8 bg-transparent sm:pb-16 md:pb-20 lg:pb-28 xl:pb-32">
          <div className="absolute right-0 top-4 sm:hidden">
            {user ? (
              <UserMenu user={user} />
            ) : null}
          </div>
          <main className="mt-10 mx-auto max-w-7xl px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28">
            <div className="text-center max-w-3xl mx-auto">
              <h1 className="text-4xl tracking-tight font-extrabold sm:text-5xl md:text-6xl text-board">
                <span className="block">Draw the play.</span>
                <span className="block">Run the play.</span>
                <span className="block text-primary-dark">Win the day.</span>
              </h1>
              <p className="mt-3 text-base text-board/65 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl">
                Playbuilder Pro is the play designer for flag and youth coaches — draw routes
                on a real field, organize by situation, and print what your players need on game day.
              </p>
              <div className="mt-5 sm:mt-8 sm:flex sm:justify-center">
                {user ? (
                  <div className="flex gap-4">
                    <Link to="/plays" className="flex items-center justify-center px-8 py-3 border border-transparent text-base font-bold rounded-md text-white bg-primary hover:bg-primary-dark md:py-4 md:text-lg md:px-10">
                      View Plays
                    </Link>
                    <Link to="/designer" className="flex items-center justify-center px-8 py-3 border-2 border-board/25 text-base font-medium rounded-md text-board hover:border-board/50 md:py-4 md:text-lg md:px-10">
                      Create Play
                    </Link>
                  </div>
                ) : (
                  <div className="flex gap-4">
                    <button
                      onClick={() => navigate('/auth')}
                      className="flex items-center justify-center px-8 py-3 border border-transparent text-base font-bold rounded-md text-white bg-primary hover:bg-primary-dark md:py-4 md:text-lg md:px-10"
                    >
                      Start Drawing — Free
                    </button>
                    <Link to="/blog" className="flex items-center justify-center px-8 py-3 border-2 border-board/25 text-base font-medium rounded-md text-board hover:border-board/50 md:py-4 md:text-lg md:px-10">
                      Learn More
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
