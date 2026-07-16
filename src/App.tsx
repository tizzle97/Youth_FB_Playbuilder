import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { Features } from './components/Features';
import { TopPlays } from './components/TopPlays';
// Testimonials stays disabled on the homepage until backed by real,
// permission-granted user quotes (see BACKLOG B-12).
import { Pricing } from './components/Pricing';
import { CommunityPage } from './components/community/CommunityPage';
import { BlogPage, BlogPostPage } from './components/blog/BlogPage';
import { AuthPage } from './components/auth/AuthPage';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
import { AccountSettings } from './components/auth/AccountSettings';
import { PlayDesigner } from './components/designer/PlayDesigner';
import { PlaysPage } from './components/plays/PlaysPage';
import { PlaybooksPage } from './components/playbooks/PlaybooksPage';
import { FeedbackButton } from './components/FeedbackButton';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { Footer } from './components/Footer';
import { ConsentBanner } from './components/ConsentBanner';
import { NotFound } from './components/NotFound';
import { PrivacyPolicy } from './components/legal/PrivacyPolicy';
import { TermsOfService } from './components/legal/TermsOfService';
import { ContactPage } from './components/legal/ContactPage';
import { initAnalyticsFromStoredConsent } from './lib/analytics';

function HomePage() {
  return (
    <>
      <Hero />
      <Features />
      {/* TopPlays self-hides until at least one public play has real votes
          (and until play_votes.sql has been run). */}
      <TopPlays />
      {/*
        TODO: Re-enable <Testimonials /> once there are real, collected user
        quotes with permission to publish (BACKLOG B-12). Component kept in
        src/components/ for future use.
      */}
      <Pricing />
    </>
  );
}

/**
 * Safety net for password-recovery links. If Supabase's redirect allowlist
 * sends the user to the homepage (or anywhere else) instead of the reset
 * page, the recovery token in the URL hash still signs them in — catch that
 * and route them to the reset form so they can actually set a new password.
 */
function RecoveryRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // The recovery hash is present synchronously on first load
    if (window.location.hash.includes('type=recovery') && location.pathname !== '/auth/reset-password') {
      navigate('/auth/reset-password' + window.location.hash, { replace: true });
      return;
    }
    // Belt-and-suspenders: Supabase fires PASSWORD_RECOVERY after exchanging the token
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && window.location.pathname !== '/auth/reset-password') {
        navigate('/auth/reset-password', { replace: true });
      }
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

function App() {
  useEffect(() => {
    initAnalyticsFromStoredConsent();
  }, []);

  return (
    <Router>
      <RecoveryRedirect />
      <div className="min-h-screen bg-board flex flex-col">
        <Navbar />
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/community" element={<CommunityPage />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
            <Route path="/account" element={<AccountSettings />} />
            <Route path="/plays" element={<PlaysPage />} />
            <Route path="/playbooks" element={<PlaybooksPage />} />
            <Route path="/designer" element={<PlayDesigner />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
        <Footer />
        <ConsentBanner />
        <FeedbackButton />
      </div>
    </Router>
  );
}

export default App;
