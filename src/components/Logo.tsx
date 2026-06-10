import React from 'react';

/**
 * Playbuilder Pro logo — a football resting in a trophy cup.
 * Inherits text color for the trophy (use text-chalk on dark backgrounds);
 * the football is always brand orange.
 */
export function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Playbuilder Pro logo"
    >
      {/* Football (drawn first; lower half tucks behind the cup rim) */}
      <ellipse cx="32" cy="15" rx="12.5" ry="8.5" fill="#FF5722" />
      {/* Lace */}
      <line x1="25.5" y1="15" x2="38.5" y2="15" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="28" y1="12.8" x2="28" y2="17.2" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="32" y1="12.8" x2="32" y2="17.2" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="36" y1="12.8" x2="36" y2="17.2" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" />

      {/* Trophy handles */}
      <path
        d="M12 24 C5 24 3 30 6 34 C8.5 37.5 12 39 16 39.5"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M52 24 C59 24 61 30 58 34 C55.5 37.5 52 39 48 39.5"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />

      {/* Trophy cup */}
      <path
        d="M12 20 H52 V27 C52 38.5 43.5 46.5 32 46.5 C20.5 46.5 12 38.5 12 27 Z"
        fill="currentColor"
      />

      {/* Stem */}
      <path d="M28.5 46.5 L27 53 H37 L35.5 46.5 Z" fill="currentColor" />

      {/* Base */}
      <path
        d="M23 53 H41 C42.7 53 44 54.3 44 56 V59 H20 V56 C20 54.3 21.3 53 23 53 Z"
        fill="currentColor"
      />
    </svg>
  );
}
