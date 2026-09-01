import React, { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Link } from 'react-router-dom';
import { HeroPlayCard } from './HeroPlayCard';
import { supabase } from '../lib/supabase';

/** Faint graph-paper grid, like a coach's printed play sheet — now on navy. */
const gridPaper: React.CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(to right, transparent 0 59px, rgba(248,246,241,0.04) 59px 60px),' +
    'repeating-linear-gradient(to bottom, transparent 0 59px, rgba(248,246,241,0.04) 59px 60px)',
};

/** Two floodlight cones, like stadium light towers catching dust in the air
 *  over a night game — ambient only, never used for anything interactive. */
const floodlights: React.CSSProperties = {
  backgroundImage:
    'radial-gradient(ellipse 70% 60% at 10% -15%, rgba(232,163,61,0.38), transparent 65%),' +
    'radial-gradient(ellipse 70% 60% at 90% -15%, rgba(232,163,61,0.30), transparent 65%)',
};

export function Hero() {
  const [user, setUser] = useState<User | null>(null);
  const doodleRouteRef = useRef<SVGPathElement | null>(null);

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

  useEffect(() => {
    // Set the actual traced length so the draw-in animation (index.css)
    // follows the path precisely instead of an approximate fixed length.
    const path = doodleRouteRef.current;
    if (path) path.style.setProperty('--draw-length', String(path.getTotalLength()));
  }, []);

  return (
    <div className="relative bg-board overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={floodlights} aria-hidden="true"></div>
      <div className="absolute inset-0 pointer-events-none" style={gridPaper} aria-hidden="true"></div>

      {/* Route doodle, echoing the logo's curl route — tucked into the gap
          above the headline (not beside it) so it can't be wide enough to
          collide with the text at any width the container actually reaches. */}
      <svg
        className="absolute pointer-events-none hidden lg:block"
        style={{ left: '24px', top: '4px' }}
        width="66"
        height="84"
        viewBox="0 0 120 150"
        aria-hidden="true"
      >
        <circle cx="20" cy="130" r="8" fill="none" stroke="#F8F6F1" strokeOpacity="0.18" strokeWidth="4" />
        <path
          ref={doodleRouteRef}
          className="draw-in"
          d="M20 116 V40 Q20 26 34 26 H74"
          fill="none"
          stroke="#F8F6F1"
          strokeOpacity="0.18"
          strokeWidth="5"
          strokeLinecap="round"
        />
        {/* Fades in right as the line above finishes drawing, instead of
            sitting fully visible the whole time waiting for the line to
            "catch up" to it. */}
        <path className="arrow-in" d="M92 26 L72 16 L72 36 Z" fill="#1FA75D" fillOpacity="0.7" />
      </svg>

      <div className="max-w-7xl mx-auto">
        <div className="relative z-10 pb-8 bg-transparent sm:pb-16 md:pb-20 lg:pb-24 xl:pb-28">
          <main className="mt-10 mx-auto max-w-7xl px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-24">
            <div className="lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center">
              <div className="text-center lg:text-left max-w-3xl mx-auto lg:mx-0 lg:max-w-none">
                <h1 className="font-display text-4xl tracking-tight sm:text-5xl md:text-6xl text-chalk">
                  <span className="reveal block" style={{ '--reveal-delay': '1.4s' } as React.CSSProperties}>Draw the play.</span>
                  <span className="reveal block" style={{ '--reveal-delay': '1.55s' } as React.CSSProperties}>Run the play.</span>
                  <span className="reveal block text-primary" style={{ '--reveal-delay': '1.7s' } as React.CSSProperties}>Win the day.</span>
                </h1>
                <p
                  className="reveal mt-4 font-editorial text-lg text-chalk/75 sm:mt-6 sm:text-xl sm:max-w-xl sm:mx-auto lg:mx-0 md:text-2xl"
                  style={{ '--reveal-delay': '1.9s' } as React.CSSProperties}
                >
                  Playbuilder Pro is the play designer for youth and flag football coaches — draw routes
                  on a real field, organize by situation, and print what your players need on game day.
                </p>
                <div
                  className="reveal mt-6 sm:mt-8 sm:flex sm:justify-center lg:justify-start"
                  style={{ '--reveal-delay': '2.05s' } as React.CSSProperties}
                >
                  {user ? (
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                      <Link to="/plays" className="flex items-center justify-center px-8 py-3 border border-transparent text-base font-bold rounded-md text-white bg-primary hover:bg-primary-dark md:py-4 md:text-lg md:px-10">
                        View Plays
                      </Link>
                      <Link to="/designer" className="flex items-center justify-center px-8 py-3 border-2 border-chalk/25 text-base font-medium rounded-md text-chalk hover:border-chalk/50 md:py-4 md:text-lg md:px-10">
                        Create Play
                      </Link>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                      <Link
                        to="/designer"
                        className="flex items-center justify-center px-8 py-3 border border-transparent text-base font-bold rounded-md text-white bg-primary hover:bg-primary-dark md:py-4 md:text-lg md:px-10"
                      >
                        Start Drawing — Free
                      </Link>
                      <Link to="/blog" className="flex items-center justify-center px-8 py-3 border-2 border-chalk/25 text-base font-medium rounded-md text-chalk hover:border-chalk/50 md:py-4 md:text-lg md:px-10">
                        Learn More
                      </Link>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-12 lg:mt-0 max-w-md mx-auto lg:max-w-none">
                <HeroPlayCard revealDelayMs={250} />
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
