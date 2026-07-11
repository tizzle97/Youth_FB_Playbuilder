import React, { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Link, useNavigate } from 'react-router-dom';
import { UserMenu } from './auth/UserMenu';
import { supabase } from '../lib/supabase';

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
    <div className="relative bg-board overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 hero-background"></div>
      <div className="absolute inset-0 play-diagram"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-board via-board/95 to-board/90"></div>

      <div className="max-w-7xl mx-auto">
        <div className="relative z-10 pb-8 bg-transparent sm:pb-16 md:pb-20 lg:pb-28 xl:pb-32">
          <div className="absolute right-0 top-4 sm:hidden">
            {user ? (
              <UserMenu user={user} />
            ) : null}
          </div>
          <main className="mt-10 mx-auto max-w-7xl px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28">
            <div className="text-center max-w-3xl mx-auto">
              <h1 className="text-4xl tracking-tight font-bold sm:text-5xl md:text-6xl">
                <span className="block text-chalk">Dominate Your</span>
                <span className="block text-primary">Flag Football League</span>
                <span className="block text-chalk text-2xl sm:text-3xl md:text-4xl mt-2">with Playbuilder Pro</span>
              </h1>
              <p className="mt-3 text-base text-chalk/70 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl">
                The ultimate platform for flag football coaches and players. Access hundreds of plays, create custom strategies, and join a community of passionate coaches.
              </p>
              <div className="mt-5 sm:mt-8 sm:flex sm:justify-center">
                {user ? (
                  <div className="flex gap-4">
                    <Link to="/plays" className="flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary-dark md:py-4 md:text-lg md:px-10">
                      View Plays
                    </Link>
                    <Link to="/designer" className="flex items-center justify-center px-8 py-3 border-2 border-chalk/30 text-base font-medium rounded-md text-chalk hover:border-chalk/50 md:py-4 md:text-lg md:px-10">
                      Create Play
                    </Link>
                  </div>
                ) : (
                  <div className="flex gap-4">
                    <button
                      onClick={() => navigate('/auth')}
                      className="flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary-dark md:py-4 md:text-lg md:px-10"
                    >
                      Get Started
                    </button>
                    <Link to="/blog" className="flex items-center justify-center px-8 py-3 border-2 border-chalk/30 text-base font-medium rounded-md text-chalk hover:border-chalk/50 md:py-4 md:text-lg md:px-10">
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
