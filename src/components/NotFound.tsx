import React from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../lib/seo';

export function NotFound() {
  usePageMeta({ title: 'Page not found', description: 'That page does not exist.' });

  return (
    <div className="min-h-[60vh] bg-board flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-6xl font-extrabold text-primary mb-4">404</p>
        <h1 className="text-2xl font-bold text-chalk mb-2">Incomplete pass</h1>
        <p className="text-chalk/60 mb-8">That page doesn&rsquo;t exist — the route may have changed.</p>
        <Link
          to="/"
          className="inline-block px-6 py-3 bg-primary hover:bg-primary-dark text-white font-bold rounded-md transition-colors"
        >
          Back to the huddle
        </Link>
      </div>
    </div>
  );
}
