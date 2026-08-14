import React, { useState } from 'react';
import { PenSquare } from 'lucide-react';
import { PostFormModal } from './PostFormModal';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface CreatePostButtonProps {
  onPostCreated: () => void;
}

export function CreatePostButton({ onPostCreated }: CreatePostButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  const handleClick = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }
    setIsModalOpen(true);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="tap-target inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors"
      >
        <PenSquare className="h-5 w-5" />
        <span>Create Post</span>
      </button>

      <PostFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={onPostCreated}
      />
    </>
  );
}