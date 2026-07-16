import React, { useState, useRef, useEffect } from 'react';
import { User, LogOut, Settings, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { checkIsAdmin } from '../../lib/admin';

interface UserMenuProps {
  user: SupabaseUser;
}

export function UserMenu({ user }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  const fetchAvatar = async () => {
    try {
      const { data: userRep } = await supabase
        .from('user_reputation')
        .select(`
          avatar_type,
          avatar_url,
          avatar_icon_id,
          avatar_icons!avatar_icon_id (
            icon_url
          )
        `)
        .eq('user_id', user.id)
        .single();

      if (userRep) {
        if (userRep.avatar_type === 'custom' && userRep.avatar_url) {
          setAvatarUrl(userRep.avatar_url);
        } else if (userRep.avatar_type === 'icon') {
          // avatar_icons may be returned as an array (joined rows) or an object depending on select
          const avatarIcons = userRep.avatar_icons as
            | { icon_url: string }
            | { icon_url: string }[]
            | null;
          const iconUrl = Array.isArray(avatarIcons)
            ? avatarIcons[0]?.icon_url
            : avatarIcons?.icon_url;
          if (iconUrl) setAvatarUrl(iconUrl);
        }
      }

      // Server-verified — never trust user_metadata for authorization
      checkIsAdmin(user.id).then(setIsAdmin);
    } catch (error) {
      console.error('Error fetching avatar:', error);
    }
  };

  useEffect(() => {
    fetchAvatar();

    // Subscribe to changes in user_reputation table
    const channel = supabase
      .channel('user_reputation_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_reputation',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchAvatar();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user.id]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isMobile) return;

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobile]);

  const handleMouseEnter = () => {
    if (isMobile) return;
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    if (isMobile) return;
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
      timeoutRef.current = null;
    }, 150);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const displayName = user.user_metadata?.username || user.email?.split('@')[0] || 'User';

  return (
    <div 
      ref={menuRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={() => isMobile && setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-md text-chalk hover:bg-board transition-colors"
      >
        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            <User className="h-5 w-5 text-primary" />
          )}
        </div>
        <span className="text-sm font-medium">
          {displayName}
          {isAdmin && (
            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-primary">
              Admin
            </span>
          )}
        </span>
      </button>

      {isOpen && (
        <div 
          className="absolute right-0 mt-2 w-48 bg-board-light rounded-lg shadow-lg py-1 border border-chalk/10 z-50"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="px-4 py-2 text-sm text-chalk/70 border-b border-chalk/10">
            Signed in as<br />
            <span className="font-medium text-chalk">{user.email}</span>
          </div>
          
          {isAdmin && (
            <button
              onClick={() => {
                navigate('/admin');
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-chalk/70 hover:text-chalk hover:bg-board flex items-center gap-2"
            >
              <Shield className="h-4 w-4" />
              Admin Dashboard
            </button>
          )}

          <button
            onClick={() => {
              navigate('/account');
              setIsOpen(false);
            }}
            className="w-full text-left px-4 py-2 text-sm text-chalk/70 hover:text-chalk hover:bg-board flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Account Settings
          </button>
          
          <button
            onClick={handleSignOut}
            className="w-full text-left px-4 py-2 text-sm text-chalk/70 hover:text-chalk hover:bg-board flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
