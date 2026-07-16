import React from 'react';
import { Mail, MessageSquare, ShieldQuestion } from 'lucide-react';
import { usePageMeta } from '../../lib/seo';

const CONTACT_EMAIL = 'support@playbuilderpro.com';

export function ContactPage() {
  usePageMeta({
    title: 'Contact',
    description:
      'Get in touch with Playbuilder Pro — support, billing questions, privacy requests, and copyright notices.',
    path: '/contact',
  });

  return (
    <div className="min-h-screen bg-board">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-chalk mb-3">Contact</h1>
        <p className="text-chalk/70 mb-10 max-w-xl">
          Questions, bug reports, billing help, privacy requests, or copyright notices — we read everything.
        </p>

        <div className="space-y-4">
          <div className="bg-board-light border border-chalk/10 rounded-lg p-6 flex items-start gap-4">
            <Mail className="h-6 w-6 text-primary shrink-0 mt-0.5" />
            <div>
              <h2 className="font-bold text-chalk mb-1">Email us</h2>
              <p className="text-chalk/70 text-sm mb-2">
                Support, billing, privacy requests (access, correction, deletion), and DMCA notices.
                We aim to respond within 2 business days.
              </p>
              <a className="text-primary font-medium hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
            </div>
          </div>

          <div className="bg-board-light border border-chalk/10 rounded-lg p-6 flex items-start gap-4">
            <MessageSquare className="h-6 w-6 text-primary shrink-0 mt-0.5" />
            <div>
              <h2 className="font-bold text-chalk mb-1">In-app feedback</h2>
              <p className="text-chalk/70 text-sm">
                Signed in? The <span className="text-chalk">Give Feedback</span> button in the corner of every
                page is the fastest way to report a bug or request a feature.
              </p>
            </div>
          </div>

          <div className="bg-board-light border border-chalk/10 rounded-lg p-6 flex items-start gap-4">
            <ShieldQuestion className="h-6 w-6 text-primary shrink-0 mt-0.5" />
            <div>
              <h2 className="font-bold text-chalk mb-1">Privacy &amp; account deletion</h2>
              <p className="text-chalk/70 text-sm">
                You can delete your account yourself anytime from Account Settings — no email required. For
                anything else privacy-related, see our{' '}
                <a className="text-primary hover:underline" href="/privacy">Privacy Policy</a>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
