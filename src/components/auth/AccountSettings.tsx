import React, { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { User as UserIcon, Lock, AlertTriangle, Calendar, Trash2, Upload, Image, Save, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ImageCropModal } from './ImageCropModal';
import { getSafeErrorMessage } from '../../lib/errors';
import { supabase } from '../../lib/supabase';

export default function AccountSettings() {
  const [isFoundingMember, setIsFoundingMember] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [avatarType, setAvatarType] = useState<'custom' | 'icon'>('icon');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [selectedIconId, setSelectedIconId] = useState<string | null>(null);
  const [availableIcons, setAvailableIcons] = useState<any[]>([]);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState('');
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
        .select('plan')
        .eq('user_id', currentUser.id)
        .maybeSingle();
      setIsFoundingMember(sub?.plan === 'founding');

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

      // Fetch available icons
      const { data: icons } = await supabase
        .from('avatar_icons')
        .select('*')
        .order('created_at', { ascending: true });

      if (icons) {
        setAvailableIcons(icons);
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
      newPassword !== '';

    setHasChanges(hasUnsavedChanges);
  }, [username, avatarType, avatarUrl, selectedIconId, newPassword, initialValues]);

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

      // Update initial values
      setInitialValues({
        username,
        avatarType,
        avatarUrl,
        selectedIconId
      });

      setSuccess('Changes saved successfully!');
      setHasChanges(false);
    } catch (err) {
      setError(getSafeErrorMessage(err, 'Failed to save changes'));
    }
  };

  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Check file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('File size must be less than 2MB');
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        throw new Error('File must be an image');
      }

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

  const handleSelectIcon = async (iconId: string) => {
    setAvatarType('icon');
    setSelectedIconId(iconId);
    setAvatarUrl('');
  };

  const handleDeleteAccount = async () => {
    try {
      const { error } = await supabase.rpc('delete_user');
      if (error) throw error;
      await supabase.auth.signOut();
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

            {/* Avatar Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-chalk">Profile Picture</h3>
              
              <div className="flex gap-4">
                <button
                  onClick={() => setAvatarType('custom')}
                  className={`px-4 py-2 rounded-lg ${
                    avatarType === 'custom'
                      ? 'bg-primary text-white'
                      : 'bg-board text-chalk/70 hover:text-chalk'
                  }`}
                >
                  <Upload className="h-5 w-5 inline-block mr-2" />
                  Custom Photo
                </button>
                
                <button
                  onClick={() => setAvatarType('icon')}
                  className={`px-4 py-2 rounded-lg ${
                    avatarType === 'icon'
                      ? 'bg-primary text-white'
                      : 'bg-board text-chalk/70 hover:text-chalk'
                  }`}
                >
                  <Image className="h-5 w-5 inline-block mr-2" />
                  Choose Icon
                </button>
              </div>

              {avatarType === 'custom' ? (
                <div className="space-y-4">
                  {avatarUrl && (
                    <div className="w-24 h-24 rounded-full overflow-hidden">
                      <img
                        src={avatarUrl}
                        alt="Profile"
                        className="w-full h-full object-cover"
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
                      Maximum file size: 2MB. Supported formats: JPEG, PNG. 
                      Please ensure your image is appropriate and follows our guidelines.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-4">
                  {availableIcons.map((icon) => (
                    <button
                      key={icon.id}
                      onClick={() => handleSelectIcon(icon.id)}
                      className={`p-2 rounded-lg border-2 ${
                        selectedIconId === icon.id
                          ? 'border-primary bg-primary/10'
                          : 'border-chalk/10 hover:border-chalk/30'
                      }`}
                    >
                      <img
                        src={icon.icon_url}
                        alt={icon.name}
                        className="w-full aspect-square"
                      />
                    </button>
                  ))}
                </div>
              )}
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
    </div>
  );
}

export { AccountSettings }
