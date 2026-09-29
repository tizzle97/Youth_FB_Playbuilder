import React, { useId, useMemo } from 'react';
import { coverParams, COVER_VIEW_BOX } from '../../lib/blogCover';
import { GRID_PITCH_PX, GRID_LINE_COLOR, CONE_AMBER, TURF_DARK, TURF_CHALK } from '../../lib/ambient';

type Props = {
  slug: string;
  className?: string;
  /** Animate the routes drawing in — reserved for the post hero (one
   *  cover, a moment of arrival), never the index grid's 13 cards at once.
   *  Respects prefers-reduced-motion via the existing .draw-in class. */
  animate?: boolean;
};

/**
 * Deterministic, per-slug generated cover art. Inline SVG, not canvas or a
 * rasterized image — see blogCover.ts's doc comment for why. Decorative
 * only: aria-hidden, no <title>, no alt text. The art sits inside a link
 * whose accessible name is already the post title; describing generated
 * abstract shapes ("navy field, amber floodlights, three green routes")
 * would be noise to someone scanning a grid of these, not information.
 */
export function BlogCoverArt({ slug, className, animate = false }: Props) {
  const params = useMemo(() => coverParams(slug), [slug]);
  const uid = useId();
  const gridId = `${uid}-grid`;
  const coneIds = params.cones.map((_, i) => `${uid}-cone-${i}`);

  return (
    <svg
      viewBox={COVER_VIEW_BOX}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern
          id={gridId}
          width={GRID_PITCH_PX}
          height={GRID_PITCH_PX}
          patternUnits="userSpaceOnUse"
          x={params.gridOffset.x}
          y={params.gridOffset.y}
        >
          <path
            d={`M ${GRID_PITCH_PX} 0 L 0 0 0 ${GRID_PITCH_PX}`}
            fill="none"
            stroke={GRID_LINE_COLOR}
            strokeWidth={1}
          />
        </pattern>
        {params.cones.map((cone, i) => (
          <radialGradient key={coneIds[i]} id={coneIds[i]} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={CONE_AMBER} stopOpacity={cone.alpha} />
            <stop offset="100%" stopColor={CONE_AMBER} stopOpacity={0} />
          </radialGradient>
        ))}
      </defs>

      {/* Ground */}
      <rect width="1600" height="900" fill="#101D2E" />

      {/* Turf band — a suggestion of field, not a literal diagram */}
      <rect y={params.turf.top} width="1600" height={params.turf.height} fill={TURF_DARK} />
      {Array.from({ length: params.turf.lineCount }).map((_, i) => {
        const x = ((i + 1) / (params.turf.lineCount + 1)) * 1600;
        return (
          <line
            key={i}
            x1={x}
            y1={params.turf.top}
            x2={x}
            y2={params.turf.top + params.turf.height}
            stroke={TURF_CHALK}
            strokeWidth={2}
          />
        );
      })}

      {/* Floodlight cones */}
      {params.cones.map((cone, i) => (
        <ellipse
          key={coneIds[i]}
          cx={(cone.cx / 100) * 1600}
          cy={(cone.cy / 100) * 900}
          rx={(cone.rx / 100) * 1600}
          ry={(cone.ry / 100) * 900}
          fill={`url(#${coneIds[i]})`}
        />
      ))}

      {/* Grid paper overlay, on top of the turf/cones like the homepage hero */}
      <rect width="1600" height="900" fill={`url(#${gridId})`} />

      {/* Ghost mark — a faint football silhouette, pure texture */}
      <g
        transform={`translate(${params.ghost.x} ${params.ghost.y}) rotate(${params.ghost.rotate}) scale(${params.ghost.size / 200})`}
        opacity={0.045}
      >
        <ellipse cx="0" cy="0" rx="100" ry="58" fill="#F8F6F1" />
        <line x1="-55" y1="0" x2="55" y2="0" stroke="#101D2E" strokeWidth="4" />
        <line x1="-14" y1="-10" x2="-14" y2="10" stroke="#101D2E" strokeWidth="3" />
        <line x1="0" y1="-12" x2="0" y2="12" stroke="#101D2E" strokeWidth="3" />
        <line x1="14" y1="-10" x2="14" y2="10" stroke="#101D2E" strokeWidth="3" />
      </g>

      {/* Chalk sweep — one diagonal stroke, present on roughly a third of covers */}
      {params.sweep && (
        <path d={params.sweep.d} stroke="#F8F6F1" strokeOpacity="0.05" strokeWidth="140" strokeLinecap="round" />
      )}

      {/* Routes */}
      {params.routes.map((route, i) => (
        <g key={i}>
          <path
            d={route.d}
            fill="none"
            stroke="#1FA75D"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={animate ? 'draw-in' : undefined}
            style={animate ? ({ '--draw-length': 400 } as React.CSSProperties) : undefined}
            pathLength={animate ? 400 : undefined}
          />
          <g transform={`translate(${route.arrow.x} ${route.arrow.y}) rotate(${route.arrow.angle})`}>
            <path d="M0,-11 L18,0 L0,11 Z" fill="#1FA75D" />
          </g>
        </g>
      ))}
    </svg>
  );
}
