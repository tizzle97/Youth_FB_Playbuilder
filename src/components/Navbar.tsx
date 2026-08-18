import React, { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Logo, Wordmark } from './Logo';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { UserMenu } from './auth/UserMenu';
import { supabase } from '../lib/supabase';
import { signOutSafely } from '../lib/auth';

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

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

  // Every menu item calls setIsMenuOpen(false) on click, but navigation that
  // doesn't originate inside the menu — browser back, a UserMenu item, a deep
  // link — used to leave it hanging open over the new page.
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMenuOpen]);

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/designer', label: 'Play Designer' },
    { path: '/plays', label: 'Plays' },
    { path: '/playbooks', label: 'Playbooks' },
    { path: '/community', label: 'Community' },
    { path: '/blog', label: 'Blog' }
  ];

  // `sticky top-0 z-40` keeps the nav reachable while scrolling a long page (Blog,
  // Community) instead of vanishing once you leave normal flow. z-40 sits below every
  // modal/dropdown in the app (all z-50, including UserMenu's own dropdown, which still
  // paints above its ancestor nav) and above Hero's `relative z-10`, which is the point.
  // /designer and /vs are the one exception: both are `fixed inset-0` full-screen tools
  // that are meant to cover the nav entirely, so they carry an explicit `z-50` of their
  // own — without it, a z-40 positioned nav would float above their z-auto container and
  // swallow clicks on their toolbar, which is the failure mode this used to avoid by
  // keeping the nav non-positioned. Check both spots before changing this z-index.
  return (
    <nav className="sticky top-0 z-40 bg-board-light border-b border-chalk/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <Logo className="h-8 w-8" />
              <span className="ml-2"><Wordmark /></span>
            </Link>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navItems.map(({ path, label }) => (
                <Link
                  key={path}
                  to={path}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    isActive(path)
                      ? 'border-primary text-chalk'
                      : 'border-transparent text-chalk/70 hover:text-chalk hover:border-chalk/30'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            {user ? (
              <UserMenu user={user} />
            ) : (
              <button 
                onClick={() => navigate('/auth')}
                className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Sign In
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 xs:gap-2 sm:hidden">
            {user && <UserMenu user={user} showName={false} />}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMenuOpen}
              aria-controls="mobile-menu"
              className="tap-target inline-flex items-center justify-center p-2 rounded-md text-chalk/70 hover:text-chalk hover:bg-board-light focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div id="mobile-menu" className="sm:hidden bg-board-light">
          <div className="pt-2 pb-3 space-y-1">
            {navItems.map(({ path, label }) => (
              <Link
                key={path}
                to={path}
                className={`tap-target flex items-center pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                  isActive(path)
                    ? 'bg-board text-primary border-primary'
                    : 'border-transparent text-chalk/70 hover:text-chalk hover:bg-board'
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                {label}
              </Link>
            ))}
          </div>
          <div className="pt-4 pb-3 border-t border-chalk/10">
            <div className="mt-3 space-y-1">
              {user ? (
                <>
                  <div className="px-4 py-2 text-sm text-chalk/70">
                    Signed in as<br />
                    <span className="font-medium text-chalk break-all">{user.email}</span>
                  </div>
                  <button
                    onClick={() => {
                      navigate('/account');
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left block px-4 py-2 text-base font-medium text-chalk/70 hover:text-chalk hover:bg-board"
                  >
                    Account Settings
                  </button>
                  <button
                    onClick={async () => {
                      await signOutSafely();
                      setIsMenuOpen(false);
                      navigate('/');
                    }}
                    className="w-full text-left block px-4 py-2 text-base font-medium text-chalk/70 hover:text-chalk hover:bg-board"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => {
                    navigate('/auth');
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left block px-4 py-2 text-base font-medium text-chalk/70 hover:text-chalk hover:bg-board"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
