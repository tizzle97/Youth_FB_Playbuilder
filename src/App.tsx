import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { Features } from './components/Features';
import { TopPlays } from './components/TopPlays';
import { Testimonials } from './components/Testimonials';
import { Donate } from './components/Donate';
import { CommunityPage } from './components/community/CommunityPage';
import { BlogPage } from './components/blog/BlogPage';
import { AuthPage } from './components/auth/AuthPage';
import { AccountSettings } from './components/auth/AccountSettings';
import { PlayDesigner } from './components/designer/PlayDesigner';
import { PlaysPage } from './components/plays/PlaysPage';
import { PlaybooksPage } from './components/playbooks/PlaybooksPage';
import { FeedbackButton } from './components/FeedbackButton';
import { AdminDashboard } from './components/admin/AdminDashboard';

function HomePage() {
  return (
    <>
      <Hero />
      <Features />
      <TopPlays />
      <Testimonials />
      <Donate />
    </>
  );
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-board">
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/account" element={<AccountSettings />} />
          <Route path="/plays" element={<PlaysPage />} />
          <Route path="/playbooks" element={<PlaybooksPage />} />
          <Route path="/designer" element={<PlayDesigner />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
        <FeedbackButton />
      </div>
    </Router>
  );
}

export default App;
