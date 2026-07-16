import React from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../../lib/seo';
import { LegalPage, LegalSection, LegalList } from './LegalPage';

const CONTACT_EMAIL = 'support@playbuilderpro.com';

export function TermsOfService() {
  usePageMeta({
    title: 'Terms of Service',
    description:
      'The terms that govern your use of Playbuilder Pro — accounts, subscriptions, user content, acceptable use, and liability.',
    path: '/terms',
  });

  return (
    <LegalPage title="Terms of Service" effectiveDate="July 15, 2026">
      <LegalSection heading="1. Agreement">
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) are a contract between you and Playbuilder Pro
          (&ldquo;we,&rdquo; &ldquo;us&rdquo;) governing your use of playbuilderpro.com (the
          &ldquo;Service&rdquo;). By creating an account or using the Service, you agree to these Terms and to
          our <Link className="text-primary hover:underline" to="/privacy">Privacy Policy</Link>. If you do not
          agree, do not use the Service.
        </p>
      </LegalSection>

      <LegalSection heading="2. Eligibility">
        <p>
          You must be at least 13 years old (16 in the European Economic Area) to use the Service. If you use
          the Service on behalf of a team or organization, you represent that you have authority to accept
          these Terms for it.
        </p>
      </LegalSection>

      <LegalSection heading="3. Your account">
        <p>
          You are responsible for your account credentials and for activity under your account. Keep your
          password secure and notify us at{' '}
          <a className="text-primary hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> of
          any unauthorized use. We may suspend or terminate accounts that violate these Terms.
        </p>
      </LegalSection>

      <LegalSection heading="4. Plans, subscriptions, and billing">
        <LegalList
          items={[
            <><strong className="text-chalk">Free plan.</strong> Includes the Play Designer, up to 15 saved plays, 2 playbooks, single-play PDF export, and community access. Limits may change with notice.</>,
            <><strong className="text-chalk">Pro plan.</strong> $39 per year (plus any applicable taxes). Pro includes unlimited plays and playbooks, full-playbook PDF export, wristband export, and clean print output.</>,
            <><strong className="text-chalk">Automatic renewal.</strong> Pro subscriptions renew automatically every 12 months and your payment method is charged at the then-current price until you cancel. We will notify you before the price of an existing subscription increases.</>,
            <><strong className="text-chalk">Cancellation.</strong> Cancel anytime via <em>Manage billing</em> in Account Settings. Cancellation takes effect at the end of the current billing period; you keep Pro access until then.</>,
            <><strong className="text-chalk">Refunds.</strong> Except where required by law, payments are non-refundable and we do not provide credits for partial subscription periods.</>,
            <><strong className="text-chalk">Founding Members.</strong> Accounts created before paid plans launched receive Pro features at no charge (&ldquo;Founding Member&rdquo; status). This is a courtesy benefit tied to the original account holder; it is non-transferable and applies to the feature set we designate for Founding Members.</>,
            <><strong className="text-chalk">Payment processing.</strong> Payments are processed by Stripe. Your card details are provided directly to Stripe and are subject to Stripe&rsquo;s terms and privacy policy.</>,
          ]}
        />
      </LegalSection>

      <LegalSection heading="5. Your content">
        <p>
          You own the plays, playbooks, posts, comments, images, and other content you create or upload
          (&ldquo;User Content&rdquo;). So that we can operate the Service, you grant us a worldwide,
          non-exclusive, royalty-free license to host, store, display, reproduce, and (for content you make
          public) distribute your User Content within the Service. Content you mark public — public plays and
          community posts — may be viewed by other users, who may view and use those plays for coaching their
          own teams. This license ends when you delete the content or your account, except for content others
          have already copied or that we must retain for legal reasons.
        </p>
        <p>You are responsible for your User Content and must have the rights to anything you upload.</p>
      </LegalSection>

      <LegalSection heading="6. Acceptable use">
        <p>You agree not to:</p>
        <LegalList
          items={[
            'Upload content that is unlawful, infringing, harassing, hateful, sexually explicit, or inappropriate for a community that includes youth sports coaches;',
            'Impersonate others or misrepresent your affiliation;',
            'Attempt to access other users’ private data, probe or circumvent security measures, or interfere with the Service;',
            'Scrape, resell, or redistribute the Service or its content except as the Service intends;',
            'Use the Service to send spam or unsolicited promotion.',
          ]}
        />
        <p>
          We may remove content or suspend accounts that violate these rules. Community images can be reported
          in-app and are reviewed by moderators.
        </p>
      </LegalSection>

      <LegalSection heading="7. Our intellectual property">
        <p>
          The Service — including its software, design, logo, and name — is owned by us or our licensors and is
          protected by intellectual-property laws. These Terms do not grant you any right to use our branding.
        </p>
      </LegalSection>

      <LegalSection heading="8. Copyright complaints (DMCA)">
        <p>
          We respond to notices of alleged copyright infringement under the Digital Millennium Copyright Act.
          Send notices identifying the copyrighted work, the infringing material&rsquo;s location on the
          Service, your contact information, and the statements required by 17 U.S.C. § 512(c)(3) to{' '}
          <a className="text-primary hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with
          the subject &ldquo;DMCA Notice.&rdquo; We may remove content and terminate repeat infringers.
        </p>
      </LegalSection>

      <LegalSection heading="9. Disclaimers">
        <p>
          THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY
          KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
          NON-INFRINGEMENT. We do not warrant that the Service will be uninterrupted or error-free, or that
          content (including community plays) is accurate or suitable for your team. Coaching decisions —
          including player safety — are yours.
        </p>
      </LegalSection>

      <LegalSection heading="10. Limitation of liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
          CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, DATA, OR GOODWILL. OUR TOTAL LIABILITY FOR
          ALL CLAIMS RELATING TO THE SERVICE IS LIMITED TO THE GREATER OF $50 OR THE AMOUNT YOU PAID US IN THE
          12 MONTHS BEFORE THE CLAIM AROSE. Some jurisdictions do not allow certain limitations, so parts of
          this section may not apply to you.
        </p>
      </LegalSection>

      <LegalSection heading="11. Indemnification">
        <p>
          You will defend and indemnify us against claims arising from your User Content or your violation of
          these Terms or of another party&rsquo;s rights.
        </p>
      </LegalSection>

      <LegalSection heading="12. Termination">
        <p>
          You may stop using the Service or delete your account at any time from Account Settings. We may
          suspend or terminate your access for violation of these Terms, with notice where practicable.
          Sections that by their nature should survive termination (including 5, 9, 10, 11, and 13) survive.
        </p>
      </LegalSection>

      <LegalSection heading="13. Governing law">
        <p>
          These Terms are governed by the laws of the State of Indiana, without regard to conflict-of-law
          rules. Any dispute that cannot be resolved informally will be brought exclusively in the state or
          federal courts located in Indiana, and you consent to their jurisdiction.
        </p>
      </LegalSection>

      <LegalSection heading="14. Changes to these Terms">
        <p>
          We may update these Terms from time to time. If we make material changes, we will update the
          effective date above and note the change on the site; for significant changes affecting paid
          subscriptions, we will provide advance notice. Continued use after changes take effect means you
          accept the updated Terms.
        </p>
      </LegalSection>

      <LegalSection heading="15. Contact">
        <p>
          Questions about these Terms:{' '}
          <a className="text-primary hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
