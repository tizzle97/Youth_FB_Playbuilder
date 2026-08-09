import React, { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { User as UserIcon, Lock, Mail, AlertTriangle, Calendar, Trash2, Upload, Save, Trophy, Shield } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ImageCropModal } from './ImageCropModal';
import { getSafeErrorMessage } from '../../lib/errors';
import { assertReasonableUpload, downscaleImage } from '../../lib/imageResize';
import { checkIsAdmin } from '../../lib/admin';
import { signOutSafely } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { FREE_LIMITS, rowIsPro, type Plan } from '../../lib/entitlements';
import {
  DEFAULT_PREFERENCES,
  getUserPreferences,
  saveUserPreferences,
  type UserPreferences,
} from '../../lib/userPreferences';
import { BILLING_ENABLED, openBillingPortal, startProCheckout } from '../../lib/billing';
import { usePageMeta } from '../../lib/seo';
import { UpgradeConsentModal } from '../billing/UpgradeConsentModal';
import { MyFeedback } from '../feedback/MyFeedback';

export default function AccountSettings() {
  usePageMeta({ title: 'Account Settings', path: '/account' });
  const [isFoundingMember, setIsFoundingMember] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [plan, setPlan] = useState<Plan>('free');
  const [isProPlan, setIsProPlan] = useState(false);
  const [playCount, setPlayCount] = useState<number | null>(null);
  const [playbookCount, setPlaybookCount] = useState<number | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [avatarType, setAvatarType] = useState<'custom' | 'icon'>('icon');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [selectedIconId, setSelectedIconId] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState('');
  const [showUpgradeConsent, setShowUpgradeConsent] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [initialPrefs, setInitialPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialValues, setInitialValues] = useState({
    username: '',
    avatarType: 'icon' as 'custom' | 'icon',
    avatarUrl: '',
    selectedIconId: null as string | null
  });
  const navigate = useNavigate();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        navigate('/auth');
        return;
      }
      setUser(currentUser);
      const initialUsername = currentUser.user_metadata?.username || '';
      setUsername(initialUsername);

      // Reads the subscriptions row directly rather than via useEntitlement():
      // that hook makes its own supabase.auth.getUser() call, and running it
      // concurrently with this effect's getUser() call deadlocks gotrue-js's
      // internal session lock.
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('plan, current_period_end')
        .eq('user_id', currentUser.id)
        .maybeSingle();
      setIsFoundingMember(sub?.plan === 'founding');
      setPlan((sub?.plan as Plan) || 'free');
      setIsProPlan(rowIsPro(sub));

      checkIsAdmin(currentUser.id).then(setIsAdmin);

      // Usage counts for the Plan & Usage card (head:true fetches only the
      // count, no rows).
      const [playsRes, playbooksRes] = await Promise.all([
        supabase.from('plays').select('id', { count: 'exact', head: true }).eq('user_id', currentUser.id),
        supabase.from('playbooks').select('id', { count: 'exact', head: true }).eq('user_id', currentUser.id),
      ]);
      setPlayCount(playsRes.count ?? 0);
      setPlaybookCount(playbooksRes.count ?? 0);

      // Team identity + save/export defaults (B-14/B-15)
      const loadedPrefs = await getUserPreferences(currentUser.id);
      setPrefs(loadedPrefs);
      setInitialPrefs(loadedPrefs);

      // Fetch user's avatar preferences
      const { data: userRep } = await supabase
        .from('user_reputation')
        .select('avatar_type, avatar_url, avatar_icon_id')
        .eq('user_id', currentUser.id)
        .single();

      if (userRep) {
        setAvatarType(userRep.avatar_type);
        setAvatarUrl(userRep.avatar_url || '');
        setSelectedIconId(userRep.avatar_icon_id);
        
        // Store initial values
        setInitialValues({
          username: initialUsername,
          avatarType: userRep.avatar_type,
          avatarUrl: userRep.avatar_url || '',
          selectedIconId: userRep.avatar_icon_id
        });
      }

      setLoading(false);
    };
    getUser();
  }, [navigate]);

  // Check for changes
  useEffect(() => {
    const hasUnsavedChanges =
      username !== initialValues.username ||
      avatarType !== initialValues.avatarType ||
      avatarUrl !== initialValues.avatarUrl ||
      selectedIconId !== initialValues.selectedIconId ||
      newPassword !== '' ||
      newEmail !== '' ||
      JSON.stringify(prefs) !== JSON.stringify(initialPrefs);

    setHasChanges(hasUnsavedChanges);
  }, [username, avatarType, avatarUrl, selectedIconId, newPassword, newEmail, initialValues, prefs, initialPrefs]);

  const handleSaveChanges = async () => {
    if (!user) return;
    try {
      setError('');
      setSuccess('');

      // Update password if a new one was entered
      if (newPassword) {
        if (newPassword !== confirmPassword) {
          throw new Error('New password and confirmation do not match.');
        }
        if (newPassword.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }
        const { error: passwordError } = await supabase.auth.updateUser({
          password: newPassword
        });
        if (passwordError) throw passwordError;
        setNewPassword('');
        setConfirmPassword('');
      }

      // Update username if changed
      if (username !== initialValues.username) {
        const { error: usernameError } = await supabase.auth.updateUser({
          data: { username }
        });
        if (usernameError) throw usernameError;
      }

      // Request email change (B-16). Supabase doesn't switch the address
      // immediately — it emails a confirmation link (to the new address, and
      // to the old one too when "Secure email change" is enabled), so tell
      // the user what to expect instead of claiming it's done.
      let emailNotice = '';
      if (newEmail && newEmail !== user.email) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
          throw new Error('Please enter a valid email address.');
        }
        const { error: emailError } = await supabase.auth.updateUser({
          email: newEmail
        });
        if (emailError) throw emailError;
        emailNotice = ` A confirmation link has been sent to ${newEmail} — your email address will change once you confirm it (check the old inbox too if it asks).`;
        setNewEmail('');
      }

      // Update avatar settings if changed
      if (avatarType !== initialValues.avatarType ||
          avatarUrl !== initialValues.avatarUrl ||
          selectedIconId !== initialValues.selectedIconId) {
        const { error: avatarError } = await supabase
          .from('user_reputation')
          .update({
            avatar_type: avatarType,
            avatar_url: avatarType === 'custom' ? avatarUrl : null,
            avatar_icon_id: avatarType === 'icon' ? selectedIconId : null
          })
          .eq('user_id', user.id);
        
        if (avatarError) throw avatarError;
      }

      // Persist team identity / defaults if changed (B-14/B-15)
      if (JSON.stringify(prefs) !== JSON.stringify(initialPrefs)) {
        await saveUserPreferences(user.id, prefs);
        setInitialPrefs(prefs);
      }

      // Update initial values
      setInitialValues({
        username,
        avatarType,
        avatarUrl,
        selectedIconId
      });

      setSuccess('Changes saved successfully!' + emailNotice);
      setHasChanges(false);
    } catch (err) {
      setError(getSafeErrorMessage(err, 'Failed to save changes'));
    }
  };

  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Any real photo is fine — the crop step downscales to ≤512px before
      // upload, so the original's size doesn't matter (25MB sanity cap only).
      assertReasonableUpload(file);

      // Create temporary URL for the image
      const imageUrl = URL.createObjectURL(file);
      setTempImageUrl(imageUrl);
      setShowCropModal(true);
    } catch (err) {
      setError(getSafeErrorMessage(err, 'Failed to process image'));
    }
  };

  const handleCroppedImage = async (croppedBlob: Blob) => {
    try {
      if (!user) {
        setError('User not available');
        return;
      }
      setUploadingAvatar(true);
      setError('');

      const fileName = `${Math.random().toString(36).slice(2)}.jpg`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, croppedBlob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setAvatarType('custom');
      setAvatarUrl(publicUrl);
      setSelectedIconId(null);
    } catch (err) {
      setError(getSafeErrorMessage(err, 'Failed to upload avatar'));
    } finally {
      setUploadingAvatar(false);
      URL.revokeObjectURL(tempImageUrl);
    }
  };

  // Team logo upload (B-14). Reuses the avatars bucket — same per-user
  // folder policy; no crop step since logos aren't forced square. Logos are
  // downscaled client-side (≤1024px, PNG keeps transparency for print) so
  // any original size works. The URL only persists via Save Changes.
  const handleLogoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file || !user) return;

    try {
      assertReasonableUpload(file);
      setUploadingLogo(true);
      setError('');

      const resized = await downscaleImage(file, 1024);
      const ext = resized.type === 'image/png' ? 'png' : 'jpg';
      const filePath = `${user.id}/team-logo-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, resized, { contentType: resized.type });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setPrefs((p) => ({ ...p, team_logo_url: publicUrl }));
    } catch (err) {
      setError(getSafeErrorMessage(err, 'Failed to upload logo'));
    } finally {
      setUploadingLogo(false);
      input.value = '';
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const { error } = await supabase.rpc('delete_user');
      if (error) throw error;
      // The account no longer exists, so the server rejects the logout call.
      // signOutSafely() swallows that and clears the local session anyway —
      // a bare signOut() here threw, so a *successful* deletion still showed
      // "Failed to delete account" and never navigated away.
      await signOutSafely();
      navigate('/');
    } catch (err) {
      setError(getSafeErrorMessage(err, 'Failed to delete account'));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-board flex items-center justify-center">
        <div className="text-chalk">Loading...</div>
      </div>
    );
  }

  // getUser() redirects to /auth when signed out, so user is set by the time
  // loading clears — this narrows the type for the JSX below.
  if (!user) return null;

  return (
    <div className="min-h-screen bg-board py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-board-light rounded-xl shadow-lg border border-chalk/10 overflow-hidden">
          <div className="px-6 py-4 border-b border-chalk/10 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-chalk">Account Settings</h2>
              {isFoundingMember && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/40 text-primary text-xs font-semibold">
                  <Trophy className="h-3.5 w-3.5" />
                  Founding Member
                </span>
              )}
            </div>
            {hasChanges && (
              <button
                onClick={handleSaveChanges}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors"
              >
                <Save className="h-4 w-4" />
                Save Changes
              </button>
            )}
          </div>

          <div className="p-6 space-y-8">
            {/* Member Since */}
            <div className="flex items-center gap-4 p-4 bg-board rounded-lg border border-chalk/10">
              <Calendar className="h-6 w-6 text-primary" />
              <div>
                <h3 className="text-chalk font-medium">Member Since</h3>
                <p className="text-chalk/70">
                  {format(new Date(user.created_at), 'MMMM d, yyyy')}
                </p>
              </div>
            </div>

            {/* Admin shortcut — visible only to real admin_users members
                (server-verified via checkIsAdmin, not user metadata). */}
            {isAdmin && (
              <Link
                to="/admin"
                className="flex items-center gap-4 p-4 bg-board rounded-lg border border-chalk/10 hover:border-primary/40 transition-colors group"
              >
                <Shield className="h-6 w-6 text-primary" />
                <div className="flex-1">
                  <h3 className="text-chalk font-medium group-hover:text-primary transition-colors">Admin Dashboard</h3>
                  <p className="text-chalk/70 text-sm">Manage users and feedback</p>
                </div>
              </Link>
            )}

            {/* Renders nothing until the coach has actually sent something. */}
            <MyFeedback userId={user.id} />

            {/* Plan & Usage (B-13). Also the future home of the Stripe
                Customer Portal link once B-3 ships. */}
            <div className="p-4 bg-board rounded-lg border border-chalk/10 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-chalk font-medium">Plan &amp; Usage</h3>
                {isFoundingMember ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/40 text-primary text-xs font-semibold">
                    <Trophy className="h-3.5 w-3.5" />
                    Founding Member
                  </span>
                ) : (
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      isProPlan
                        ? 'bg-primary/10 border border-primary/40 text-primary'
                        : 'bg-board-light border border-chalk/20 text-chalk/70'
                    }`}
                  >
                    {plan === 'pro' ? 'Pro' : 'Free plan'}
                  </span>
                )}
              </div>

              {isProPlan ? (
                <>
                  <p className="text-sm text-chalk/70">
                    {playCount ?? 0} {playCount === 1 ? 'play' : 'plays'} ·{' '}
                    {playbookCount ?? 0} {playbookCount === 1 ? 'playbook' : 'playbooks'} — unlimited
                    on your plan.
                  </p>
                  {/* Stripe Customer Portal (B-3) — paid subscribers only;
                      Founding Members have no Stripe customer to manage. */}
                  {BILLING_ENABLED && plan === 'pro' && (
                    <button
                      type="button"
                      onClick={() => openBillingPortal().catch((err) => setError(getSafeErrorMessage(err, 'Could not open the billing portal')))}
                      className="px-4 py-2 text-sm font-medium text-chalk bg-board-light border border-chalk/20 rounded-lg hover:bg-board transition-colors"
                    >
                      Manage billing
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div className="space-y-3">
                    {[
                      { label: 'Plays', used: playCount ?? 0, limit: FREE_LIMITS.plays },
                      { label: 'Playbooks', used: playbookCount ?? 0, limit: FREE_LIMITS.playbooks },
                    ].map((m) => (
                      <div key={m.label}>
                        <div className="flex justify-between text-sm text-chalk/80 mb-1">
                          <span>{m.label}</span>
                          <span>
                            {m.used} of {m.limit}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-chalk/10 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${m.used >= m.limit ? 'bg-red-500' : 'bg-primary'}`}
                            style={{ width: `${Math.min(100, (m.used / m.limit) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => (BILLING_ENABLED ? setShowUpgradeConsent(true) : navigate('/'))}
                    className="w-full px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    Upgrade to Pro — $39/yr
                  </button>
                </>
              )}
            </div>

            {/* Avatar Section — custom photo only; the icon picker was
                removed, but existing icon-avatar accounts keep rendering
                fine elsewhere (see UserMenu.tsx) until they upload a photo. */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-chalk">Profile Picture</h3>

              <div className="space-y-4">
                {avatarUrl && (
                  <div className="w-24 h-24 rounded-full overflow-hidden">
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                )}
                <div>
                  <label className="block w-full max-w-xs px-4 py-2 bg-board hover:bg-board-light border border-chalk/20 rounded-lg cursor-pointer text-center text-chalk/70 hover:text-chalk transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarFileSelect}
                      disabled={uploadingAvatar}
                    />
                    {uploadingAvatar ? 'Uploading...' : 'Upload Photo'}
                  </label>
                  <p className="mt-2 text-sm text-chalk/50">
                    JPEG or PNG — large photos are resized automatically.
                    Please ensure your image is appropriate and follows our guidelines.
                  </p>
                </div>
              </div>
            </div>

            {/* Team & Defaults (B-14): stamped on printed plays/playbooks and
                used to prefill the save dialog in the designer */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-chalk">Team &amp; Defaults</h3>
                <p className="text-sm text-chalk/50 mt-1">
                  Your team name and logo appear on printed plays and playbook PDFs.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="team-name" className="block text-sm font-medium text-chalk mb-1">
                    Team Name
                  </label>
                  <input
                    type="text"
                    id="team-name"
                    value={prefs.team_name ?? ''}
                    onChange={(e) => setPrefs((p) => ({ ...p, team_name: e.target.value || null }))}
                    placeholder="e.g., Eastside Eagles"
                    className="block w-full px-3 py-2 border border-chalk/20 rounded-lg bg-board text-chalk placeholder-chalk/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="default-game-format" className="block text-sm font-medium text-chalk mb-1">
                    Default Game Format
                  </label>
                  <select
                    id="default-game-format"
                    value={prefs.default_game_format}
                    onChange={(e) =>
                      setPrefs((p) => ({ ...p, default_game_format: e.target.value as UserPreferences['default_game_format'] }))
                    }
                    className="block w-full px-3 py-2 border border-chalk/20 rounded-lg bg-board text-chalk focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="5v5">5v5 Flag Football</option>
                    <option value="6v6">6v6 Flag Football</option>
                    <option value="7v7">7v7 Flag Football</option>
                    <option value="11v11">11v11 Traditional</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {prefs.team_logo_url && (
                  <img
                    src={prefs.team_logo_url}
                    alt="Team logo"
                    className="h-12 w-12 object-contain rounded bg-board border border-chalk/10"
                    loading="lazy"
                    decoding="async"
                  />
                )}
                <label className="px-4 py-2 bg-board hover:bg-board-light border border-chalk/20 rounded-lg cursor-pointer text-sm text-chalk/70 hover:text-chalk transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoFileSelect}
                    disabled={uploadingLogo}
                  />
                  {uploadingLogo ? 'Uploading…' : prefs.team_logo_url ? 'Replace Logo' : 'Upload Team Logo'}
                </label>
                {prefs.team_logo_url && (
                  <button
                    type="button"
                    onClick={() => setPrefs((p) => ({ ...p, team_logo_url: null }))}
                    className="text-sm text-chalk/50 hover:text-red-400 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>

              {/* Save & export defaults (B-15) */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="default-visibility" className="block text-sm font-medium text-chalk mb-1">
                    Default Play Visibility
                  </label>
                  <select
                    id="default-visibility"
                    value={prefs.default_visibility}
                    onChange={(e) =>
                      setPrefs((p) => ({ ...p, default_visibility: e.target.value as UserPreferences['default_visibility'] }))
                    }
                    className="block w-full px-3 py-2 border border-chalk/20 rounded-lg bg-board text-chalk focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="private">Private (only you)</option>
                    <option value="public">Public (community plays page)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="default-play-type" className="block text-sm font-medium text-chalk mb-1">
                    Default Play Type
                  </label>
                  <select
                    id="default-play-type"
                    value={prefs.default_play_type}
                    onChange={(e) =>
                      setPrefs((p) => ({ ...p, default_play_type: e.target.value as UserPreferences['default_play_type'] }))
                    }
                    className="block w-full px-3 py-2 border border-chalk/20 rounded-lg bg-board text-chalk focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="pass">Pass</option>
                    <option value="run">Run</option>
                    <option value="option">Option</option>
                    <option value="reverse">Reverse</option>
                    <option value="screen">Screen</option>
                    <option value="trick">Trick Play</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="paper-size" className="block text-sm font-medium text-chalk mb-1">
                    Paper Size (printing)
                  </label>
                  <select
                    id="paper-size"
                    value={prefs.paper_size}
                    onChange={(e) =>
                      setPrefs((p) => ({ ...p, paper_size: e.target.value as UserPreferences['paper_size'] }))
                    }
                    className="block w-full px-3 py-2 border border-chalk/20 rounded-lg bg-board text-chalk focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="letter">Letter (8.5 × 11 in)</option>
                    <option value="a4">A4</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="default-export-style" className="block text-sm font-medium text-chalk mb-1">
                    Default Playbook Export Style
                  </label>
                  <select
                    id="default-export-style"
                    value={prefs.default_export_style}
                    onChange={(e) =>
                      setPrefs((p) => ({ ...p, default_export_style: e.target.value as UserPreferences['default_export_style'] }))
                    }
                    className="block w-full px-3 py-2 border border-chalk/20 rounded-lg bg-board text-chalk focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="simple">Simple (1 per page)</option>
                    <option value="detailed">Detailed (1 per page)</option>
                    <option value="grid">Grid (all on one page)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Username Section */}
            <div className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-chalk">
                  Username
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                    <UserIcon className="h-5 w-5 text-chalk/50" />
                  </div>
                  <input
                    type="text"
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-chalk/20 rounded-lg bg-board text-chalk placeholder-chalk/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Email Section (B-16) */}
            <div className="space-y-4">
              <div>
                <label htmlFor="new-email" className="block text-sm font-medium text-chalk">
                  Email Address
                </label>
                <p className="mt-1 text-sm text-chalk/50">
                  Currently <span className="text-chalk/80">{user.email}</span>. Changing it sends a
                  confirmation link — the switch only happens after you confirm.
                </p>
                <div className="mt-2 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                    <Mail className="h-5 w-5 text-chalk/50" />
                  </div>
                  <input
                    type="email"
                    id="new-email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="New email address"
                    autoComplete="email"
                    className="block w-full pl-10 pr-3 py-2 border border-chalk/20 rounded-lg bg-board text-chalk placeholder-chalk/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Password Section */}
            <form onSubmit={(e) => {
              e.preventDefault();
              handleSaveChanges();
            }} className="space-y-4">
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-chalk">
                  New Password
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                    <Lock className="h-5 w-5 text-chalk/50" />
                  </div>
                  <input
                    type="password"
                    id="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-chalk/20 rounded-lg bg-board text-chalk placeholder-chalk/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Enter new password"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-chalk">
                  Confirm New Password
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                    <Lock className="h-5 w-5 text-chalk/50" />
                  </div>
                  <input
                    type="password"
                    id="confirm-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-chalk/20 rounded-lg bg-board text-chalk placeholder-chalk/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Confirm new password"
                  />
                </div>
              </div>
            </form>

            {/* Delete Account Section */}
            <div className="border-t border-chalk/10 pt-6">
              <div className="rounded-lg bg-red-500/10 p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-500">Delete Account</h3>
                    <div className="mt-2">
                      <p className="text-sm text-red-400">
                        Once you delete your account, there is no going back. Please be certain.
                      </p>
                    </div>
                    {!showDeleteConfirm ? (
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(true)}
                          className="inline-flex items-center px-3 py-2 border border-red-500 text-sm leading-4 font-medium rounded-md text-red-500 hover:bg-red-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Account
                        </button>
                      </div>
                    ) : (
                      <div className="mt-4 flex gap-4">
                        <button
                          type="button"
                          onClick={handleDeleteAccount}
                          className="inline-flex items-center px-3 py-2 border border-red-500 text-sm leading-4 font-medium rounded-md text-white bg-red-500 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          Confirm Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(false)}
                          className="inline-flex items-center px-3 py-2 border border-chalk/20 text-sm leading-4 font-medium rounded-md text-chalk hover:bg-board focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-chalk/20"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="text-red-500 text-sm text-center bg-red-500/10 p-3 rounded-lg">
                {error}
              </div>
            )}

            {success && (
              <div className="text-green-500 text-sm text-center bg-green-500/10 p-3 rounded-lg">
                {success}
              </div>
            )}
          </div>
        </div>
      </div>

      <ImageCropModal
        isOpen={showCropModal}
        onClose={() => {
          setShowCropModal(false);
          URL.revokeObjectURL(tempImageUrl);
        }}
        imageUrl={tempImageUrl}
        onCropComplete={handleCroppedImage}
      />

      {showUpgradeConsent && (
        <UpgradeConsentModal
          busy={checkoutBusy}
          error={error || null}
          onCancel={() => setShowUpgradeConsent(false)}
          onConfirm={() => {
            setError('');
            setCheckoutBusy(true);
            startProCheckout().catch((err) => {
              setError(getSafeErrorMessage(err, 'Could not start checkout'));
              setCheckoutBusy(false);
            });
          }}
        />
      )}
    </div>
  );
}

export { AccountSettings }
