import React, { useId, useMemo } from 'react';
import { coverParams, COVER_VIEW_BOX } from '../../lib/blogCover';
import { GRID_PITCH_PX, GRID_LINE_COLOR, CONE_AMBER } from '../../lib/ambient';

type Props = {
  slug: string;
  className?: string;
  /** Animate the route drawing in — reserved for the post hero (one cover,
   *  a moment of arrival), never the index grid's 13 cards at once.
   *  Respects prefers-reduced-motion via the existing .draw-in class. */
  animate?: boolean;
};

/**
 * Deterministic, per-slug generated cover art — see blogCover.ts's doc
 * comment for the design reasoning (v2, after the first version read as
 * generic/cluttered per direct feedback). One mark per cover: a faint
 * origin dot, one long confident route stroke, one green arrowhead, a few
 * restrained yard-hash ticks — exactly Logo.tsx's and Hero.tsx's own
 * existing brand vocabulary, extended here rather than inventing a new,
 * busier one.
 *
 * Decorative only: aria-hidden, no <title>, no alt text — it sits inside a
 * link whose accessible name is already the post title.
 */
export function BlogCoverArt({ slug, className, animate = false }: Props) {
  const params = useMemo(() => coverParams(slug), [slug]);
  const uid = useId();
  const gridId = `${uid}-grid`;
  const coneIds = params.cones.map((_, i) => `${uid}-cone-${i}`);

  const routeTransform = [
    `translate(${params.transform.tx} ${params.transform.ty})`,
    `scale(${params.transform.scale})`,
    params.transform.mirror ? 'translate(480 0) scale(-1 1)' : '',
  ].filter(Boolean).join(' ');

  const hashX = params.hashes.side === 'left' ? 60 : 1540;
  const hashSpacing = 70;
  const hashStart = 300;

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

      {/* Floodlight cones, then grid paper on top — same order and values
          as the homepage hero's own ambient treatment. */}
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
      <rect width="1600" height="900" fill={`url(#${gridId})`} />

      {/* Yard-hash ticks — Logo.tsx's exact motif (3-4 short pairs down one
          edge), the one piece of literal football detail, kept small and
          restrained rather than a full field/turf illustration. */}
      <g stroke="#F8F6F1" strokeOpacity="0.14" strokeWidth="4" strokeLinecap="round">
        {Array.from({ length: params.hashes.count }).map((_, i) => (
          <line
            key={i}
            x1={hashX - 18}
            y1={hashStart + i * hashSpacing}
            x2={hashX + 18}
            y2={hashStart + i * hashSpacing}
          />
        ))}
      </g>

      {/* The one deliberate mark: origin dot, one long route, one arrowhead —
          Hero.tsx's doodle recipe, scaled up and varied per slug. */}
      <g transform={routeTransform}>
        <circle cx="20" cy={params.route.origin.y} r="9" fill="none" stroke="#F8F6F1" strokeOpacity="0.3" strokeWidth="5" />
        <path
          d={params.route.d}
          fill="none"
          stroke="#F8F6F1"
          strokeOpacity="0.3"
          strokeWidth="7"
          strokeLinecap="round"
          className={animate ? 'draw-in' : undefined}
          style={animate ? ({ '--draw-length': 1400 } as React.CSSProperties) : undefined}
          pathLength={animate ? 1400 : undefined}
        />
        <g
          transform={`translate(${params.route.end.x} ${params.route.end.y}) rotate(${params.route.endAngle})`}
          className={animate ? 'arrow-in' : undefined}
        >
          <path d="M24 0 L0 -12 L0 12 Z" fill="#1FA75D" fillOpacity="0.85" />
        </g>
      </g>
    </svg>
  );
}
