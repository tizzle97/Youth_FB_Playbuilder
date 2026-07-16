import React from 'react';
import { usePageMeta } from '../../lib/seo';
import { LegalPage, LegalSection, LegalList } from './LegalPage';

const CONTACT_EMAIL = 'support@playbuilderpro.com';

export function PrivacyPolicy() {
  usePageMeta({
    title: 'Privacy Policy',
    description:
      'How Playbuilder Pro collects, uses, and protects your information — accounts, uploaded content, payments, analytics, and your rights.',
    path: '/privacy',
  });

  return (
    <LegalPage title="Privacy Policy" effectiveDate="July 15, 2026">
      <LegalSection heading="Who we are">
        <p>
          Playbuilder Pro (&ldquo;we,&rdquo; &ldquo;us&rdquo;) operates playbuilderpro.com, a web application
          that lets flag and youth football coaches design plays, build playbooks, and share content with a
          community. Questions about this policy or your data: <a className="text-primary hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </LegalSection>

      <LegalSection heading="Information we collect">
        <LegalList
          items={[
            <><strong className="text-chalk">Account information.</strong> Email address, username, and password when you create an account. Passwords are hashed by our authentication provider; we never see or store them in plain text.</>,
            <><strong className="text-chalk">Profile and team content.</strong> Optional profile pictures you upload or icons you select, and optional team settings such as a team name and logo used on your printed playbooks.</>,
            <><strong className="text-chalk">Content you create.</strong> Plays, playbooks, community posts, comments, votes, and feedback you submit. Content you mark public (public plays, community posts) is visible to other users along with your username and avatar.</>,
            <><strong className="text-chalk">Subscription information.</strong> If you upgrade to Pro, payment is processed by Stripe. Your card number never touches our servers. We store your subscription status and Stripe customer/subscription identifiers so we can provide Pro features.</>,
            <><strong className="text-chalk">Usage data.</strong> We use Google Analytics 4, which sets cookies and collects information such as pages visited, approximate location, and device/browser type. See &ldquo;Cookies and analytics&rdquo; below.</>,
            <><strong className="text-chalk">Technical data.</strong> A session token stored in your browser&rsquo;s local storage keeps you signed in.</>,
          ]}
        />
      </LegalSection>

      <LegalSection heading="How we use information">
        <LegalList
          items={[
            'Provide and operate the service: accounts, saving and loading plays, printing, community features.',
            'Process subscriptions and provide Pro features.',
            'Send transactional email only — account confirmation, password resets, and similar. We do not send marketing email.',
            'Understand aggregate usage so we can improve the product (analytics).',
            'Enforce our Terms of Service and keep the community safe (e.g., reviewing reported images).',
          ]}
        />
      </LegalSection>

      <LegalSection heading="Who we share information with">
        <p>We do not sell your personal information. We share it only with the service providers that run the product:</p>
        <LegalList
          items={[
            <><strong className="text-chalk">Supabase</strong> — database, authentication, and file storage (hosts your account data and uploaded content).</>,
            <><strong className="text-chalk">Stripe</strong> — payment processing for Pro subscriptions.</>,
            <><strong className="text-chalk">Google Analytics</strong> — aggregate usage analytics.</>,
            <><strong className="text-chalk">Netlify</strong> — website hosting and delivery.</>,
          ]}
        />
        <p>We may also disclose information if required by law, or to protect the rights, safety, or property of Playbuilder Pro or its users.</p>
      </LegalSection>

      <LegalSection heading="Cookies and analytics">
        <p>
          We use Google Analytics 4 to understand aggregate site usage, but only after you accept the cookie
          consent banner shown on your first visit. It sets cookies and may collect your IP-derived approximate
          location and device information. Declining means Google Analytics never loads and no analytics
          cookies are set; you can change your mind at any time by clearing your browser&rsquo;s local storage
          for this site, or opt out with the{' '}
          <a className="text-primary hover:underline" href="https://tools.google.com/dlpage/gaoptout" rel="noopener noreferrer" target="_blank">Google Analytics opt-out browser add-on</a>.
          Apart from analytics, we use browser storage only for essential functions such as keeping you signed in.
        </p>
        <p>
          Some browsers send a &ldquo;Do Not Track&rdquo; signal. Like most sites, we do not currently respond
          to Do Not Track signals, but the opt-out above works regardless.
        </p>
      </LegalSection>

      <LegalSection heading="Public content">
        <p>
          Plays you mark public, and anything you post in the Community (posts, comments, votes), are visible
          to other users — along with your username and avatar. Think of the Community as a public space.
          Private plays and playbooks are visible only to you.
        </p>
      </LegalSection>

      <LegalSection heading="Data retention and deletion">
        <p>
          We keep your information for as long as your account exists. You can delete your account at any time
          from Account Settings — this permanently deletes your account and associated data. You can also email
          us at <a className="text-primary hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> to
          request access to, correction of, or deletion of your personal information.
        </p>
      </LegalSection>

      <LegalSection heading="Your rights">
        <p>
          Depending on where you live (for example, California or the European Economic Area), you may have
          rights to access, correct, delete, or receive a copy of your personal information, and to object to
          or restrict certain processing. We honor these requests for all users regardless of location: use
          the self-serve account deletion in Account Settings, or email us and we will respond within 30 days.
          We will never discriminate against you for exercising a privacy right.
        </p>
      </LegalSection>

      <LegalSection heading="Children">
        <p>
          Playbuilder Pro is built for coaches and is not directed at children under 13. You must be at least
          13 years old (or 16 in the European Economic Area) to create an account. We do not knowingly collect
          personal information from children under 13; if you believe a child has created an account, contact
          us and we will delete it.
        </p>
      </LegalSection>

      <LegalSection heading="Security">
        <p>
          All traffic is encrypted in transit (HTTPS). Data access is enforced with row-level security so users
          can only read and write their own private content. Payments are handled entirely by Stripe. No method
          of transmission or storage is 100% secure, but we take reasonable measures appropriate to the data we
          handle.
        </p>
      </LegalSection>

      <LegalSection heading="Changes to this policy">
        <p>
          If we make material changes, we will update the effective date above and, for significant changes,
          note it on the site. Continued use of the service after changes take effect means you accept the
          updated policy.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          <a className="text-primary hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
