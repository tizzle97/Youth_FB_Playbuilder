import React, { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { Logo } from './Logo';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { UserMenu } from './auth/UserMenu';
import { supabase } from '../lib/supabase';

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

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/designer', label: 'Play Designer', newTab: true },
    { path: '/plays', label: 'Plays' },
    { path: '/playbooks', label: 'Playbooks' },
    { path: '/community', label: 'Community' },
    { path: '/blog', label: 'Blog' }
  ];

  return (
    <nav className="bg-board-light border-b border-chalk/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <Logo className="h-8 w-8 text-chalk" />
              <span className="ml-2 text-xl font-chalk font-bold text-chalk">Playbuilder Pro</span>
            </Link>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navItems.map(({ path, label, newTab }) => (
                <Link
                  key={path}
                  to={path}
                  {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
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
          <div className="flex items-center sm:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-chalk/70 hover:text-chalk hover:bg-board-light focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div className="sm:hidden bg-board-light">
          <div className="pt-2 pb-3 space-y-1">
            {navItems.map(({ path, label, newTab }) => (
              <Link
                key={path}
                to={path}
                {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
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
                    <span className="font-medium text-chalk">{user.email}</span>
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
                      await supabase.auth.signOut();
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
