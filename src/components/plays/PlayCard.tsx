import React from 'react';
import { Link } from 'react-router-dom';
import { Play as PlayIcon } from 'lucide-react';

/**
 * The one play card (B-37). My Plays, the Community library and the playbook
 * detail grid each hand-rolled their own before this, which is exactly why
 * they drifted apart on shell, thumbnail fit and button styling — and why the
 * My Plays card was the only one whose action row outgrew it.
 *
 * The card owns the parts that should never differ: the shell, the thumbnail
 * frame and its empty state, and the body padding. Everything below the title
 * is passed in as children, because the actions genuinely do differ per
 * surface (copy vs. delete vs. remove-from-playbook) and pretending otherwise
 * would just move the duplication into a pile of boolean props.
 *
 * The playbook *list* view is deliberately not a consumer: it's a compact
 * drag-to-reorder row, not a card, and forcing it through here would mean a
 * variant that shares nothing but a name.
 */

export type PlayCardPlay = {
  id: string;
  name: string;
  type: string;
  thumbnail?: string | null;
};

type PlayCardProps = {
  play: PlayCardPlay;
  /** Where the thumbnail navigates. Omit to render it as a plain frame. */
  href?: string;
  /** Painted over the thumbnail — the playbook grid's hover actions. */
  overlay?: React.ReactNode;
  /**
   * Cards on the page background sit on `board-light`; cards nested inside an
   * already-light panel sit on `board` so they don't disappear into it.
   */
  tone?: 'onBoard' | 'inPanel';
  /**
   * `false` where the card contains an absolutely-positioned child that has to
   * escape it — My Plays' add-to-playbook dropdown is clipped out of existence
   * by `overflow-hidden` on the shell.
   */
  clip?: boolean;
  children?: React.ReactNode;
};

export function PlayCard({
  play,
  href,
  overlay,
  tone = 'onBoard',
  clip = true,
  children,
}: PlayCardProps) {
  const shell = [
    'group relative flex flex-col rounded-lg border transition-colors',
    tone === 'onBoard'
      ? 'bg-board-light border-chalk/10 hover:border-primary/30'
      : 'bg-board border-chalk/10 hover:border-chalk/20',
    clip ? 'overflow-hidden' : '',
  ].join(' ');

  // White ground: stored thumbnails are exported on white, so anything else
  // shows as a border around the image.
  const frame = `relative block aspect-play bg-white border-b border-chalk/10 ${clip ? '' : 'rounded-t-lg overflow-hidden'}`;

  const thumbnail = play.thumbnail ? (
    <img
      src={play.thumbnail}
      alt={play.name}
      className="w-full h-full object-contain"
      loading="lazy"
      decoding="async"
    />
  ) : (
    // object-contain, never object-cover: cropping a play diagram cuts routes
    // off at the edge of the frame.
    <div className="w-full h-full flex items-center justify-center text-board/30">
      <PlayIcon className="h-8 w-8" />
    </div>
  );

  return (
    // data-play-id lets a list observe its own cards with an
    // IntersectionObserver without wrapping each one in an extra element.
    <div data-testid="play-card" data-play-id={play.id} className={shell}>
      {href ? (
        <Link to={href} className={frame}>
          {thumbnail}
          {overlay}
        </Link>
      ) : (
        <div className={frame}>
          {thumbnail}
          {overlay}
        </div>
      )}
      <div className="p-4 flex-1 flex flex-col">{children}</div>
    </div>
  );
}

/** Play name + type pill on one line. Truncates rather than wrapping, so a
 *  long name can't desynchronise card heights across a grid row. */
export function PlayCardTitle({ name, type }: { name: string; type: string }) {
  return (
    <div className="flex items-start justify-between gap-2 mb-1">
      <h3 className="min-w-0 truncate font-bold text-chalk group-hover:text-primary transition-colors">
        {name}
      </h3>
      <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs capitalize shrink-0">
        {type.replace('_', ' ')}
      </span>
    </div>
  );
}
