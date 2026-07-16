import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Logo, Wordmark } from './Logo';

/**
 * Site-wide footer with the legal links every page must carry.
 * Hidden on the Play Designer, which is a full-screen tool.
 */
export function Footer() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/designer')) return null;

  return (
    <footer className="bg-board border-t border-chalk/10 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Logo className="h-7 w-7" />
            <Wordmark className="text-base" />
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
            <Link to="/blog" className="text-chalk/60 hover:text-chalk transition-colors">Blog</Link>
            <Link to="/community" className="text-chalk/60 hover:text-chalk transition-colors">Community</Link>
            <Link to="/privacy" className="text-chalk/60 hover:text-chalk transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="text-chalk/60 hover:text-chalk transition-colors">Terms of Service</Link>
            <Link to="/contact" className="text-chalk/60 hover:text-chalk transition-colors">Contact</Link>
          </nav>
        </div>
        <p className="mt-6 text-center sm:text-left text-xs text-chalk/40">
          © {new Date().getFullYear()} Playbuilder Pro. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
