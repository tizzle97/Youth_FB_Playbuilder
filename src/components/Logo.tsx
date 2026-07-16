import React from 'react';

/**
 * Playbuilder Pro brand icon — a curl route tracing a "P" on a navy field
 * tile, with a turf-green arrowhead. Matches public/brand-icon.svg.
 */
export function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Playbuilder Pro logo"
    >
      <defs>
        <linearGradient id="pbp-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#16283D" />
          <stop offset="1" stopColor="#101D2E" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="100" rx="24" fill="url(#pbp-tile)" />
      {/* faint yard hashes */}
      <g stroke="#F8F6F1" strokeOpacity="0.10" strokeWidth="2.6" strokeLinecap="round">
        <path d="M14 22 H22" />
        <path d="M14 40 H22" />
        <path d="M14 58 H22" />
        <path d="M78 22 H86" />
        <path d="M78 40 H86" />
        <path d="M78 58 H86" />
      </g>
      {/* player */}
      <circle cx="38" cy="79" r="7.5" fill="none" stroke="#F8F6F1" strokeWidth="6" />
      {/* curl route tracing a P */}
      <path
        d="M38 66 V38 Q38 27 49 27 H55 Q68 27 68 40 V43 Q68 56 55 56 H53"
        fill="none"
        stroke="#F8F6F1"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* arrowhead (turf) closing the curl */}
      <path d="M42 56 L55 47.5 L55 64.5 Z" fill="#1FA75D" />
    </svg>
  );
}

/**
 * Wordmark: PLAYBUILDER in ink, PRO in turf green. Pass `light` when the
 * background is chalk/light so the ink flips to navy.
 */
export function Wordmark({ light = false, className = 'text-xl' }: { light?: boolean; className?: string }) {
  return (
    <span className={`font-bold tracking-tight ${className} ${light ? 'text-board' : 'text-chalk'}`}>
      PLAYBUILDER<span className="text-primary">PRO</span>
    </span>
  );
}
