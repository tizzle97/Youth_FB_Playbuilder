import { Bug, Lightbulb, MessageCircle, type LucideIcon } from 'lucide-react';

export type FeedbackType = 'bug' | 'feature' | 'general';
export type FeedbackStatus = 'pending' | 'reviewed' | 'resolved';
export type TriageClass = 'bug' | 'feature' | 'general' | 'spam' | 'injection';
export type TriageState = 'untriaged' | 'triaged' | 'skipped' | 'flagged';

/** Shared by the admin console and the submitter's own view, so the badge a
 *  coach sees on their report is literally the same badge the admin sees. */
export const TYPE_META: Record<FeedbackType, { icon: LucideIcon; label: string; classes: string }> = {
  bug: { icon: Bug, label: 'Bug', classes: 'bg-red-500/15 text-red-400' },
  feature: { icon: Lightbulb, label: 'Feature', classes: 'bg-yellow-500/15 text-yellow-400' },
  general: { icon: MessageCircle, label: 'General', classes: 'bg-blue-500/15 text-blue-400' },
};

export const STATUS_CLASSES: Record<FeedbackStatus, string> = {
  pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  reviewed: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  resolved: 'bg-green-500/15 text-green-400 border-green-500/30',
};

/** What a submitter is told each status means. The raw words are ambiguous
 *  ("reviewed" by whom? "resolved" how?) and this is the only place a user
 *  ever finds out. */
export const STATUS_BLURB: Record<FeedbackStatus, string> = {
  pending: "We've got it — nobody has looked at it yet.",
  reviewed: "We've read it and it's on our list.",
  resolved: 'Closed out.',
};
